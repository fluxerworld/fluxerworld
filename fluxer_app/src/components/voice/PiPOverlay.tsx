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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import * as VoiceSettingsActionCreators from '@app/actions/VoiceSettingsActionCreators';
import {DisablePiPConfirmModal} from '@app/components/modals/DisablePiPConfirmModal';
import {Avatar} from '@app/components/uikit/Avatar';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {FeedHiddenOverlay} from '@app/components/voice/FeedHiddenOverlay';
import {getPlaceholderAvatarColor} from '@app/components/voice/GetPlaceholderAvatarColor';
import {HiddenStreamPlaceholder} from '@app/components/voice/HiddenStreamPlaceholder';
import {
	getOwnStreamHiddenState,
	useOwnScreenSharePreviewState,
	useWindowFocus,
} from '@app/components/voice/OwnStreamPreviewState';
import '@app/components/voice/VoiceCallView.module.css';
import styles from '@app/components/voice/PiPOverlay.module.css';
import {getStreamKey, parseStreamKey} from '@app/components/voice/StreamKeys';
import {useStreamSpectators} from '@app/components/voice/useStreamSpectators';
import {useStreamWatchState} from '@app/components/voice/useStreamWatchState';
import {
	isVoiceParticipantActuallySpeaking,
	parseVoiceParticipantIdentity,
} from '@app/components/voice/VoiceParticipantSpeakingUtils';
import voiceParticipantTileStyles from '@app/components/voice/VoiceParticipantTile.module.css';
import {Logger} from '@app/lib/Logger';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import ChannelStore from '@app/stores/ChannelStore';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import PiPStore, {PIP_DEFAULT_WIDTH, type PiPContent} from '@app/stores/PiPStore';
import UserStore from '@app/stores/UserStore';
import VoiceSettingsStore from '@app/stores/VoiceSettingsStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {dimColor} from '@app/utils/ColorUtils';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {DEFAULT_ACCENT_COLOR, ME} from '@fluxer/constants/src/AppConstants';
import {useLingui} from '@lingui/react/macro';
import {isTrackReference, type TrackReferenceOrPlaceholder, useTracks, VideoTrack} from '@livekit/components-react';
import {ArrowLeftIcon, EyeIcon, PauseIcon, PhoneXIcon, XIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import type {AnimationPlaybackControls, SpringOptions} from 'framer-motion';
import {animate, motion, type PanInfo, useDragControls, useMotionValue} from 'framer-motion';
import {type Room, RoomEvent, Track} from 'livekit-client';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

const PIP_ASPECT_RATIO = 16 / 9;
const PIP_MAX_WIDTH = 720;
const PIP_MIN_WIDTH = 240;
const EDGE_PADDING = 20;

const FLING_TIME_SECONDS = 0.25;
const STRONG_FLING_VELOCITY = 550;
const MIN_AXIS_VELOCITY = 180;

type Corner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

interface CornerPosition {
	x: number;
	y: number;
}

interface DragBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

interface ResizeListeners {
	move: (event: PointerEvent) => void;
	up: (event: PointerEvent) => void;
}

type ResizeEdge = 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface ResizeState {
	pointerId: number;
	edge: ResizeEdge;
	startX: number;
	startY: number;
	startWidth: number;
	startPosX: number;
	startPosY: number;
}

const SNAP_SPRING: SpringOptions = {
	stiffness: 520,
	damping: 42,
	mass: 0.9,
	bounce: 0.35,
};

const INTERACTION_SPRING: SpringOptions = {
	stiffness: 520,
	damping: 38,
	mass: 0.8,
};
const logger = new Logger('PiPOverlay');

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function getPiPHeight(width: number): number {
	return Math.round(width / PIP_ASPECT_RATIO);
}

function getViewportMaxWidth(viewportWidth: number, viewportHeight: number): number {
	const maxByWidth = Math.max(120, viewportWidth - EDGE_PADDING * 2);
	const maxByHeight = Math.max(120, (viewportHeight - EDGE_PADDING * 2) * PIP_ASPECT_RATIO);
	return Math.max(120, Math.min(PIP_MAX_WIDTH, maxByWidth, maxByHeight));
}

function getViewportMinWidth(viewportMaxWidth: number): number {
	return Math.min(PIP_MIN_WIDTH, viewportMaxWidth);
}

function clampPiPWidth(value: number, viewportWidth: number, viewportHeight: number): number {
	const viewportMaxWidth = getViewportMaxWidth(viewportWidth, viewportHeight);
	const viewportMinWidth = getViewportMinWidth(viewportMaxWidth);
	return clamp(Math.round(value), viewportMinWidth, viewportMaxWidth);
}

function getDragBounds(viewportWidth: number, viewportHeight: number, pipWidth: number, pipHeight: number): DragBounds {
	const maxX = Math.max(EDGE_PADDING, viewportWidth - pipWidth - EDGE_PADDING);
	const maxY = Math.max(EDGE_PADDING, viewportHeight - pipHeight - EDGE_PADDING);

	return {
		minX: EDGE_PADDING,
		maxX,
		minY: EDGE_PADDING,
		maxY,
	};
}

function getCornerPositions(
	viewportWidth: number,
	viewportHeight: number,
	pipWidth: number,
	pipHeight: number,
): Record<Corner, CornerPosition> {
	const bounds = getDragBounds(viewportWidth, viewportHeight, pipWidth, pipHeight);

	return {
		'top-left': {x: bounds.minX, y: bounds.minY},
		'top-right': {x: bounds.maxX, y: bounds.minY},
		'bottom-right': {x: bounds.maxX, y: bounds.maxY},
		'bottom-left': {x: bounds.minX, y: bounds.maxY},
	};
}

function pickCornerOnRelease(
	currentX: number,
	currentY: number,
	velocityX: number,
	velocityY: number,
	corners: Record<Corner, CornerPosition>,
	bounds: DragBounds,
): Corner {
	const projectedX = clamp(currentX + velocityX * FLING_TIME_SECONDS, bounds.minX, bounds.maxX);
	const projectedY = clamp(currentY + velocityY * FLING_TIME_SECONDS, bounds.minY, bounds.maxY);

	const speed = Math.hypot(velocityX, velocityY);
	const splitX = (bounds.minX + bounds.maxX) / 2;
	const splitY = (bounds.minY + bounds.maxY) / 2;

	if (speed >= STRONG_FLING_VELOCITY) {
		const horizontal =
			Math.abs(velocityX) >= MIN_AXIS_VELOCITY
				? velocityX >= 0
					? 'right'
					: 'left'
				: projectedX >= splitX
					? 'right'
					: 'left';
		const vertical =
			Math.abs(velocityY) >= MIN_AXIS_VELOCITY
				? velocityY >= 0
					? 'bottom'
					: 'top'
				: projectedY >= splitY
					? 'bottom'
					: 'top';

		return `${vertical}-${horizontal}` as Corner;
	}

	const entries = Object.entries(corners) as Array<[Corner, CornerPosition]>;
	let bestCorner = entries[0][0];
	let bestDist = Number.POSITIVE_INFINITY;

	for (const [corner, pos] of entries) {
		const dx = pos.x - projectedX;
		const dy = pos.y - projectedY;
		const dist = dx * dx + dy * dy;

		if (dist < bestDist) {
			bestDist = dist;
			bestCorner = corner;
		}
	}

	return bestCorner;
}

function useFindTrackRef(content: PiPContent | null, room: Room): TrackReferenceOrPlaceholder | null {
	const tracks = useTracks(
		[
			{source: Track.Source.Camera, withPlaceholder: true},
			{source: Track.Source.ScreenShare, withPlaceholder: true},
		],
		{
			updateOnlyOn: [
				RoomEvent.TrackPublished,
				RoomEvent.TrackUnpublished,
				RoomEvent.TrackSubscribed,
				RoomEvent.TrackUnsubscribed,
				RoomEvent.TrackMuted,
				RoomEvent.TrackUnmuted,
			],
			onlySubscribed: false,
			room,
		},
	);

	return useMemo(() => {
		if (!content) return null;

		const targetSource = content.type === 'stream' ? Track.Source.ScreenShare : Track.Source.Camera;
		const resolvedTrackRef =
			tracks.find((tr) => tr.participant.identity === content.participantIdentity && tr.source === targetSource) ??
			null;
		if (resolvedTrackRef) return resolvedTrackRef;
		if (content.type !== 'stream') return null;

		const hasMatchingViewerStreamKey = LocalVoiceStateStore.getViewerStreamKeys().some((streamKey) => {
			const parsed = parseStreamKey(streamKey);
			if (!parsed) return false;
			return (
				parsed.channelId === content.channelId &&
				parsed.guildId === content.guildId &&
				parsed.connectionId === content.connectionId
			);
		});
		if (!hasMatchingViewerStreamKey) return null;

		const fallbackParticipant =
			room.localParticipant.identity === content.participantIdentity
				? room.localParticipant
				: (Array.from(room.remoteParticipants.values()).find(
						(participant) => participant.identity === content.participantIdentity,
					) ?? null);
		if (!fallbackParticipant) return null;
		const publication = fallbackParticipant.getTrackPublication(Track.Source.ScreenShare);
		if (!publication) return null;
		return {
			participant: fallbackParticipant,
			source: Track.Source.ScreenShare,
			publication,
		};
	}, [tracks, content, room]);
}

interface PiPOverlayInnerProps {
	content: PiPContent;
	room: Room;
}

const PiPOverlayInner = observer(function PiPOverlayInner({content, room}: PiPOverlayInnerProps) {
	const {t} = useLingui();
	const corner = PiPStore.getEffectiveCorner();

	const trackRef = useFindTrackRef(content, room);
	const channel = ChannelStore.getChannel(content.channelId);
	const participantUser = UserStore.getUser(content.userId);
	const currentUser = UserStore.getCurrentUser();
	const isWindowFocused = useWindowFocus();

	const isScreenShare = content.type === 'stream';
	const isOwnContent = currentUser?.id === content.userId;
	const isOwnScreenShare = isOwnContent && isScreenShare;
	const streamKey = useMemo(
		() => getStreamKey(content.guildId, content.channelId, content.connectionId),
		[content.guildId, content.channelId, content.connectionId],
	);

	const {viewerUsers} = useStreamSpectators(isScreenShare ? streamKey : '');
	const {isWatching} = useStreamWatchState({
		streamKey,
		guildId: content.guildId,
		channelId: content.channelId,
	});

	const displayName = useMemo(() => {
		if (!participantUser) return '';
		return (
			NicknameUtils.getNickname(participantUser, content.guildId ?? undefined, content.channelId) ||
			participantUser.username ||
			''
		);
	}, [participantUser, content.guildId, content.channelId]);

	const channelName = channel?.name ?? '';
	const participantIdentity = useMemo(
		() => parseVoiceParticipantIdentity(content.participantIdentity),
		[content.participantIdentity],
	);
	const pipConnectionId = participantIdentity.connectionId || content.connectionId;
	const voiceState = MediaEngineStore.getVoiceStateByConnectionId(pipConnectionId);

	const {isOwnScreenShareHidden, isOwnCameraHidden} = getOwnStreamHiddenState({
		isOwnContent,
		isScreenShare,
		showMyOwnCamera: VoiceSettingsStore.showMyOwnCamera,
		showMyOwnScreenShare: VoiceSettingsStore.showMyOwnScreenShare,
	});

	const [viewportSize, setViewportSize] = useState(() => ({
		width: window.innerWidth,
		height: window.innerHeight,
	}));
	const [pipWidth, setPipWidth] = useState(() =>
		clampPiPWidth(PiPStore.getWidth() || PIP_DEFAULT_WIDTH, window.innerWidth, window.innerHeight),
	);
	const [isResizing, setIsResizing] = useState(false);
	const [isDragging, setIsDragging] = useState(false);

	const videoRef = useRef<HTMLVideoElement | null>(null);
	const pipWidthRef = useRef(pipWidth);
	const placeholderColor = useMemo(
		() => getPlaceholderAvatarColor(participantUser, DEFAULT_ACCENT_COLOR),
		[participantUser],
	);
	const placeholderBackgroundColor = useMemo(() => dimColor(placeholderColor), [placeholderColor]);
	const pipAvatarSize = useMemo(() => clamp(Math.round(pipWidth * 0.28), 72, 168), [pipWidth]);
	const isParticipantActuallySpeaking = useMemo(() => {
		if (!trackRef) return false;
		return isVoiceParticipantActuallySpeaking({
			isSpeaking: trackRef.participant?.isSpeaking ?? false,
			voiceState,
			isMicrophoneEnabled: trackRef.participant?.isMicrophoneEnabled ?? false,
		});
	}, [trackRef, voiceState]);
	const hasVisibleMediaTrack = useMemo(() => {
		if (!trackRef || !isTrackReference(trackRef)) return false;
		const publication = trackRef.publication;
		return Boolean(publication?.track) && !publication?.isMuted;
	}, [trackRef]);

	const pipHeight = useMemo(() => getPiPHeight(pipWidth), [pipWidth]);

	const bounds = useMemo(
		() => getDragBounds(viewportSize.width, viewportSize.height, pipWidth, pipHeight),
		[viewportSize.width, viewportSize.height, pipHeight, pipWidth],
	);

	const cornerPositions = useMemo(
		() => getCornerPositions(viewportSize.width, viewportSize.height, pipWidth, pipHeight),
		[viewportSize.width, viewportSize.height, pipHeight, pipWidth],
	);

	const initialPosition = cornerPositions[corner];

	const x = useMotionValue(initialPosition.x);
	const y = useMotionValue(initialPosition.y);
	const dragControls = useDragControls();

	const isDraggingRef = useRef(false);
	const isResizingRef = useRef(false);
	const animRef = useRef<{x?: AnimationPlaybackControls; y?: AnimationPlaybackControls}>({});
	const resizeStateRef = useRef<ResizeState | null>(null);
	const resizeListenersRef = useRef<ResizeListeners | null>(null);

	const stopSnapAnimations = useCallback(() => {
		animRef.current.x?.stop();
		animRef.current.y?.stop();
		animRef.current = {};
	}, []);

	const snapToCorner = useCallback(
		(targetCorner: Corner, opts?: {immediate?: boolean}) => {
			const next = cornerPositions[targetCorner];
			stopSnapAnimations();

			if (opts?.immediate || AccessibilityStore.useReducedMotion) {
				x.set(next.x);
				y.set(next.y);
				return;
			}

			animRef.current.x = animate(x, next.x, SNAP_SPRING);
			animRef.current.y = animate(y, next.y, SNAP_SPRING);
		},
		[cornerPositions, stopSnapAnimations, x, y],
	);

	useEffect(() => {
		const handleResize = () => {
			setViewportSize({width: window.innerWidth, height: window.innerHeight});
		};
		window.addEventListener('resize', handleResize, {passive: true});
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	useEffect(() => {
		pipWidthRef.current = pipWidth;
	}, [pipWidth]);

	useEffect(() => {
		setPipWidth((prevWidth) => {
			const clampedWidth = clampPiPWidth(prevWidth, viewportSize.width, viewportSize.height);
			if (clampedWidth !== prevWidth) {
				PiPStore.setWidth(clampedWidth);
			}
			return clampedWidth;
		});
	}, [viewportSize.height, viewportSize.width]);

	useEffect(() => {
		if (isDraggingRef.current || isResizingRef.current) return;
		snapToCorner(corner);
	}, [corner, snapToCorner]);

	useEffect(() => {
		if (isDraggingRef.current || isResizingRef.current) return;
		x.set(clamp(x.get(), bounds.minX, bounds.maxX));
		y.set(clamp(y.get(), bounds.minY, bounds.maxY));
	}, [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY, x, y]);

	const cleanupResizeListeners = useCallback(() => {
		const listeners = resizeListenersRef.current;
		if (!listeners) return;
		window.removeEventListener('pointermove', listeners.move);
		window.removeEventListener('pointerup', listeners.up);
		window.removeEventListener('pointercancel', listeners.up);
		resizeListenersRef.current = null;
	}, []);

	const computeResizeDelta = useCallback(
		(edge: ResizeEdge, deltaX: number, deltaY: number): {deltaWidth: number; deltaPosX: number; deltaPosY: number} => {
			const deltaWidthFromHorizontal = edge.includes('right') ? deltaX : edge.includes('left') ? -deltaX : 0;
			const deltaWidthFromVertical = edge.includes('bottom')
				? deltaY * PIP_ASPECT_RATIO
				: edge.includes('top')
					? -deltaY * PIP_ASPECT_RATIO
					: 0;

			const deltaWidth =
				edge === 'top' || edge === 'bottom'
					? deltaWidthFromVertical
					: edge === 'left' || edge === 'right'
						? deltaWidthFromHorizontal
						: deltaWidthFromHorizontal + deltaWidthFromVertical;

			const deltaHeight = deltaWidth / PIP_ASPECT_RATIO;
			const deltaPosX = edge.includes('left') ? -deltaWidth : 0;
			const deltaPosY = edge.includes('top') ? -deltaHeight : 0;

			return {deltaWidth, deltaPosX, deltaPosY};
		},
		[],
	);

	const handleResizePointerMove = useCallback(
		(event: PointerEvent) => {
			const state = resizeStateRef.current;
			if (!state || state.pointerId !== event.pointerId) return;

			event.preventDefault();
			const deltaX = event.clientX - state.startX;
			const deltaY = event.clientY - state.startY;
			const {deltaWidth, deltaPosX, deltaPosY} = computeResizeDelta(state.edge, deltaX, deltaY);

			const nextWidth = clampPiPWidth(state.startWidth + deltaWidth, viewportSize.width, viewportSize.height);

			setPipWidth(nextWidth);
			pipWidthRef.current = nextWidth;
			x.set(state.startPosX + deltaPosX);
			y.set(state.startPosY + deltaPosY);
		},
		[computeResizeDelta, viewportSize.height, viewportSize.width, x, y],
	);

	const handleResizePointerUp = useCallback(
		(event: PointerEvent) => {
			const state = resizeStateRef.current;
			if (!state || state.pointerId !== event.pointerId) return;
			event.preventDefault();
			cleanupResizeListeners();
			resizeStateRef.current = null;
			isResizingRef.current = false;
			setIsResizing(false);
			PiPStore.setWidth(pipWidthRef.current);
		},
		[cleanupResizeListeners],
	);

	const createResizePointerDownHandler = useCallback(
		(edge: ResizeEdge) => (event: React.PointerEvent<HTMLButtonElement>) => {
			if (event.button !== 0) return;
			event.preventDefault();
			event.stopPropagation();
			stopSnapAnimations();
			isResizingRef.current = true;
			setIsResizing(true);
			resizeStateRef.current = {
				pointerId: event.pointerId,
				edge,
				startX: event.clientX,
				startY: event.clientY,
				startWidth: pipWidthRef.current,
				startPosX: x.get(),
				startPosY: y.get(),
			};

			const listeners: ResizeListeners = {
				move: handleResizePointerMove,
				up: handleResizePointerUp,
			};
			resizeListenersRef.current = listeners;
			window.addEventListener('pointermove', listeners.move);
			window.addEventListener('pointerup', listeners.up);
			window.addEventListener('pointercancel', listeners.up);
		},
		[handleResizePointerMove, handleResizePointerUp, stopSnapAnimations, x, y],
	);

	useEffect(() => cleanupResizeListeners, [cleanupResizeListeners]);

	const handleContainerPointerDown = useCallback(
		(event: React.PointerEvent<HTMLDivElement>) => {
			if (event.button !== 0) return;
			if (isResizingRef.current) return;
			const targetElement = event.target as HTMLElement | null;
			if (targetElement?.closest('button, [data-pip-no-drag="true"]')) return;
			dragControls.start(event);
		},
		[dragControls],
	);

	const handleDragStart = useCallback(() => {
		if (isResizingRef.current) return;
		isDraggingRef.current = true;
		setIsDragging(true);
		stopSnapAnimations();
	}, [stopSnapAnimations]);

	const handleDragEnd = useCallback(
		(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
			if (isResizingRef.current) {
				isDraggingRef.current = false;
				setIsDragging(false);
				return;
			}
			isDraggingRef.current = false;
			setIsDragging(false);

			const currentX = x.get();
			const currentY = y.get();

			const targetCorner = pickCornerOnRelease(
				currentX,
				currentY,
				info.velocity.x,
				info.velocity.y,
				cornerPositions,
				bounds,
			);
			PiPStore.setCorner(targetCorner);
			snapToCorner(targetCorner);
		},
		[bounds, cornerPositions, snapToCorner, x, y],
	);

	const handleCloseClick = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			if (VoiceSettingsStore.disablePictureInPicturePopout) {
				PiPStore.close();
				return;
			}
			ModalActionCreators.push(modal(() => <DisablePiPConfirmModal />));
		},
		[VoiceSettingsStore.disablePictureInPicturePopout],
	);

	const handleDisconnect = useCallback(async (e: React.MouseEvent) => {
		e.stopPropagation();
		await MediaEngineStore.disconnectFromVoiceChannel('user');
		PiPStore.close();
	}, []);

	const returnToCall = useCallback(() => {
		NavigationActionCreators.selectChannel(content.guildId ?? ME, content.channelId);
	}, [content.channelId, content.guildId]);

	const handleReturnToCall = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			event.stopPropagation();
			returnToCall();
		},
		[returnToCall],
	);

	const handleOverlayDoubleClick = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			if (isDraggingRef.current || isResizingRef.current) return;
			returnToCall();
		},
		[returnToCall],
	);

	const {frozenFrameUrl, isOwnStreamPreviewPaused, shouldHideOwnScreenShareVideo} = useOwnScreenSharePreviewState({
		isOwnScreenShare,
		pausePreviewOnUnfocus: VoiceSettingsStore.pauseOwnScreenSharePreviewOnUnfocus,
		isWindowFocused,
		videoRef,
	});

	const handleRevealHiddenFeed = useCallback(
		(e: React.SyntheticEvent) => {
			e.stopPropagation();
			if (isOwnScreenShareHidden) {
				VoiceSettingsActionCreators.update({showMyOwnScreenShare: true});
			} else if (isOwnCameraHidden) {
				VoiceSettingsActionCreators.update({showMyOwnCamera: true});
			}
		},
		[isOwnScreenShareHidden, isOwnCameraHidden],
	);

	const mediaNode = useMemo(() => {
		if (isOwnScreenShareHidden || isOwnCameraHidden) {
			return <HiddenStreamPlaceholder />;
		}

		if (shouldHideOwnScreenShareVideo && frozenFrameUrl) {
			return <img src={frozenFrameUrl} alt="" className={styles.frozenFrame} />;
		}

		if (trackRef && isTrackReference(trackRef) && hasVisibleMediaTrack) {
			return (
				<div className={clsx(styles.videoWrapper, isScreenShare && styles.screenShareVideo)}>
					<VideoTrack ref={videoRef} trackRef={trackRef} manageSubscription={!isScreenShare} />
				</div>
			);
		}

		if (!isScreenShare) {
			return (
				<div className={styles.avatarPlaceholder} style={{backgroundColor: placeholderBackgroundColor}}>
					{participantUser && (
						<div
							className={
								isParticipantActuallySpeaking
									? voiceParticipantTileStyles.avatarRingSpeaking
									: voiceParticipantTileStyles.avatarRing
							}
						>
							<Avatar
								user={participantUser}
								size={pipAvatarSize}
								className={voiceParticipantTileStyles.avatarFlexShrink}
								guildId={content.guildId ?? undefined}
							/>
						</div>
					)}
				</div>
			);
		}

		return (
			<div className={styles.avatarPlaceholder} style={{backgroundColor: placeholderBackgroundColor}}>
				{participantUser && (
					<div className={voiceParticipantTileStyles.avatarRing}>
						<Avatar
							user={participantUser}
							size={pipAvatarSize}
							className={voiceParticipantTileStyles.avatarFlexShrink}
							guildId={content.guildId ?? undefined}
						/>
					</div>
				)}
			</div>
		);
	}, [
		content.guildId,
		frozenFrameUrl,
		hasVisibleMediaTrack,
		isOwnCameraHidden,
		isOwnScreenShareHidden,
		isParticipantActuallySpeaking,
		isScreenShare,
		participantUser,
		pipAvatarSize,
		placeholderBackgroundColor,
		shouldHideOwnScreenShareVideo,
		trackRef,
	]);

	useEffect(() => {
		if (!isScreenShare || !trackRef || !isTrackReference(trackRef)) return;

		const publication = trackRef.publication as typeof trackRef.publication & {setSubscribed?: (sub: boolean) => void};
		if (!publication || typeof publication.setSubscribed !== 'function') return;

		if (isWatching && !publication.isSubscribed) {
			try {
				publication.setSubscribed(true);
			} catch (err) {
				logger.error('PiP failed to subscribe to screen share', err);
			}
		}
	}, [isScreenShare, trackRef, isWatching]);

	return (
		<motion.div
			className={clsx(
				styles.container,
				isResizing && styles.containerResizing,
				(isDragging || isResizing) && styles.containerInteractionActive,
			)}
			style={{x, y, width: pipWidth}}
			drag={!isResizing}
			dragControls={dragControls}
			dragListener={false}
			dragMomentum={false}
			dragElastic={0.18}
			dragConstraints={{left: bounds.minX, right: bounds.maxX, top: bounds.minY, bottom: bounds.maxY}}
			dragTransition={{bounceStiffness: 520, bounceDamping: 32}}
			onPointerDown={handleContainerPointerDown}
			onDragStart={handleDragStart}
			onDragEnd={handleDragEnd}
			onDoubleClick={handleOverlayDoubleClick}
			whileDrag={AccessibilityStore.useReducedMotion ? undefined : {scale: 1.02}}
			transition={AccessibilityStore.useReducedMotion ? {duration: 0} : INTERACTION_SPRING}
		>
			{mediaNode}
			{isOwnScreenShareHidden && (
				<FeedHiddenOverlay
					message={t`This stream has been hidden.`}
					buttonLabel={t`Watch Stream`}
					onReveal={handleRevealHiddenFeed}
				/>
			)}
			{isOwnCameraHidden && (
				<FeedHiddenOverlay
					message={t`This feed has been hidden.`}
					buttonLabel={t`Show Camera`}
					onReveal={handleRevealHiddenFeed}
				/>
			)}
			{isOwnScreenShare && !isOwnScreenShareHidden && isOwnStreamPreviewPaused && (
				<div className={styles.previewPausedOverlay}>
					<PauseIcon weight="fill" className={styles.previewPausedIcon} />
					<div className={styles.previewPausedTextWrap}>
						<span className={styles.previewPausedText}>{t`Preview paused to save resources`}</span>
						<span className={styles.previewPausedSubtext}>{t`Your stream is still being broadcast`}</span>
					</div>
				</div>
			)}

			<div className={styles.hoverOverlay}>
				<div className={styles.headerGradient}>
					<div className={styles.headerContent}>
						<div className={styles.headerLeft}>
							<FocusRing offset={-2}>
								<button
									type="button"
									className={styles.returnToCallButton}
									onClick={handleReturnToCall}
									onPointerDown={(e) => e.stopPropagation()}
									aria-label={t`Back to call`}
								>
									<ArrowLeftIcon weight="bold" className={styles.returnToCallIcon} />
									<span className={styles.returnToCallLabel}>{channelName}</span>
								</button>
							</FocusRing>
						</div>
						<Tooltip text={t`Hide popout (ask to remember)`} position="left">
							<button
								type="button"
								className={styles.closeButton}
								onClick={handleCloseClick}
								onPointerDown={(e) => e.stopPropagation()}
								aria-label={t`Close`}
							>
								<XIcon weight="bold" className={styles.actionIcon} />
							</button>
						</Tooltip>
					</div>
				</div>

				<div className={styles.footerGradient}>
					<div className={styles.footerContent}>
						<div className={styles.footerLeft}>
							<span className={styles.streamerName}>{displayName}</span>
						</div>
						<div className={styles.footerRight}>
							{isScreenShare && viewerUsers.length > 0 && (
								<div className={styles.spectatorBadge}>
									<EyeIcon weight="fill" className={styles.spectatorIcon} />
									<span>{viewerUsers.length}</span>
								</div>
							)}
							{!isScreenShare && (
								<button
									type="button"
									className={clsx(styles.actionButton, styles.disconnectButton)}
									onClick={handleDisconnect}
									onPointerDown={(e) => e.stopPropagation()}
									aria-label={t`Disconnect`}
								>
									<PhoneXIcon weight="fill" className={styles.actionIcon} />
								</button>
							)}
						</div>
					</div>
				</div>
			</div>

			<button
				type="button"
				className={styles.resizeHandleTop}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('top')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleBottom}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('bottom')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleLeft}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('left')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleRight}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('right')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleTopLeft}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('top-left')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleTopRight}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('top-right')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleBottomLeft}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('bottom-left')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
			<button
				type="button"
				className={styles.resizeHandleBottomRight}
				aria-label={t`Resize Picture-in-Picture`}
				onPointerDown={createResizePointerDownHandler('bottom-right')}
				onDoubleClick={(event) => event.stopPropagation()}
			/>
		</motion.div>
	);
});

