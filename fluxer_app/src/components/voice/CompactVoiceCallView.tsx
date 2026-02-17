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

import {ChannelHeaderIcon} from '@app/components/channel/channel_header_components/ChannelHeaderIcon';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import styles from '@app/components/voice/CompactVoiceCallView.module.css';
import {useVoiceCallAppFullscreen} from '@app/components/voice/useVoiceCallAppFullscreen';
import {useVoiceCallTracksAndLayout} from '@app/components/voice/useVoiceCallTracksAndLayout';
import {VoiceCallLayoutContent} from '@app/components/voice/VoiceCallLayoutContent';
import voiceCallStyles from '@app/components/voice/VoiceCallView.module.css';
import {VoiceControlBar} from '@app/components/voice/VoiceControlBar';
import {
	useVoiceParticipantAvatarEntries,
	VoiceParticipantWrappedAvatarList,
} from '@app/components/voice/VoiceParticipantAvatarList';
import {VoiceParticipantTile} from '@app/components/voice/VoiceParticipantTile';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import CallStateStore from '@app/stores/CallStateStore';
import CompactVoiceCallHeightStore, {
	COMPACT_VOICE_CALL_HEIGHT_MAX,
	COMPACT_VOICE_CALL_HEIGHT_MIN,
} from '@app/stores/CompactVoiceCallHeightStore';
import CompactVoiceCallPiPPositionStore from '@app/stores/CompactVoiceCallPiPPositionStore';
import ContextMenuStore, {isContextMenuNodeTarget} from '@app/stores/ContextMenuStore';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {useLingui} from '@lingui/react/macro';
import {
	ParticipantContext,
	TrackRefContext,
	type TrackReferenceOrPlaceholder,
	useConnectionState,
	useParticipants,
} from '@livekit/components-react';
import {CornersInIcon, CornersOutIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {ConnectionState, type Participant, Track} from 'livekit-client';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';

interface CompactVoiceCallViewProps {
	channel: ChannelRecord;
	className?: string;
	hideHeader?: boolean;
	hideControlBar?: boolean;
	controlBar?: React.ReactNode;
	avatarFallback?: React.ReactNode;
	showAvatarFallback?: boolean;
	onFullscreenRequest?: () => void;
}

interface ResizeListeners {
	move: (event: PointerEvent) => void;
	up: (event: PointerEvent) => void;
}

interface ResizeState {
	pointerId: number;
	startY: number;
	startHeight: number;
	dragging: boolean;
	lastHeight?: number;
}

interface NormalizedPiPPosition {
	x: number;
	y: number;
}

interface CompactPiPDragState {
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startOffsetX: number;
	startOffsetY: number;
}

interface CompactPiPMetrics {
	viewportWidth: number;
	viewportHeight: number;
	overlayWidth: number;
	overlayHeight: number;
}

const COMPACT_HEIGHT_DRAG_THRESHOLD_SQ = 9;
const COMPACT_HEIGHT_MIN = COMPACT_VOICE_CALL_HEIGHT_MIN;
const COMPACT_HEIGHT_VIEWPORT_MARGIN = 32;
const COMPACT_HEIGHT_STEP = 16;
const VOICE_HUD_IDLE_TIMEOUT_MS = 3000;
const COMPACT_PIP_EDGE_MARGIN = 12;

function clampNormalizedPosition(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}
	return Math.max(0, Math.min(1, value));
}

function useConnectionLabel(state: ConnectionState, participantCount: number) {
	const {t} = useLingui();
	return useMemo(() => {
		switch (state) {
			case ConnectionState.Connecting:
				return t`Connecting…`;
			case ConnectionState.Reconnecting:
				return t`Reconnecting…`;
			case ConnectionState.Disconnected:
				return t`Disconnected`;
			default:
				return participantCount === 1 ? t`Voice Connected` : t`${participantCount} in call`;
		}
	}, [state, participantCount, t]);
}

function getCompactHeightKey(channelId: string, callMessageId: string | null) {
	return callMessageId ? `${channelId}:${callMessageId}` : channelId;
}

function getCompactHeightMax(compactHeightMin: number): number {
	const viewportLimitedMax = Math.round(window.innerHeight - COMPACT_HEIGHT_VIEWPORT_MARGIN);
	return Math.max(compactHeightMin, Math.min(viewportLimitedMax, COMPACT_VOICE_CALL_HEIGHT_MAX));
}

