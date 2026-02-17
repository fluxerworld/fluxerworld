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

import * as CallActionCreators from '@app/actions/CallActionCreators';
import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import {DirectCallLobbyBottomSheet} from '@app/components/bottomsheets/DirectCallLobbyBottomSheet';
import {
	BlockedUserBarrier,
	SystemDmBarrier,
	UnclaimedDMBarrier,
} from '@app/components/channel/barriers/BarrierComponents';
import {ChannelChatLayout} from '@app/components/channel/ChannelChatLayout';
import {ChannelHeader} from '@app/components/channel/ChannelHeader';
import styles from '@app/components/channel/ChannelIndexPage.module.css';
import {ChannelMembers} from '@app/components/channel/ChannelMembers';
import {ChannelSearchResults} from '@app/components/channel/ChannelSearchResults';
import {ChannelTextarea} from '@app/components/channel/ChannelTextarea';
import {ChannelViewScaffold} from '@app/components/channel/channel_view/ChannelViewScaffold';
import {useCallHeaderState} from '@app/components/channel/channel_view/useCallHeaderState';
import {useChannelSearchState} from '@app/components/channel/channel_view/useChannelSearchState';
import dmStyles from '@app/components/channel/direct_message/DMChannelView.module.css';
import {Messages} from '@app/components/channel/Messages';
import {Avatar} from '@app/components/uikit/Avatar';
import {Button} from '@app/components/uikit/button/Button';
import {UserContextMenu} from '@app/components/uikit/context_menu/UserContextMenu';
import {VoiceParticipantContextMenu} from '@app/components/uikit/context_menu/VoiceParticipantContextMenu';
import {CompactVoiceCallView} from '@app/components/voice/CompactVoiceCallView';
import {StreamFocusHeaderInfo} from '@app/components/voice/StreamFocusHeaderInfo';
import {getStreamKey} from '@app/components/voice/StreamKeys';
import {useStreamSpectators} from '@app/components/voice/useStreamSpectators';
import {VOICE_CALL_FULLSCREEN_ENABLED} from '@app/components/voice/VoiceCallFullscreenFeatureFlag';
import {VoiceCallView} from '@app/components/voice/VoiceCallView';
import {
	useVoiceParticipantAvatarEntries,
	type VoiceParticipantAvatarEntry,
} from '@app/components/voice/VoiceParticipantAvatarList';
import {parseVoiceParticipantIdentity} from '@app/components/voice/VoiceParticipantSpeakingUtils';
import {useChannelMemberListVisibility} from '@app/hooks/useChannelMemberListVisibility';
import {useChannelSearchVisibility} from '@app/hooks/useChannelSearchVisibility';
import {useFluxerDocumentTitle} from '@app/hooks/useFluxerDocumentTitle';
import {useMemberListVisible} from '@app/hooks/useMemberListVisible';
import {Logger} from '@app/lib/Logger';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {UserRecord} from '@app/records/UserRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import CallStateStore, {type Call} from '@app/stores/CallStateStore';
import ChannelStore from '@app/stores/ChannelStore';
import CompactVoiceCallHeightStore, {
	COMPACT_VOICE_CALL_HEIGHT_MAX,
	COMPACT_VOICE_CALL_HEIGHT_MIN,
} from '@app/stores/CompactVoiceCallHeightStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import UserStore from '@app/stores/UserStore';
import VoiceCallLayoutStore from '@app/stores/VoiceCallLayoutStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import WindowStore from '@app/stores/WindowStore';
import {getExtendedDocument} from '@app/types/Browser';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import {isMobileExperienceEnabled} from '@app/utils/MobileExperience';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {BellSlashIcon, ChatTeardropIcon, PhoneIcon, XIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {Track} from 'livekit-client';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

interface DMChannelViewProps {
	channelId: string;
}

const logger = new Logger('DMChannelView');
const CALL_AVATAR_DEFAULT_SIZE = 64;
const CALL_AVATAR_MAX_SIZE = 72;
const CALL_AVATAR_PADDING = 12;
const CALL_AVATAR_LAYOUT_OFFSET = 240;
const CALL_RINGING_AVATAR_ANIMATION = {
	scale: [1, 1, 1.015, 1.055, 1.085, 1.04, 1],
};
const CALL_RINGING_RIPPLE_ANIMATION = {
	opacity: [0, 0, 0.14, 0.28, 0.3, 0.16, 0],
	scale: [0.94, 0.98, 1.1, 1.22, 1.2, 1.04, 0.94],
};
const CALL_RINGING_BREATH_TIMES = [0, 0.16, 0.34, 0.52, 0.7, 0.86, 1];
const CALL_RINGING_DURATION_SECONDS = 3.2;
const CALL_AVATAR_SPRING = {stiffness: 520, damping: 34, mass: 0.6} as const;
const COMPACT_CALL_RESIZE_DRAG_THRESHOLD_SQ = 9;
const COMPACT_CALL_RESIZE_VIEWPORT_MARGIN = 32;
const COMPACT_CALL_RESIZE_STEP = 16;

function getFullscreenElement(): Element | null {
	const doc = getExtendedDocument();
	return (
		document.fullscreenElement ||
		doc.webkitFullscreenElement ||
		doc.mozFullScreenElement ||
		doc.msFullscreenElement ||
		null
	);
}

function getCompactCallHeightKey(channelId: string, callMessageId: string | null): string {
	return callMessageId ? `${channelId}:${callMessageId}` : channelId;
}

function getCompactCallHeightMax(compactHeightMin: number): number {
	const viewportLimitedMax = Math.round(window.innerHeight - COMPACT_CALL_RESIZE_VIEWPORT_MARGIN);
	return Math.max(compactHeightMin, Math.min(viewportLimitedMax, COMPACT_VOICE_CALL_HEIGHT_MAX));
}

interface CallParticipant {
	user: UserRecord;
	isRinging: boolean;
}

interface CallParticipantsRowProps {
	call: Call;
	channel: ChannelRecord;
	participantAvatarEntries: ReadonlyArray<VoiceParticipantAvatarEntry>;
	className?: string;
}

interface CompactCallResizeListeners {
	move: (event: PointerEvent) => void;
	up: (event: PointerEvent) => void;
}

interface CompactCallResizeState {
	pointerId: number;
	startY: number;
	startHeight: number;
	dragging: boolean;
	lastHeight?: number;
}

type CallControlRenderMode = 'mobile' | 'voiceControlBar';
type CallControlTone = 'primary' | 'secondary' | 'danger';

const getCallAvatarSize = (count: number, windowWidth: number): number => {
	if (count <= 0) return CALL_AVATAR_DEFAULT_SIZE;
	const availableWidth = Math.max(0, windowWidth - CALL_AVATAR_LAYOUT_OFFSET);
	const slotWidth = Math.floor(availableWidth / Math.max(count, 1));
	const responsiveSize = slotWidth - CALL_AVATAR_PADDING;
	return Math.max(CALL_AVATAR_DEFAULT_SIZE, Math.min(CALL_AVATAR_MAX_SIZE, responsiveSize));
};

const CallParticipantsRow = observer(
	({call, channel, participantAvatarEntries, className}: CallParticipantsRowProps) => {
		const {t} = useLingui();
		const windowWidth = WindowStore.windowSize.width;
		const currentUserId = AuthenticationStore.currentUserId;
		const callParticipantIds = call.participants;
		const liveParticipantIds = CallStateStore.getParticipants(channel.id);
		const orderedIds = [
			currentUserId,
			...callParticipantIds,
			...liveParticipantIds,
			...channel.recipientIds,
			...call.ringing,
		].filter((id): id is string => Boolean(id));

		const ringingSet = new Set(call.ringing);
		const participantSet = new Set([...callParticipantIds, ...liveParticipantIds]);
		const participants: Array<CallParticipant> = [];
		const seen = new Set<string>();

		const addParticipant = (id: string) => {
			if (seen.has(id)) return;
			const isInCall = participantSet.has(id);
			const isRinging = ringingSet.has(id) && !isInCall;
			if (!isInCall && !isRinging) return;
			const user = UserStore.getUser(id);
			if (!user) return;
			participants.push({user, isRinging: !isInCall && isRinging});
			seen.add(id);
		};

		for (const id of orderedIds) {
			addParticipant(id);
		}

		for (const id of liveParticipantIds) {
			addParticipant(id);
		}

		for (const id of call.ringing) {
			addParticipant(id);
		}

		const participantEntryByUserId = useMemo(() => {
			const byUserId = new Map<string, VoiceParticipantAvatarEntry>();
			participantAvatarEntries.forEach((entry) => {
				if (byUserId.has(entry.userId)) {
					return;
				}
				byUserId.set(entry.userId, entry);
			});
			return byUserId;
		}, [participantAvatarEntries]);

		const handleContextMenu = useCallback(
			(event: React.MouseEvent, user: UserRecord) => {
				event.preventDefault();
				event.stopPropagation();
				const participantEntry = participantEntryByUserId.get(user.id);
				const participantName =
					NicknameUtils.getNickname(user, channel.guildId ?? undefined, channel.id) || user.username || user.id;
				ContextMenuActionCreators.openFromEvent(event, ({onClose}) =>
					participantEntry ? (
						<VoiceParticipantContextMenu
							user={user}
							participantName={participantName}
							onClose={onClose}
							guildId={channel.guildId ?? undefined}
							connectionId={participantEntry.connectionId}
						/>
					) : (
						<UserContextMenu user={user} onClose={onClose} channelId={channel.id} isCallContext />
					),
				);
			},
			[channel.guildId, channel.id, participantEntryByUserId],
		);

		if (participants.length === 0) return null;

		const avatarSize = getCallAvatarSize(participants.length, windowWidth);
		const callRippleStyle = useMemo(() => {
			const rippleOuter = Math.round(avatarSize * 2.05);
			const rippleMid = Math.round(avatarSize * 1.72);
			const rippleInner = Math.round(avatarSize * 1.42);
			const rippleCore = Math.round(avatarSize * 1.16);
			return {
				'--call-ripple-size-1': `${rippleOuter}px`,
				'--call-ripple-size-2': `${rippleMid}px`,
				'--call-ripple-size-3': `${rippleInner}px`,
				'--call-ripple-size-4': `${rippleCore}px`,
			} as React.CSSProperties;
		}, [avatarSize]);

		return (
			<div className={clsx(dmStyles.callParticipantsRow, className)} role="group" aria-label={t`Call participants`}>
				<AnimatePresence initial={false}>
					{participants.map(({user, isRinging}) => (
						<motion.button
							type="button"
							key={user.id}
							className={`${dmStyles.callParticipant} ${isRinging ? dmStyles.callParticipantRinging : ''}`.trim()}
							onContextMenu={(event) => handleContextMenu(event, user)}
							aria-label={user.username}
							layout
							initial={{opacity: 0, scale: 0.75}}
							animate={{opacity: 1, scale: 1}}
							exit={{opacity: 0, scale: 0.1}}
							transition={CALL_AVATAR_SPRING}
						>
							{isRinging && (
								<motion.span
									className={dmStyles.callParticipantRippleGroup}
									style={callRippleStyle}
									animate={CALL_RINGING_RIPPLE_ANIMATION}
									initial={{opacity: 0, scale: 0.94}}
									transition={{
										duration: CALL_RINGING_DURATION_SECONDS,
										ease: [0.32, 0, 0.2, 1],
										times: CALL_RINGING_BREATH_TIMES,
										repeat: Infinity,
										repeatType: 'loop',
									}}
								>
									<span
										className={`${dmStyles.callParticipantRippleRing} ${dmStyles.callParticipantRippleRingOuter}`.trim()}
									/>
									<span
										className={`${dmStyles.callParticipantRippleRing} ${dmStyles.callParticipantRippleRingMid}`.trim()}
									/>
									<span
										className={`${dmStyles.callParticipantRippleRing} ${dmStyles.callParticipantRippleRingInner}`.trim()}
									/>
									<span
										className={`${dmStyles.callParticipantRippleRing} ${dmStyles.callParticipantRippleRingCore}`.trim()}
									/>
								</motion.span>
							)}
							<motion.div
								className={dmStyles.callParticipantAvatar}
								animate={isRinging ? CALL_RINGING_AVATAR_ANIMATION : {scale: 1}}
								transition={
									isRinging
										? {
												duration: CALL_RINGING_DURATION_SECONDS,
												ease: [0.32, 0, 0.2, 1],
												times: CALL_RINGING_BREATH_TIMES,
												repeat: Infinity,
												repeatType: 'loop',
											}
										: {duration: 0.2, ease: [0.36, 0, 0.2, 1]}
								}
							>
								<Avatar user={user} size={avatarSize} status={null} showOffline={false} />
							</motion.div>
						</motion.button>
					))}
				</AnimatePresence>
			</div>
		);
	},
);

export const DMChannelView = observer(({channelId}: DMChannelViewProps) => {
	const {t} = useLingui();
	const channel = ChannelStore.getChannel(channelId);
	const recipientId = channel?.recipientIds?.[0];
	const recipient = recipientId ? UserStore.getUser(recipientId) : null;
	const isRecipientBlocked = recipientId ? RelationshipStore.isBlocked(recipientId) : false;
	const isCurrentUserUnclaimed = !UserStore.currentUser?.isClaimed();
	const isMemberListVisible = useMemberListVisible();
	const isSystemDm = channel ? ChannelUtils.isSystemDmChannel(channel) : false;

	const mediaConnected = MediaEngineStore.connected;
	const mediaChannelId = MediaEngineStore.channelId;
	const mediaGuildId = MediaEngineStore.guildId;
	const room = MediaEngineStore.room;
	const participantAvatarEntries = useVoiceParticipantAvatarEntries({
		guildId: channel?.guildId ?? null,
		channelId: channel?.id ?? null,
	});
	const hasActiveCallMedia = useMemo(() => {
		if (!channel) return false;
		if (mediaChannelId !== channel.id) return false;
		return participantAvatarEntries.some((entry) => entry.hasCamera || entry.hasScreenShare);
	}, [channel, mediaChannelId, participantAvatarEntries]);
	const screenShareEntries = useMemo(
		() => participantAvatarEntries.filter((entry) => entry.hasScreenShare),
		[participantAvatarEntries],
	);
	const pinnedParticipantIdentity = VoiceCallLayoutStore.pinnedParticipantIdentity;
	const pinnedParticipantSource = VoiceCallLayoutStore.pinnedParticipantSource;
	const focusedScreenShareEntry = useMemo(() => {
		if (screenShareEntries.length === 0) return null;
		if (pinnedParticipantIdentity && pinnedParticipantSource === Track.Source.ScreenShare) {
			const parsedIdentity = parseVoiceParticipantIdentity(pinnedParticipantIdentity);
			if (parsedIdentity.userId && parsedIdentity.connectionId) {
				const pinnedEntry = screenShareEntries.find(
					(entry) => entry.userId === parsedIdentity.userId && entry.connectionId === parsedIdentity.connectionId,
				);
				if (pinnedEntry) return pinnedEntry;
			}
		}
		return screenShareEntries[0] ?? null;
	}, [pinnedParticipantIdentity, pinnedParticipantSource, screenShareEntries]);

	const searchState = useChannelSearchState(channel);
	const {
		isSearchActive,
		handleSearchClose,
		handleSearchSubmit,
		searchRefreshKey,
		activeSearchQuery,
		activeSearchSegments,
	} = searchState;
	const [hasMessagesBottomBar, setHasMessagesBottomBar] = useState(false);

	useEffect(() => {
		setHasMessagesBottomBar(false);
	}, [channelId]);

	useChannelSearchVisibility(channelId, isSearchActive);
	useChannelMemberListVisibility(channelId, isMemberListVisible);

	const isDM = channel?.type === ChannelTypes.DM;
	const displayName = channel ? ChannelUtils.getDMDisplayName(channel) : null;
	const title = isDM && displayName ? `@${displayName}` : displayName;
	useFluxerDocumentTitle(title);
	const isGroupDM = channel?.type === ChannelTypes.GROUP_DM;
	const isPersonalNotes = channel?.type === ChannelTypes.DM_PERSONAL_NOTES;
	const callHeaderState = useCallHeaderState(channel);
	const call = callHeaderState.call;
	const currentChannelId = channel?.id ?? null;
	const isInCallVariant = callHeaderState.controlsVariant === 'inCall';
	const showCompactVoiceView = isInCallVariant && callHeaderState.isDeviceInRoomForChannelCall;
	const callExistsAndOngoing = callHeaderState.callExistsAndOngoing;
	const controlsVariant = callHeaderState.controlsVariant;
	const showCallBackground = callExistsAndOngoing && controlsVariant !== 'hidden';
	const isMobileExperience = isMobileExperienceEnabled();
	const isCompactCallResizable = !isMobileExperience;
	const compactCallHeightMin = COMPACT_VOICE_CALL_HEIGHT_MIN;
	const compactCallHeightKey = useMemo(() => {
		if (!currentChannelId) return null;
		return getCompactCallHeightKey(currentChannelId, call?.messageId ?? null);
	}, [call?.messageId, currentChannelId]);
	const compactCallResizeStateRef = useRef<CompactCallResizeState | null>(null);
	const compactCallResizeListenersRef = useRef<CompactCallResizeListeners | null>(null);
	const [isResizingCompactCallBanner, setIsResizingCompactCallBanner] = useState(false);
	const [compactCallMaxHeight, setCompactCallMaxHeight] = useState(() => getCompactCallHeightMax(compactCallHeightMin));
	const [compactCallBannerHeight, setCompactCallBannerHeight] = useState<number | null>(() => {
		if (!isCompactCallResizable || !compactCallHeightKey) {
			return null;
		}
		return CompactVoiceCallHeightStore.getStartingHeight(compactCallHeightKey) ?? null;
	});
	const clampCompactCallBannerHeight = useCallback(
		(value: number) => Math.max(compactCallHeightMin, Math.min(Math.round(value), compactCallMaxHeight)),
		[compactCallHeightMin, compactCallMaxHeight],
	);
	const setCompactCallBannerHeightForKey = useCallback(
		(nextHeight: number, options: {persist?: boolean} = {}) => {
			const normalizedHeight = clampCompactCallBannerHeight(nextHeight);
			if (isCompactCallResizable && options.persist && compactCallHeightKey) {
				const persistedHeight = CompactVoiceCallHeightStore.setHeightForKey(compactCallHeightKey, normalizedHeight);
				setCompactCallBannerHeight(persistedHeight);
				return;
			}
			setCompactCallBannerHeight(normalizedHeight);
		},
		[clampCompactCallBannerHeight, compactCallHeightKey, isCompactCallResizable],
	);
	const [isCallSheetOpen, setIsCallSheetOpen] = useState(false);
	const [showVoiceCallViewForFullscreen, setShowVoiceCallViewForFullscreen] = useState(false);
	const [voiceCallFullscreenRequestNonce, setVoiceCallFullscreenRequestNonce] = useState(0);

	const handleOpenCallSheet = useCallback(() => setIsCallSheetOpen(true), []);
	const handleCloseCallSheet = useCallback(() => setIsCallSheetOpen(false), []);
	const handleOpenVoiceCallFullscreenView = useCallback(() => {
		if (!VOICE_CALL_FULLSCREEN_ENABLED) return;
		setShowVoiceCallViewForFullscreen(true);
		setVoiceCallFullscreenRequestNonce((nonce) => nonce + 1);
	}, []);

	useEffect(() => {
		if (!callExistsAndOngoing) {
			setIsCallSheetOpen(false);
			setShowVoiceCallViewForFullscreen(false);
		}
	}, [callExistsAndOngoing]);

	useEffect(() => {
		if (!callHeaderState.isDeviceInRoomForChannelCall) {
			setShowVoiceCallViewForFullscreen(false);
		}
	}, [callHeaderState.isDeviceInRoomForChannelCall]);

	useEffect(() => {
		if (!showVoiceCallViewForFullscreen) return;

		const handleFullscreenChange = () => {
			if (getFullscreenElement()) return;
			setShowVoiceCallViewForFullscreen(false);
		};

		document.addEventListener('fullscreenchange', handleFullscreenChange);
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
		document.addEventListener('mozfullscreenchange', handleFullscreenChange);
		document.addEventListener('MSFullscreenChange', handleFullscreenChange);

		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
			document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
			document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
		};
	}, [showVoiceCallViewForFullscreen]);

	useEffect(() => {
		if (!isCompactCallResizable) return;

		const handleResize = () => {
			const nextMax = getCompactCallHeightMax(compactCallHeightMin);
			setCompactCallMaxHeight(nextMax);
		};

		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [compactCallHeightMin, isCompactCallResizable]);

	useEffect(() => {
		if (!isCompactCallResizable || !compactCallHeightKey) {
			setCompactCallBannerHeight(null);
			return;
		}

		const storedHeight = CompactVoiceCallHeightStore.getStartingHeight(compactCallHeightKey);
		if (storedHeight != null) {
			setCompactCallBannerHeightForKey(storedHeight);
			return;
		}
		setCompactCallBannerHeight(null);
	}, [compactCallHeightKey, isCompactCallResizable, setCompactCallBannerHeightForKey]);

	useEffect(() => {
		if (!isCompactCallResizable || compactCallBannerHeight == null) return;
		if (compactCallBannerHeight > compactCallMaxHeight) {
			setCompactCallBannerHeightForKey(compactCallMaxHeight);
			return;
		}
		if (compactCallBannerHeight < compactCallHeightMin) {
			setCompactCallBannerHeightForKey(compactCallHeightMin);
		}
	}, [
		compactCallBannerHeight,
		compactCallHeightMin,
		compactCallMaxHeight,
		isCompactCallResizable,
		setCompactCallBannerHeightForKey,
	]);

	const cleanupCompactCallResizeListeners = useCallback(() => {
		const listeners = compactCallResizeListenersRef.current;
		if (!listeners) return;
		window.removeEventListener('pointermove', listeners.move);
		window.removeEventListener('pointerup', listeners.up);
		window.removeEventListener('pointercancel', listeners.up);
		compactCallResizeListenersRef.current = null;
	}, []);

	const handleCompactCallResizePointerMove = useCallback(
		(event: PointerEvent) => {
			if (!isCompactCallResizable) return;
			const resizeState = compactCallResizeStateRef.current;
			if (!resizeState || resizeState.pointerId !== event.pointerId) return;

			const deltaY = event.clientY - resizeState.startY;
			if (!resizeState.dragging) {
				if (deltaY * deltaY <= COMPACT_CALL_RESIZE_DRAG_THRESHOLD_SQ) return;
				resizeState.dragging = true;
				setIsResizingCompactCallBanner(true);
			}

			const nextHeight = clampCompactCallBannerHeight(resizeState.startHeight + deltaY);
			resizeState.lastHeight = nextHeight;
			setCompactCallBannerHeightForKey(nextHeight);
		},
		[clampCompactCallBannerHeight, isCompactCallResizable, setCompactCallBannerHeightForKey],
	);

	const handleCompactCallResizePointerUp = useCallback(
		(event: PointerEvent) => {
			if (!isCompactCallResizable) return;
			const resizeState = compactCallResizeStateRef.current;
			if (!resizeState || resizeState.pointerId !== event.pointerId) return;
			cleanupCompactCallResizeListeners();
			if (resizeState.dragging) {
				setIsResizingCompactCallBanner(false);
				if (resizeState.lastHeight != null) {
					setCompactCallBannerHeightForKey(resizeState.lastHeight, {persist: true});
				}
			}
			compactCallResizeStateRef.current = null;
		},
		[cleanupCompactCallResizeListeners, isCompactCallResizable, setCompactCallBannerHeightForKey],
	);

	const handleCompactCallResizePointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (!isCompactCallResizable || event.button !== 0 || !compactCallHeightKey) return;
			event.preventDefault();
			event.stopPropagation();

			const startHeight =
				compactCallBannerHeight ??
				CompactVoiceCallHeightStore.getStartingHeight(compactCallHeightKey) ??
				compactCallHeightMin;

			compactCallResizeStateRef.current = {
				pointerId: event.pointerId,
				startY: event.clientY,
				startHeight,
				dragging: false,
			};

			const moveListener = (moveEvent: PointerEvent) => handleCompactCallResizePointerMove(moveEvent);
			const upListener = (upEvent: PointerEvent) => handleCompactCallResizePointerUp(upEvent);

			compactCallResizeListenersRef.current = {
				move: moveListener,
				up: upListener,
			};

			window.addEventListener('pointermove', moveListener);
			window.addEventListener('pointerup', upListener);
			window.addEventListener('pointercancel', upListener);
		},
		[
			compactCallBannerHeight,
			compactCallHeightKey,
			compactCallHeightMin,
			handleCompactCallResizePointerMove,
			handleCompactCallResizePointerUp,
			isCompactCallResizable,
		],
	);

	const handleCompactCallResizeKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			if (!isCompactCallResizable) return;
			if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
			event.preventDefault();
			const direction = event.key === 'ArrowUp' ? -1 : 1;
			const baseHeight =
				compactCallBannerHeight ??
				(compactCallHeightKey ? CompactVoiceCallHeightStore.getStartingHeight(compactCallHeightKey) : null) ??
				compactCallHeightMin;
			setCompactCallBannerHeightForKey(baseHeight + COMPACT_CALL_RESIZE_STEP * direction, {persist: true});
		},
		[
			compactCallBannerHeight,
			compactCallHeightKey,
			compactCallHeightMin,
			isCompactCallResizable,
			setCompactCallBannerHeightForKey,
		],
	);

	useEffect(() => {
		return () => {
			cleanupCompactCallResizeListeners();
		};
	}, [cleanupCompactCallResizeListeners]);

	useEffect(() => {
		if (!isResizingCompactCallBanner) return;
		const previousCursor = document.body.style.cursor;
		const previousUserSelect = document.body.style.userSelect;
		document.body.style.cursor = 'ns-resize';
		document.body.style.userSelect = 'none';
		return () => {
			document.body.style.cursor = previousCursor;
			document.body.style.userSelect = previousUserSelect;
		};
	}, [isResizingCompactCallBanner]);

	const compactCallBannerWrapperStyle = useMemo(() => {
		if (!isCompactCallResizable || compactCallBannerHeight == null) return undefined;
		return {
			height: compactCallBannerHeight,
			minHeight: compactCallHeightMin,
			maxHeight: compactCallMaxHeight,
		} satisfies React.CSSProperties;
	}, [compactCallBannerHeight, compactCallHeightMin, compactCallMaxHeight, isCompactCallResizable]);

	useEffect(() => {
		logger.debug('voice connection state', {
			channelId,
			connected: mediaConnected,
			mediaChannelId,
			mediaGuildId,
			hasRoom: Boolean(room),
			showCompactVoiceView,
		});
	}, [channelId, mediaConnected, mediaChannelId, mediaGuildId, room, showCompactVoiceView]);

	useEffect(() => {
		logger.debug('compact voice view render decision', {
			channelId,
			showCompactVoiceView,
			roomName: room?.name ?? null,
		});
	}, [channelId, showCompactVoiceView, room]);

	const handleJoinCall = useCallback(() => {
		if (currentChannelId) {
			CallActionCreators.joinCall(currentChannelId);
		}
	}, [currentChannelId]);

	const handleRejectIncomingCall = useCallback(() => {
		if (currentChannelId) {
			CallActionCreators.rejectCall(currentChannelId);
		}
	}, [currentChannelId]);

	const handleIgnoreIncomingCall = useCallback(() => {
		if (currentChannelId) {
			CallActionCreators.ignoreCall(currentChannelId);
		}
	}, [currentChannelId]);

	const shouldRenderMemberList = Boolean(isGroupDM && isMemberListVisible && !isSearchActive);

	const callStatusLabel = useMemo(() => {
		switch (controlsVariant) {
			case 'incoming':
				return t`Incoming call`;
			case 'join':
				return t`Call available`;
			case 'connecting':
				return t`Connecting…`;
			case 'inCall':
				return callHeaderState.isDeviceInRoomForChannelCall ? t`In call` : t`In call on other device`;
			default:
				return t`Voice call`;
		}
	}, [callHeaderState.isDeviceInRoomForChannelCall, controlsVariant, t]);
	const focusedStreamKey = useMemo(() => {
		if (!channel || !focusedScreenShareEntry) return '';
		return getStreamKey(channel.guildId, channel.id, focusedScreenShareEntry.connectionId);
	}, [channel, focusedScreenShareEntry]);
	const {viewerUsers: focusedStreamSpectatorUsers, spectatorEntries: focusedStreamSpectatorEntries} =
		useStreamSpectators(focusedStreamKey);
	const focusedStreamerDisplayName = useMemo(() => {
		if (!channel || !focusedScreenShareEntry) return '';
		return (
			NicknameUtils.getNickname(focusedScreenShareEntry.user, channel.guildId, channel.id) ||
			focusedScreenShareEntry.user.username ||
			''
		);
	}, [channel, focusedScreenShareEntry]);
	const shouldShowCompactHeaderStreamInfo = useMemo(() => {
		return (
			Boolean(showCompactVoiceView) &&
			Boolean(channel) &&
			VoiceCallLayoutStore.layoutMode === 'focus' &&
			(pinnedParticipantIdentity == null || pinnedParticipantSource === Track.Source.ScreenShare) &&
			focusedScreenShareEntry != null
		);
	}, [channel, focusedScreenShareEntry, pinnedParticipantIdentity, pinnedParticipantSource, showCompactVoiceView]);
	const compactVoiceCallHeaderSupplement = useMemo(() => {
		if (!channel || !focusedScreenShareEntry || !shouldShowCompactHeaderStreamInfo) return null;
		return (
			<StreamFocusHeaderInfo
				streamerUser={focusedScreenShareEntry.user}
				streamerDisplayName={focusedStreamerDisplayName}
				viewerUsers={focusedStreamSpectatorUsers}
				spectatorEntries={focusedStreamSpectatorEntries}
				guildId={channel.guildId ?? undefined}
				channelId={channel.id}
			/>
		);
	}, [
		channel,
		focusedScreenShareEntry,
		focusedStreamerDisplayName,
		focusedStreamSpectatorEntries,
		focusedStreamSpectatorUsers,
		shouldShowCompactHeaderStreamInfo,
	]);

	const callSheetButtonLabel = useMemo(() => {
		if (controlsVariant === 'incoming') {
			return t`View incoming call`;
		}
		return t`View call`;
	}, [controlsVariant, t]);

	const renderVoiceControlBarButton = ({
		label,
		icon,
		tone,
		onClick,
		disabled = false,
		submitting = false,
	}: {
		label: string;
		icon: React.ReactNode;
		tone: CallControlTone;
		onClick?: () => void;
		disabled?: boolean;
		submitting?: boolean;
	}) => (
		<button
			type="button"
			className={clsx(
				dmStyles.callControlButton,
				tone === 'primary' && dmStyles.callControlButtonPrimary,
				tone === 'danger' && dmStyles.callControlButtonDanger,
				tone === 'secondary' && dmStyles.callControlButtonSecondary,
				submitting && dmStyles.callControlButtonSubmitting,
			)}
			onClick={onClick}
			disabled={disabled || submitting}
			aria-label={label}
		>
			<span className={dmStyles.callControlButtonIcon}>{icon}</span>
			<span className={dmStyles.callControlButtonLabel}>{label}</span>
		</button>
	);

	const renderCallControls = (renderMode: CallControlRenderMode) => {
		const useVoiceControlBarStyle = renderMode === 'voiceControlBar';
		if (controlsVariant === 'incoming') {
			if (useVoiceControlBarStyle) {
				return (
					<>
						{renderVoiceControlBarButton({
							label: t`Accept`,
							icon: <PhoneIcon size={18} weight="fill" />,
							tone: 'primary',
							onClick: handleJoinCall,
						})}
						{renderVoiceControlBarButton({
							label: t`Reject`,
							icon: <XIcon size={18} weight="bold" />,
							tone: 'danger',
							onClick: handleRejectIncomingCall,
						})}
						{renderVoiceControlBarButton({
							label: t`Ignore`,
							icon: <BellSlashIcon size={18} weight="fill" />,
							tone: 'secondary',
							onClick: handleIgnoreIncomingCall,
						})}
					</>
				);
			}
			return (
				<>
					<Button variant="primary" leftIcon={<PhoneIcon size={16} weight="fill" />} onClick={handleJoinCall}>
						<Trans>Accept</Trans>
					</Button>
					<Button
						variant="danger-primary"
						leftIcon={<XIcon size={16} weight="bold" />}
						onClick={handleRejectIncomingCall}
					>
						<Trans>Reject</Trans>
					</Button>
					<Button variant="secondary" onClick={handleIgnoreIncomingCall}>
						<Trans>Ignore</Trans>
					</Button>
				</>
			);
		}

		if (controlsVariant === 'join') {
			if (useVoiceControlBarStyle) {
				return renderVoiceControlBarButton({
					label: t`Join call`,
					icon: <PhoneIcon size={18} weight="fill" />,
					tone: 'primary',
					onClick: handleJoinCall,
					disabled: !currentChannelId,
				});
			}
			return (
				<Button
					variant="primary"
					leftIcon={<PhoneIcon size={16} weight="fill" />}
					onClick={handleJoinCall}
					disabled={!currentChannelId}
				>
					<Trans>Join call</Trans>
				</Button>
			);
		}

		if (controlsVariant === 'connecting') {
			if (useVoiceControlBarStyle) {
				return renderVoiceControlBarButton({
					label: t`Connecting...`,
					icon: <PhoneIcon size={18} weight="fill" />,
					tone: 'secondary',
					submitting: true,
				});
			}
			return (
				<Button variant="secondary" leftIcon={<PhoneIcon size={16} weight="fill" />} submitting>
					<Trans>Join call</Trans>
				</Button>
			);
		}

		if (controlsVariant === 'inCall' && !callHeaderState.isDeviceInRoomForChannelCall) {
			if (useVoiceControlBarStyle) {
				return renderVoiceControlBarButton({
					label: t`Join on this device`,
					icon: <PhoneIcon size={18} weight="fill" />,
					tone: 'primary',
					onClick: handleJoinCall,
					disabled: !currentChannelId,
				});
			}
			return (
				<Button
					variant="primary"
					leftIcon={<PhoneIcon size={16} weight="fill" />}
					onClick={handleJoinCall}
					disabled={!currentChannelId}
				>
					<Trans>In call on other device (join?)</Trans>
				</Button>
			);
		}

		return null;
	};

	const mobileCallControls = renderCallControls('mobile');
	const voiceControlBarCallControls = renderCallControls('voiceControlBar');

	if (!channel) {
		return (
			<div className={dmStyles.emptyState}>
				<ChatTeardropIcon weight="fill" className={dmStyles.emptyStateIcon} />
				<h2 className={dmStyles.emptyStateTitle}>
					<Trans>This conversation has been erased</Trans>
				</h2>
				<p className={dmStyles.emptyStateDescription}>
					<Trans>Think, McFly! Did you type the right address?</Trans>
				</p>
			</div>
		);
	}

	if (isDM && !recipient) {
		return (
			<div className={dmStyles.emptyState}>
				<ChatTeardropIcon weight="fill" className={dmStyles.emptyStateIcon} />
				<h2 className={dmStyles.emptyStateTitle}>
					<Trans>User has vanished</Trans>
				</h2>
				<p className={dmStyles.emptyStateDescription}>
					<Trans>They might have taken the DeLorean elsewhere.</Trans>
				</p>
			</div>
		);
	}

	if (VOICE_CALL_FULLSCREEN_ENABLED && showVoiceCallViewForFullscreen && callExistsAndOngoing) {
		return (
			<div className={styles.voiceChannelContainer}>
				<VoiceCallView channel={channel} fullscreenRequestNonce={voiceCallFullscreenRequestNonce} />
			</div>
		);
	}

	return (
		<>
			<ChannelViewScaffold
				className={showCallBackground ? styles.channelGridVoiceCallActive : undefined}
				header={
					<div className={showCallBackground ? styles.voiceActiveHeaderWrapper : undefined}>
						<ChannelHeader
							channel={channel}
							showMembersToggle={Boolean(isGroupDM)}
							showPins={!isSystemDm}
							onSearchSubmit={handleSearchSubmit}
							onSearchClose={handleSearchClose}
							isSearchResultsOpen={isSearchActive}
							forceVoiceCallStyle={isInCallVariant}
							voiceCallHeaderSupplement={compactVoiceCallHeaderSupplement}
						/>
						{callExistsAndOngoing &&
							call &&
							channel &&
							(isMobileExperience ? (
								<div className={dmStyles.callBannerMobile}>
									<div className={dmStyles.callBannerMobileLabel}>{callStatusLabel}</div>
									{(controlsVariant !== 'inCall' || !callHeaderState.isDeviceInRoomForChannelCall) &&
										mobileCallControls && <div className={dmStyles.callControlsMobile}>{mobileCallControls}</div>}
									<Button
										variant="secondary"
										onClick={handleOpenCallSheet}
										leftIcon={<PhoneIcon size={16} weight="fill" />}
									>
										{callSheetButtonLabel}
									</Button>
								</div>
							) : showCompactVoiceView ? (
								<div className={dmStyles.compactCallWrapper}>
									<CompactVoiceCallView
										channel={channel}
										className={dmStyles.compactVoiceCallView}
										avatarFallback={
											<div className={dmStyles.compactCallParticipantsLayout}>
												<CallParticipantsRow
													call={call}
													channel={channel}
													participantAvatarEntries={participantAvatarEntries}
													className={dmStyles.compactCallParticipantsRow}
												/>
											</div>
										}
										onFullscreenRequest={VOICE_CALL_FULLSCREEN_ENABLED ? handleOpenVoiceCallFullscreenView : undefined}
									/>
								</div>
							) : (
								<div
									className={clsx(
										dmStyles.compactCallWrapper,
										isResizingCompactCallBanner && dmStyles.compactCallWrapperResizing,
									)}
									style={compactCallBannerWrapperStyle}
								>
									<div className={clsx(dmStyles.callBanner, isCompactCallResizable && dmStyles.callBannerResizable)}>
										<div className={dmStyles.callBannerBody}>
											{!hasActiveCallMedia && (
												<CallParticipantsRow
													call={call}
													channel={channel}
													participantAvatarEntries={participantAvatarEntries}
												/>
											)}
										</div>
										{voiceControlBarCallControls && (
											<footer className={dmStyles.callControlBarSection}>
												<div className={dmStyles.callControlBarInner}>
													<div className={dmStyles.callControls}>{voiceControlBarCallControls}</div>
												</div>
											</footer>
										)}
									</div>
									{isCompactCallResizable && (
										<div
											className={dmStyles.compactCallResizeHandle}
											onPointerDown={handleCompactCallResizePointerDown}
											onKeyDown={handleCompactCallResizeKeyDown}
											role="separator"
											aria-orientation="horizontal"
											aria-label={t`Resize Call View`}
											aria-valuemin={compactCallHeightMin}
											aria-valuemax={compactCallMaxHeight}
											aria-valuenow={compactCallBannerHeight ?? compactCallHeightMin}
											tabIndex={0}
										>
											<div className={dmStyles.compactCallResizePill} />
										</div>
									)}
								</div>
							))}
					</div>
				}
				chatArea={
					<ChannelChatLayout
						channel={channel}
						messages={
							<Messages key={channel.id} channel={channel} onBottomBarVisibilityChange={setHasMessagesBottomBar} />
						}
						textarea={
							isSystemDm ? (
								<SystemDmBarrier />
							) : isDM && isRecipientBlocked && recipient ? (
								<BlockedUserBarrier userId={recipient.id} username={recipient.username} />
							) : isCurrentUserUnclaimed && isDM && !isPersonalNotes && !isGroupDM ? (
								<UnclaimedDMBarrier />
							) : (
								<ChannelTextarea channel={channel} />
							)
						}
						hideSlowmodeIndicator={hasMessagesBottomBar}
					/>
				}
				sidePanel={
					isSearchActive ? (
						<div className={styles.searchPanel}>
							<ChannelSearchResults
								channel={channel}
								searchQuery={activeSearchQuery}
								searchSegments={activeSearchSegments}
								refreshKey={searchRefreshKey}
								onClose={() => searchState.setIsSearchActive(false)}
							/>
						</div>
					) : shouldRenderMemberList ? (
						<ChannelMembers channel={channel} />
					) : null
				}
			/>
			{callExistsAndOngoing && call && channel && (
				<DirectCallLobbyBottomSheet isOpen={isCallSheetOpen} onClose={handleCloseCallSheet} channel={channel} />
			)}
		</>
	);
});
