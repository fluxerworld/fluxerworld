/*
 * Copyright (C) 2026 Fluxer Contributors
 *
 * This file is part of Fluxer.
 *
 * Fluxer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Fluxer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Fluxer. If not, see <https://www.gnu.org/licenses/>.
 */

import MemberSidebarStore from '@app/stores/MemberSidebarStore';
import WindowStore from '@app/stores/WindowStore';
import {reaction} from 'mobx';
import {useCallback, useEffect, useRef} from 'react';

const UNFOCUS_UNSUBSCRIBE_DELAY_MS = 60000;
const INITIAL_MEMBER_RANGE: [number, number] = [0, 99];

interface UseMemberListSubscriptionOptions {
	guildId: string;
	channelId: string;
	enabled: boolean;
	allowInitialUnfocusedLoad?: boolean;
}

interface UseMemberListSubscriptionResult {
	subscribe: (ranges: Array<[number, number]>) => void;
	unsubscribe: () => void;
}

function rangesEqual(left: Array<[number, number]>, right: Array<[number, number]>): boolean {
	if (left.length !== right.length) {
		return false;
	}

	for (let index = 0; index < left.length; index++) {
		const [leftStart, leftEnd] = left[index];
		const [rightStart, rightEnd] = right[index];
		if (leftStart !== rightStart || leftEnd !== rightEnd) {
			return false;
		}
	}

	return true;
}

function normaliseRanges(inputRanges: Array<[number, number]>): Array<[number, number]> {
	if (inputRanges.length === 0) {
		return [];
	}

	const sanitised = inputRanges
		.map(([start, end]) => {
			const safeStart = Math.max(0, Math.floor(start));
			const safeEnd = Math.max(safeStart, Math.floor(end));
			return [safeStart, safeEnd] as [number, number];
		})
		.sort((left, right) => left[0] - right[0]);

	const merged: Array<[number, number]> = [];
	for (const range of sanitised) {
		const lastRange = merged[merged.length - 1];
		if (!lastRange) {
			merged.push(range);
			continue;
		}

		if (range[0] <= lastRange[1] + 1) {
			lastRange[1] = Math.max(lastRange[1], range[1]);
			continue;
		}

		merged.push(range);
	}

	return merged;
}