function hasValidRoomForCompactVoiceCall(channel: ChannelRecord): boolean {
	const room = MediaEngineStore.room;
	if (!room) return false;
	const normalizedGuildId = channel.guildId ?? null;
	return MediaEngineStore.channelId === channel.id && (MediaEngineStore.guildId ?? null) === normalizedGuildId;
}

const CompactVoiceCallViewInner: React.FC<CompactVoiceCallViewProps> = observer(function CompactVoiceCallViewInner({
	channel,
	className,
	hideHeader = false,
	hideControlBar = false,
	controlBar,
	avatarFallback,
	showAvatarFallback = true,
	onFullscreenRequest,
}) {
	const {t} = useLingui();
	const containerRef = useRef<HTMLElement>(null);
	const hudPointerTimeoutRef = useRef<number | null>(null);
	const {keyboardModeEnabled} = KeyboardModeStore;
	const participants = useParticipants();
	const connectionState = useConnectionState();
	const isMobile = MobileLayoutStore.isMobileLayout();
	const [isPointerHudActive, setIsPointerHudActive] = useState(false);
	const isResizable = !isMobile;
	const {
		isFullscreen: isVoiceCallAppFullscreen,
		supportsFullscreen: supportsVoiceCallAppFullscreen,
		toggleFullscreen: toggleVoiceCallAppFullscreen,
	} = useVoiceCallAppFullscreen({containerRef});
	const {
		layoutMode,
		pinnedParticipantIdentity,
		hasScreenShare,
		cameraTracksAll,
		screenShareTracks,
		filteredCameraTracks,
		focusMainTrack,
		carouselTracks,
	} = useVoiceCallTracksAndLayout({channel});
	const compactHeightMin = COMPACT_HEIGHT_MIN;

	const call = CallStateStore.getCall(channel.id);
	const heightKey = useMemo(
		() => getCompactHeightKey(channel.id, call?.messageId ?? null),
		[channel.id, call?.messageId],
	);

	const resizeStateRef = useRef<ResizeState | null>(null);
	const resizeListenersRef = useRef<ResizeListeners | null>(null);
	const compactHeightKeyRef = useRef(heightKey);
	const [isResizing, setIsResizing] = useState(false);
	const contentAreaRef = useRef<HTMLDivElement | null>(null);
	const floatingPiPRef = useRef<HTMLDivElement | null>(null);
	const floatingPiPDragStateRef = useRef<CompactPiPDragState | null>(null);
	const [isDraggingFloatingPiP, setIsDraggingFloatingPiP] = useState(false);
	const [floatingPiPPosition, setFloatingPiPPosition] = useState<NormalizedPiPPosition>(() =>
		CompactVoiceCallPiPPositionStore.getPosition(),
	);
	const floatingPiPPositionRef = useRef<NormalizedPiPPosition>(floatingPiPPosition);
	const [floatingPiPMetrics, setFloatingPiPMetrics] = useState<CompactPiPMetrics>({
		viewportWidth: 0,
		viewportHeight: 0,
		overlayWidth: 0,
		overlayHeight: 0,
	});

	const [compactHeight, setCompactHeight] = useState<number | null>(() =>
		isResizable ? (CompactVoiceCallHeightStore.getStartingHeight(heightKey) ?? null) : null,
	);
	const [maxHeight, setMaxHeight] = useState(() => getCompactHeightMax(compactHeightMin));

	const clampHeight = useCallback(
		(value: number) => Math.max(compactHeightMin, Math.min(Math.round(value), maxHeight)),
		[compactHeightMin, maxHeight],
	);
	const setCompactHeightForKey = useCallback(
		(nextHeight: number, options: {persist?: boolean} = {}) => {
			const normalizedHeight = clampHeight(nextHeight);
			if (isResizable && options.persist) {
				const persistedHeight = CompactVoiceCallHeightStore.setHeightForKey(heightKey, normalizedHeight);
				setCompactHeight(persistedHeight);
				return;
			}
			setCompactHeight(normalizedHeight);
		},
		[clampHeight, heightKey, isResizable],
	);

	useEffect(() => {
		if (!isResizable) return;

		const handleResize = () => {
			const nextMax = getCompactHeightMax(compactHeightMin);
			setMaxHeight(nextMax);
		};

		handleResize();
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [compactHeightMin, isResizable]);

	useEffect(() => {
		if (!isResizable) return;
		const storedHeight = CompactVoiceCallHeightStore.getStartingHeight(heightKey);
		if (storedHeight != null) {
			setCompactHeightForKey(storedHeight);
			return;
		}
		setCompactHeight(null);
	}, [heightKey, isResizable, setCompactHeightForKey]);

	useEffect(() => {
		if (!isResizable || compactHeight == null) return;
		compactHeightKeyRef.current = heightKey;
	}, [compactHeight, heightKey, isResizable]);

	useEffect(() => {
		if (!isResizable || compactHeight == null) return;
		if (compactHeightKeyRef.current !== heightKey) return;
		if (compactHeight > maxHeight) {
			setCompactHeightForKey(maxHeight);
			return;
		}
		if (compactHeight < compactHeightMin) {
			setCompactHeightForKey(compactHeightMin);
		}
	}, [compactHeight, compactHeightMin, heightKey, isResizable, maxHeight, setCompactHeightForKey]);

	useLayoutEffect(() => {
		if (!isResizable) return;
		if (compactHeight != null) return;
		const container = containerRef.current;
		if (!container) return;
		const measured = container.getBoundingClientRect().height;
		if (!Number.isFinite(measured) || measured <= 0) return;
		setCompactHeightForKey(measured);
	}, [compactHeight, isResizable, setCompactHeightForKey]);

	useEffect(() => {
		if (!isResizing) return;
		const prevCursor = document.body.style.cursor;
		const prevSelect = document.body.style.userSelect;
		document.body.style.cursor = 'ns-resize';
		document.body.style.userSelect = 'none';
		return () => {
			document.body.style.cursor = prevCursor;
			document.body.style.userSelect = prevSelect;
		};
	}, [isResizing]);

	const participantAvatarEntries = useVoiceParticipantAvatarEntries({
		guildId: channel.guildId ?? null,
		channelId: channel.id,
	});
	const hasActiveCallMedia = useMemo(
		() => participantAvatarEntries.some((entry) => entry.hasCamera || entry.hasScreenShare),
		[participantAvatarEntries],
	);
	const isFocusedOnScreenShare =
		layoutMode === 'focus' && focusMainTrack != null && focusMainTrack.source === Track.Source.ScreenShare;
	const floatingPiPTrack = useMemo(() => {
		if (!isFocusedOnScreenShare || !focusMainTrack) return null;
		const screenShareParticipant = focusMainTrack.participant;
		return (
			carouselTracks.find(
				(track) =>
					track.participant.identity === screenShareParticipant.identity && track.source === Track.Source.Camera,
			) ?? null
		);
	}, [isFocusedOnScreenShare, focusMainTrack, carouselTracks]);
	const shouldRenderFloatingPiP = floatingPiPTrack != null;
	const shouldShowAvatarFallback = showAvatarFallback && !hasActiveCallMedia;
	const shouldUseDefaultAvatarFallbackLayout = shouldShowAvatarFallback && !avatarFallback;
	const shouldForceFloatingHudVisible = shouldShowAvatarFallback;
	const isAnyContextMenuOpen = useMemo(() => {
		const contextMenu = ContextMenuStore.contextMenu;
		const target = contextMenu?.target?.target ?? null;
		const container = containerRef.current;
		if (!contextMenu || !container || !isContextMenuNodeTarget(target)) return false;
		return Boolean(container.contains(target));
	}, [ContextMenuStore.contextMenu]);

	const participantCount = participants.length;
	const statusText = useConnectionLabel(connectionState, participantCount);

	const ariaLabel = useMemo(() => {
		if (connectionState !== ConnectionState.Connected) return statusText;
		return t`Voice call. ${statusText}.`;
	}, [connectionState, statusText, t]);

	const containerClassName = clsx(
		styles.container,
		voiceCallStyles.voiceRoot,
		className,
		hideHeader && styles.containerNoHeader,
		isResizing && styles.containerResizing,
		shouldForceFloatingHudVisible && voiceCallStyles.forceHudVisible,
		isPointerHudActive && voiceCallStyles.pointerActive,
		isAnyContextMenuOpen && voiceCallStyles.contextMenuActive,
		keyboardModeEnabled && voiceCallStyles.keyboardModeActive,
	);
	const controlBarContent = hideControlBar ? null : (controlBar ?? <VoiceControlBar />);

	const handleToggleVoiceCallAppFullscreen = useCallback(() => {
		if (!isVoiceCallAppFullscreen && onFullscreenRequest) {
			onFullscreenRequest();
			return;
		}
		void toggleVoiceCallAppFullscreen();
	}, [isVoiceCallAppFullscreen, onFullscreenRequest, toggleVoiceCallAppFullscreen]);
	const fullscreenButtonLabel = isVoiceCallAppFullscreen ? t`Exit fullscreen` : t`Enter fullscreen`;
	const FullscreenButtonIcon = useMemo(() => {
		const BaseIcon = isVoiceCallAppFullscreen ? CornersInIcon : CornersOutIcon;
		const BoldIcon = forwardRef<SVGSVGElement, React.ComponentProps<typeof BaseIcon>>((props, ref) => (
			<BaseIcon ref={ref} weight="bold" {...props} />
		));
		BoldIcon.displayName = 'FullscreenButtonIcon';
		return BoldIcon;
	}, [isVoiceCallAppFullscreen]);
	const clearHudPointerTimeout = useCallback(() => {
		if (hudPointerTimeoutRef.current == null) return;
		window.clearTimeout(hudPointerTimeoutRef.current);
		hudPointerTimeoutRef.current = null;
	}, []);
	const scheduleHudIdleState = useCallback(() => {
		clearHudPointerTimeout();
		hudPointerTimeoutRef.current = window.setTimeout(() => {
			hudPointerTimeoutRef.current = null;
			setIsPointerHudActive(false);
		}, VOICE_HUD_IDLE_TIMEOUT_MS);
	}, [clearHudPointerTimeout]);
	const handleVoiceRootPointerActivity = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			if (event.pointerType === 'touch') return;
			setIsPointerHudActive(true);
			scheduleHudIdleState();
		},
		[scheduleHudIdleState],
	);
	const handleVoiceRootPointerLeave = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			if (event.pointerType === 'touch') return;
			clearHudPointerTimeout();
			setIsPointerHudActive(false);
		},
		[clearHudPointerTimeout],
	);
	const getFloatingPiPDragBounds = useCallback(() => {
		const maxX = Math.max(
			0,
			floatingPiPMetrics.viewportWidth - floatingPiPMetrics.overlayWidth - COMPACT_PIP_EDGE_MARGIN * 2,
		);
		const maxY = Math.max(
			0,
			floatingPiPMetrics.viewportHeight - floatingPiPMetrics.overlayHeight - COMPACT_PIP_EDGE_MARGIN * 2,
		);
		return {maxX, maxY};
	}, [
		floatingPiPMetrics.overlayHeight,
		floatingPiPMetrics.overlayWidth,
		floatingPiPMetrics.viewportHeight,
		floatingPiPMetrics.viewportWidth,
	]);

	useEffect(() => {
		floatingPiPPositionRef.current = floatingPiPPosition;
	}, [floatingPiPPosition]);

	useLayoutEffect(() => {
		if (!shouldRenderFloatingPiP) {
			return;
		}
		const contentAreaNode = contentAreaRef.current;
		const floatingPiPNode = floatingPiPRef.current;
		if (!contentAreaNode || !floatingPiPNode) {
			return;
		}

		const recomputeMetrics = () => {
			const contentAreaRect = contentAreaNode.getBoundingClientRect();
			const floatingPiPRect = floatingPiPNode.getBoundingClientRect();
			setFloatingPiPMetrics((previousMetrics) => {
				const nextMetrics: CompactPiPMetrics = {
					viewportWidth: contentAreaRect.width,
					viewportHeight: contentAreaRect.height,
					overlayWidth: floatingPiPRect.width,
					overlayHeight: floatingPiPRect.height,
				};
				if (
					Math.abs(previousMetrics.viewportWidth - nextMetrics.viewportWidth) < 0.5 &&
					Math.abs(previousMetrics.viewportHeight - nextMetrics.viewportHeight) < 0.5 &&
					Math.abs(previousMetrics.overlayWidth - nextMetrics.overlayWidth) < 0.5 &&
					Math.abs(previousMetrics.overlayHeight - nextMetrics.overlayHeight) < 0.5
				) {
					return previousMetrics;
				}
				return nextMetrics;
			});
		};

		recomputeMetrics();

		if (typeof ResizeObserver === 'undefined') {
			return;
		}

		const resizeObserver = new ResizeObserver(() => {
			recomputeMetrics();
		});
		resizeObserver.observe(contentAreaNode);
		resizeObserver.observe(floatingPiPNode);

		return () => {
			resizeObserver.disconnect();
		};
	}, [shouldRenderFloatingPiP]);

	const handleFloatingPiPDragPointerMove = useCallback(
		(event: PointerEvent) => {
			const dragState = floatingPiPDragStateRef.current;
			if (!dragState || dragState.pointerId !== event.pointerId) {
				return;
			}
			const {maxX, maxY} = getFloatingPiPDragBounds();
			const deltaX = event.clientX - dragState.startClientX;
			const deltaY = event.clientY - dragState.startClientY;
			const nextOffsetX = Math.max(0, Math.min(maxX, dragState.startOffsetX + deltaX));
			const nextOffsetY = Math.max(0, Math.min(maxY, dragState.startOffsetY + deltaY));
			const nextPosition: NormalizedPiPPosition = {
				x: maxX > 0 ? clampNormalizedPosition(nextOffsetX / maxX) : 0,
				y: maxY > 0 ? clampNormalizedPosition(nextOffsetY / maxY) : 0,
			};
			setFloatingPiPPosition((previousPosition) => {
				if (
					Math.abs(previousPosition.x - nextPosition.x) < 0.001 &&
					Math.abs(previousPosition.y - nextPosition.y) < 0.001
				) {
					return previousPosition;
				}
				return nextPosition;
			});
		},
		[getFloatingPiPDragBounds],
	);

	const handleFloatingPiPDragPointerUp = useCallback((event: PointerEvent) => {
		const dragState = floatingPiPDragStateRef.current;
		if (!dragState || dragState.pointerId !== event.pointerId) {
			return;
		}
		floatingPiPDragStateRef.current = null;
		setIsDraggingFloatingPiP(false);
		CompactVoiceCallPiPPositionStore.setPosition(floatingPiPPositionRef.current);
	}, []);

	useEffect(() => {
		if (!isDraggingFloatingPiP) {
			return;
		}
		window.addEventListener('pointermove', handleFloatingPiPDragPointerMove);
		window.addEventListener('pointerup', handleFloatingPiPDragPointerUp);
		window.addEventListener('pointercancel', handleFloatingPiPDragPointerUp);
		return () => {
			window.removeEventListener('pointermove', handleFloatingPiPDragPointerMove);
			window.removeEventListener('pointerup', handleFloatingPiPDragPointerUp);
			window.removeEventListener('pointercancel', handleFloatingPiPDragPointerUp);
		};
	}, [handleFloatingPiPDragPointerMove, handleFloatingPiPDragPointerUp, isDraggingFloatingPiP]);

	const handleFloatingPiPDragPointerDown = useCallback(
		(event: React.PointerEvent<HTMLButtonElement>) => {
			if (event.button !== 0) {
				return;
			}
			const dragHandleNode = event.currentTarget;
			const {maxX, maxY} = getFloatingPiPDragBounds();
			dragHandleNode.setPointerCapture(event.pointerId);
			event.preventDefault();
			event.stopPropagation();
			const startOffsetX = maxX > 0 ? clampNormalizedPosition(floatingPiPPosition.x) * maxX : 0;
			const startOffsetY = maxY > 0 ? clampNormalizedPosition(floatingPiPPosition.y) * maxY : 0;
			floatingPiPDragStateRef.current = {
				pointerId: event.pointerId,
				startClientX: event.clientX,
				startClientY: event.clientY,
				startOffsetX,
				startOffsetY,
			};
			setIsDraggingFloatingPiP(true);
		},
		[floatingPiPPosition.x, floatingPiPPosition.y, getFloatingPiPDragBounds],
	);

	const floatingPiPStyle = useMemo(() => {
		const {maxX, maxY} = getFloatingPiPDragBounds();
		const offsetX = COMPACT_PIP_EDGE_MARGIN + clampNormalizedPosition(floatingPiPPosition.x) * maxX;
		const offsetY = COMPACT_PIP_EDGE_MARGIN + clampNormalizedPosition(floatingPiPPosition.y) * maxY;
		return {
			transform: `translate3d(${Math.round(offsetX)}px, ${Math.round(offsetY)}px, 0)`,
		} satisfies React.CSSProperties;
	}, [floatingPiPPosition.x, floatingPiPPosition.y, getFloatingPiPDragBounds]);

	const containerStyle = useMemo(() => {
		if (!isResizable || compactHeight == null) return undefined;
		return {
			height: compactHeight,
			minHeight: compactHeightMin,
			maxHeight,
		} satisfies React.CSSProperties;
	}, [compactHeight, compactHeightMin, isResizable, maxHeight]);

	const layoutNode = useMemo(
		() => (
			<div className={styles.layoutHost}>
				<VoiceCallLayoutContent
					channel={channel}
					layoutMode={layoutMode}
					focusMainTrack={focusMainTrack}
					carouselTracks={carouselTracks}
					cameraTracksAll={cameraTracksAll}
					filteredCameraTracks={filteredCameraTracks}
					screenShareTracks={screenShareTracks}
					hasScreenShare={hasScreenShare}
					pinnedParticipantIdentity={pinnedParticipantIdentity}
					compact={true}
				/>
			</div>
		),
		[
			carouselTracks,
			cameraTracksAll,
			channel,
			filteredCameraTracks,
			focusMainTrack,
			hasScreenShare,
			layoutMode,
			pinnedParticipantIdentity,
			screenShareTracks,
		],
	);
	const directCallAvatarLayoutNode = useMemo(
		() => (
			<div className={styles.audioAvatarLayout}>
				<VoiceParticipantWrappedAvatarList
					entries={participantAvatarEntries}
					guildId={channel.guildId}
					channelId={channel.id}
					className={styles.audioAvatarList}
				/>
			</div>
		),
		[channel.guildId, channel.id, participantAvatarEntries],
	);
	const avatarFallbackNode = useMemo(
		() => avatarFallback ?? directCallAvatarLayoutNode,
		[avatarFallback, directCallAvatarLayoutNode],
	);

	const cleanupResizeListeners = useCallback(() => {
		const listeners = resizeListenersRef.current;
		if (!listeners) return;
		window.removeEventListener('pointermove', listeners.move);
		window.removeEventListener('pointerup', listeners.up);
		window.removeEventListener('pointercancel', listeners.up);
		resizeListenersRef.current = null;
	}, []);

	const handleResizePointerMove = useCallback(
		(event: PointerEvent) => {
			if (!isResizable) return;
			const state = resizeStateRef.current;
			if (!state || state.pointerId !== event.pointerId) return;

			const deltaY = event.clientY - state.startY;
			if (!state.dragging) {
				if (deltaY * deltaY <= COMPACT_HEIGHT_DRAG_THRESHOLD_SQ) return;
				state.dragging = true;
				setIsResizing(true);
			}

			const nextHeight = clampHeight(state.startHeight + deltaY);
			state.lastHeight = nextHeight;
			setCompactHeightForKey(nextHeight);
		},
		[clampHeight, isResizable, setCompactHeightForKey],
	);

	const handleResizePointerUp = useCallback(
		(event: PointerEvent) => {
			if (!isResizable) return;
			const state = resizeStateRef.current;
			if (!state || state.pointerId !== event.pointerId) return;
			cleanupResizeListeners();
			if (state.dragging) {
				setIsResizing(false);
				if (state.lastHeight != null) {
					setCompactHeightForKey(state.lastHeight, {persist: true});
				}
			}
			resizeStateRef.current = null;
		},
		[cleanupResizeListeners, isResizable, setCompactHeightForKey],
	);

	const handleResizePointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (!isResizable || event.button !== 0) return;
			event.preventDefault();
			event.stopPropagation();

			const container = containerRef.current;
			const startHeight =
				compactHeight ??
				container?.getBoundingClientRect().height ??
				CompactVoiceCallHeightStore.getStartingHeight(heightKey) ??
				compactHeightMin;

			resizeStateRef.current = {
				pointerId: event.pointerId,
				startY: event.clientY,
				startHeight,
				dragging: false,
			};

			const moveListener = (moveEvent: PointerEvent) => handleResizePointerMove(moveEvent);
			const upListener = (upEvent: PointerEvent) => handleResizePointerUp(upEvent);

			resizeListenersRef.current = {
				move: moveListener,
				up: upListener,
			};

			window.addEventListener('pointermove', moveListener);
			window.addEventListener('pointerup', upListener);
			window.addEventListener('pointercancel', upListener);
		},
		[compactHeight, compactHeightMin, handleResizePointerMove, handleResizePointerUp, heightKey, isResizable],
	);

	const handleResizeKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>) => {
			if (!isResizable) return;
			if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
			event.preventDefault();
			const direction = event.key === 'ArrowUp' ? -1 : 1;
			const baseHeight = compactHeight ?? containerRef.current?.getBoundingClientRect().height ?? compactHeightMin;
			setCompactHeightForKey(baseHeight + COMPACT_HEIGHT_STEP * direction, {persist: true});
		},
		[compactHeight, compactHeightMin, isResizable, setCompactHeightForKey],
	);

	useEffect(() => {
		return () => {
			cleanupResizeListeners();
		};
	}, [cleanupResizeListeners]);
	useEffect(() => {
		return () => {
			clearHudPointerTimeout();
		};
	}, [clearHudPointerTimeout]);

	const controlBarNode = controlBarContent ? (
		<footer className={clsx(styles.controlBarSection, voiceCallStyles.voiceChrome)}>
			<div className={styles.controlBarInner}>{controlBarContent}</div>
		</footer>
	) : null;

	return (
		<section
			ref={containerRef}
			data-voice-call-root
			className={clsx(containerClassName, isVoiceCallAppFullscreen && voiceCallStyles.voiceCallFullscreen)}
			aria-label={ariaLabel}
			style={containerStyle}
			onPointerEnter={handleVoiceRootPointerActivity}
			onPointerMove={handleVoiceRootPointerActivity}
			onPointerDown={handleVoiceRootPointerActivity}
			onPointerLeave={handleVoiceRootPointerLeave}
		>
			<div
				ref={contentAreaRef}
				className={clsx(styles.contentArea, shouldUseDefaultAvatarFallbackLayout && styles.contentAreaAvatarsOnly)}
			>
				{hasActiveCallMedia ? layoutNode : shouldShowAvatarFallback ? avatarFallbackNode : null}
				{shouldRenderFloatingPiP && floatingPiPTrack && (
					<div className={styles.floatingPiPLayer}>
						<div
							ref={floatingPiPRef}
							className={clsx(styles.floatingPiPSurface, isDraggingFloatingPiP && styles.floatingPiPSurfaceDragging)}
							style={floatingPiPStyle}
						>
							<button
								type="button"
								className={styles.floatingPiPDragHandle}
								onPointerDown={handleFloatingPiPDragPointerDown}
								aria-label={t`Move floating call tile`}
							>
								<span className={styles.floatingPiPDragHandlePill} />
							</button>
							<div className={styles.floatingPiPContent}>
								<TrackRefContext.Provider value={floatingPiPTrack as TrackReferenceOrPlaceholder}>
									<ParticipantContext.Provider
										value={(floatingPiPTrack as TrackReferenceOrPlaceholder).participant as Participant}
									>
										<VoiceParticipantTile guildId={channel.guildId} channelId={channel.id} showFocusIndicator={false} />
									</ParticipantContext.Provider>
								</TrackRefContext.Provider>
							</div>
						</div>
					</div>
				)}
			</div>

			{controlBarNode}

			<div className={clsx(styles.fullscreenButtonWrap, voiceCallStyles.voiceChrome)}>
				{supportsVoiceCallAppFullscreen && (
					<ChannelHeaderIcon
						icon={FullscreenButtonIcon}
						label={fullscreenButtonLabel}
						isSelected={isVoiceCallAppFullscreen}
						onClick={handleToggleVoiceCallAppFullscreen}
					/>
				)}
			</div>

			{isResizable && (
				<FocusRing offset={-2}>
					<div
						className={clsx(styles.resizeHandle, voiceCallStyles.voiceChrome)}
						onPointerDown={handleResizePointerDown}
						onKeyDown={handleResizeKeyDown}
						role="separator"
						aria-orientation="horizontal"
						aria-label={t`Resize Call View`}
						aria-valuemin={compactHeightMin}
						aria-valuemax={maxHeight}
						aria-valuenow={compactHeight ?? compactHeightMin}
						tabIndex={0}
					>
						<div className={styles.resizePill} />
					</div>
				</FocusRing>
			)}
		</section>
	);
});

export const CompactVoiceCallView: React.FC<CompactVoiceCallViewProps> = observer(function CompactVoiceCallView(props) {
	if (!hasValidRoomForCompactVoiceCall(props.channel)) {
		return null;
	}
	return <CompactVoiceCallViewInner {...props} />;
});