export const PiPOverlay = observer(function PiPOverlay() {
	const isOpen = PiPStore.getIsOpen();
	const hasActiveOverlay = PiPStore.getHasActiveOverlay();
	const content = PiPStore.getActiveContent();
	const room = MediaEngineStore.room;
	const [activeRoom, setActiveRoom] = useState<Room | null>(room);
	const isMobile = MobileLayoutStore.isMobileLayout();
	const disablePopout = VoiceSettingsStore.disablePictureInPicturePopout || PiPStore.getSessionDisable();

	useEffect(() => {
		if (!isMobile) return;
		if (isOpen) {
			PiPStore.close();
		}
		PiPStore.hideFocusedTileMirror();
	}, [isMobile, isOpen]);

	useEffect(() => {
		if (!room && isOpen) {
			PiPStore.close();
		}
	}, [room, isOpen]);

	useEffect(() => {
		if (!disablePopout) return;
		if (isOpen) {
			PiPStore.close();
		}
		PiPStore.hideFocusedTileMirror();
	}, [disablePopout, isOpen]);

	useEffect(() => {
		if (room) {
			setActiveRoom(room);
		}
	}, [room]);

	return (
		<>
			{activeRoom && !isMobile && !disablePopout && hasActiveOverlay && content && (
				<PiPOverlayInner key="pip-overlay" content={content} room={activeRoom} />
			)}
		</>
	);
});