export function useMemberListSubscription({
	guildId,
	channelId,
	enabled,
	allowInitialUnfocusedLoad = false,
}: UseMemberListSubscriptionOptions): UseMemberListSubscriptionResult {
	const lastRangesRef = useRef<Array<[number, number]>>([INITIAL_MEMBER_RANGE]);
	const pendingRangesRef = useRef<Array<[number, number]> | null>(null);
	const rafIdRef = useRef<number | null>(null);
	const unfocusTimeoutRef = useRef<number | null>(null);
	const isSubscribedRef = useRef(false);
	const lastSubscribedRangesRef = useRef<Array<[number, number]>>([]);
	const lastSessionVersionRef = useRef(MemberSidebarStore.sessionVersion);
	const hadChannelListRef = useRef(MemberSidebarStore.getList(guildId, channelId) !== undefined);
	const initialUnfocusedLoadAttemptedRef = useRef(false);

	const clearUnfocusTimeout = useCallback(() => {
		if (unfocusTimeoutRef.current !== null) {
			window.clearTimeout(unfocusTimeoutRef.current);
			unfocusTimeoutRef.current = null;
		}
	}, []);

	const clearSubscribeFrame = useCallback(() => {
		if (rafIdRef.current !== null) {
			window.cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = null;
		}
	}, []);

	const attemptSubscribe = useCallback(
		(ranges: Array<[number, number]>) => {
			if (!enabled) {
				return;
			}

			const windowFocused = WindowStore.focused;
			const allowUnfocusedLoad = allowInitialUnfocusedLoad && !initialUnfocusedLoadAttemptedRef.current;
			if (!windowFocused && !allowUnfocusedLoad) {
				return;
			}

			if (!windowFocused) {
				initialUnfocusedLoadAttemptedRef.current = true;
			}

			if (isSubscribedRef.current && rangesEqual(lastSubscribedRangesRef.current, ranges)) {
				return;
			}

			MemberSidebarStore.subscribeToChannel(guildId, channelId, ranges);
			isSubscribedRef.current = true;
			lastSubscribedRangesRef.current = ranges;
		},
		[guildId, channelId, enabled, allowInitialUnfocusedLoad],
	);

	const flushPendingSubscribe = useCallback(() => {
		rafIdRef.current = null;
		const pendingRanges = pendingRangesRef.current;
		if (!pendingRanges) {
			return;
		}

		pendingRangesRef.current = null;
		attemptSubscribe(pendingRanges);
	}, [attemptSubscribe]);

	const queueSubscribe = useCallback(
		(ranges: Array<[number, number]>) => {
			const normalisedRanges = normaliseRanges(ranges);
			lastRangesRef.current = normalisedRanges;
			pendingRangesRef.current = normalisedRanges;
			if (rafIdRef.current !== null) {
				return;
			}

			rafIdRef.current = window.requestAnimationFrame(flushPendingSubscribe);
		},
		[flushPendingSubscribe],
	);

	const subscribe = useCallback(
		(ranges: Array<[number, number]>) => {
			queueSubscribe(ranges);
		},
		[queueSubscribe],
	);

	const unsubscribe = useCallback(() => {
		clearUnfocusTimeout();
		clearSubscribeFrame();
		pendingRangesRef.current = null;
		if (isSubscribedRef.current) {
			MemberSidebarStore.unsubscribeFromChannel(guildId, channelId);
			isSubscribedRef.current = false;
		}
		lastSubscribedRangesRef.current = [];
	}, [guildId, channelId, clearUnfocusTimeout, clearSubscribeFrame]);

	const resubscribe = useCallback(() => {
		if (lastRangesRef.current.length > 0) {
			attemptSubscribe(lastRangesRef.current);
		}
	}, [attemptSubscribe]);

	useEffect(() => {
		lastRangesRef.current = [INITIAL_MEMBER_RANGE];
		pendingRangesRef.current = null;
		isSubscribedRef.current = false;
		lastSubscribedRangesRef.current = [];
		lastSessionVersionRef.current = MemberSidebarStore.sessionVersion;
		hadChannelListRef.current = MemberSidebarStore.getList(guildId, channelId) !== undefined;
		initialUnfocusedLoadAttemptedRef.current = false;
		clearUnfocusTimeout();
		clearSubscribeFrame();
	}, [guildId, channelId, clearUnfocusTimeout, clearSubscribeFrame]);

	useEffect(() => {
		if (!enabled) {
			unsubscribe();
			return;
		}

		if (WindowStore.focused) {
			resubscribe();
		}

		const disposeFocusReaction = reaction(
			() => WindowStore.focused,
			(focused) => {
				if (focused) {
					clearUnfocusTimeout();
					resubscribe();
					return;
				}

				clearUnfocusTimeout();
				unfocusTimeoutRef.current = window.setTimeout(() => {
					unfocusTimeoutRef.current = null;
					if (!WindowStore.focused && isSubscribedRef.current) {
						MemberSidebarStore.unsubscribeFromChannel(guildId, channelId);
						isSubscribedRef.current = false;
						lastSubscribedRangesRef.current = [];
					}
				}, UNFOCUS_UNSUBSCRIBE_DELAY_MS);
			},
		);

		const disposeSessionReaction = reaction(
			() => MemberSidebarStore.sessionVersion,
			(newVersion) => {
				if (newVersion !== lastSessionVersionRef.current) {
					lastSessionVersionRef.current = newVersion;
					isSubscribedRef.current = false;
					lastSubscribedRangesRef.current = [];
					if (WindowStore.focused) {
						resubscribe();
					}
				}
			},
		);

		const disposeGuildListReaction = reaction(
			() => MemberSidebarStore.getList(guildId, channelId) !== undefined,
			(hasChannelList) => {
				const hadChannelList = hadChannelListRef.current;
				hadChannelListRef.current = hasChannelList;

				if (hadChannelList && !hasChannelList) {
					isSubscribedRef.current = false;
					lastSubscribedRangesRef.current = [];
				}

				if (!hasChannelList && WindowStore.focused && enabled) {
					resubscribe();
				}
			},
		);

		return () => {
			disposeFocusReaction();
			disposeSessionReaction();
			disposeGuildListReaction();
			clearUnfocusTimeout();
			clearSubscribeFrame();
			unsubscribe();
		};
	}, [guildId, channelId, enabled, resubscribe, unsubscribe, clearUnfocusTimeout, clearSubscribeFrame]);

	useEffect(() => {
		if (enabled && !isSubscribedRef.current) {
			queueSubscribe(lastRangesRef.current);
		}
	}, [enabled, queueSubscribe]);

	return {subscribe, unsubscribe};
}
