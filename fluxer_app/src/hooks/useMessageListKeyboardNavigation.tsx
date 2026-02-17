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

import type {ScrollerHandle} from '@app/components/uikit/Scroller';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import MessageFocusStore from '@app/stores/MessageFocusStore';
import {type RefObject, useEffect, useRef} from 'react';

interface MessageListKeyboardNavigationOptions {
	containerRef?: RefObject<ScrollerHandle | HTMLElement | null>;
	channelId?: string;
	onFocusMessage?: (messageId: string) => void;
	onLoadMoreBefore?: () => void;
	onLoadMoreAfter?: () => void;
	hasMoreBefore?: boolean;
	hasMoreAfter?: boolean;
	isLoadingMore?: boolean;
	onEscape?: () => void;
	allowWhenInactive?: boolean;
}

const getScrollerNode = (value: ScrollerHandle | HTMLElement | null | undefined): HTMLElement | null => {
	if (!value) return null;
	if ('getScrollerNode' in value && typeof value.getScrollerNode === 'function') {
		return value.getScrollerNode();
	}
	if (value instanceof HTMLElement) {
		return value;
	}
	return null;
};

const isEditableTarget = (target: Element | null): boolean => {
	if (!target) return false;
	if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) return true;
	return target instanceof HTMLElement && target.isContentEditable;
};

export function useMessageListKeyboardNavigation(options: MessageListKeyboardNavigationOptions): void {
	const {
		containerRef,
		channelId,
		onFocusMessage,
		onLoadMoreBefore,
		onLoadMoreAfter,
		hasMoreBefore = false,
		hasMoreAfter = false,
		isLoadingMore = false,
		onEscape,
		allowWhenInactive = false,
	} = options;
	const messageNodesCache = useRef({nodes: [] as Array<HTMLElement>, ts: 0});
	const keyboardModeEnabled = KeyboardModeStore.keyboardModeEnabled;

	useEffect(() => {
		if (!keyboardModeEnabled) return;

		const getMessageElements = (): Array<HTMLElement> => {
			const now = Date.now();
			const cache = messageNodesCache.current;
			if (cache.nodes.length && now - cache.ts < 120) {
				return cache.nodes;
			}

			const container = getScrollerNode(containerRef?.current ?? null);
			if (!container && containerRef) {
				cache.nodes = [];
				cache.ts = now;
				return cache.nodes;
			}
			const root = container ?? document;
			const selector = channelId
				? `[data-channel-id="${channelId}"][data-message-id]`
				: '[data-message-id][data-channel-id]';
			const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector));
			cache.nodes = nodes;
			cache.ts = now;
			return nodes;
		};

		const focusNode = (node: HTMLElement, messageId: string) => {
			if (onFocusMessage) {
				onFocusMessage(messageId);
				return;
			}

			node.focus({preventScroll: true});
			const container = getScrollerNode(containerRef?.current ?? null);
			if (container) {
				const containerRect = container.getBoundingClientRect();
				const nodeRect = node.getBoundingClientRect();
				if (nodeRect.top < containerRect.top || nodeRect.bottom > containerRect.bottom) {
					node.scrollIntoView({block: 'nearest', inline: 'nearest'});
				}
			} else {
				node.scrollIntoView({block: 'nearest', inline: 'nearest'});
			}
		};

		const focusByDelta = (delta: number) => {
			const nodes = getMessageElements();
			if (!nodes.length) return;

			const activeId = MessageFocusStore.focusedMessageId ?? null;
			let idx = nodes.findIndex((node) => node.dataset.messageId === activeId);
			if (idx === -1) {
				idx = delta > 0 ? -1 : nodes.length;
			}

			const nextIdx = idx + delta;
			if (nextIdx < 0) {
				if (hasMoreBefore && onLoadMoreBefore && !isLoadingMore) {
					onLoadMoreBefore();
				}
				return;
			}
			if (nextIdx >= nodes.length) {
				if (hasMoreAfter && onLoadMoreAfter && !isLoadingMore) {
					onLoadMoreAfter();
				}
				return;
			}

			const nextNode = nodes[nextIdx];
			const nextId = nextNode?.dataset?.messageId;
			if (nextId) {
				focusNode(nextNode, nextId);
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (!keyboardModeEnabled) return;
			if (isEditableTarget(document.activeElement)) return;

			const container = getScrollerNode(containerRef?.current ?? null);
			if (container) {
				const activeElement = container.ownerDocument?.activeElement ?? document.activeElement;
				const activeInContainer = activeElement ? container.contains(activeElement) : false;
				const focusedId = MessageFocusStore.focusedMessageId;
				const focusedInContainer =
					focusedId != null && getMessageElements().some((node) => node.dataset.messageId === focusedId);
				const canHandleWhenInactive =
					allowWhenInactive &&
					(activeElement === document.body || activeElement === document.documentElement || !activeElement);
				if (!activeInContainer && !focusedInContainer && !canHandleWhenInactive) {
					return;
				}
			}

			switch (event.key) {
				case 'ArrowUp':
					event.preventDefault();
					focusByDelta(-1);
					return;
				case 'ArrowDown':
					event.preventDefault();
					focusByDelta(1);
					return;
				case 'Escape':
					if (onEscape) {
						event.preventDefault();
						onEscape();
					}
					return;
				default:
					return;
			}
		};

		window.addEventListener('keydown', handleKeyDown, true);
		return () => {
			window.removeEventListener('keydown', handleKeyDown, true);
		};
	}, [
		keyboardModeEnabled,
		containerRef,
		channelId,
		onFocusMessage,
		onLoadMoreBefore,
		onLoadMoreAfter,
		hasMoreBefore,
		hasMoreAfter,
		isLoadingMore,
		onEscape,
		allowWhenInactive,
	]);
}
