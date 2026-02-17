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

import * as PiPActionCreators from '@app/actions/PiPActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import channelHeaderStyles from '@app/components/channel/ChannelHeader.module.css';
import {ChannelHeaderIcon} from '@app/components/channel/channel_header_components/ChannelHeaderIcon';
import {InboxButton} from '@app/components/channel/channel_header_components/UtilityButtons';
import {NativeDragRegion} from '@app/components/layout/NativeDragRegion';
import {BottomSheet} from '@app/components/uikit/bottom_sheet/BottomSheet';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {CompactVoiceCallView} from '@app/components/voice/CompactVoiceCallView';
import {StreamFocusHeaderInfo} from '@app/components/voice/StreamFocusHeaderInfo';
import {StreamInfoPill} from '@app/components/voice/StreamInfoPill';
import {getStreamKey} from '@app/components/voice/StreamKeys';
import {useStreamSpectators} from '@app/components/voice/useStreamSpectators';
import {useStreamTrackInfo} from '@app/components/voice/useStreamTrackInfo';
import {useVoiceCallAppFullscreen} from '@app/components/voice/useVoiceCallAppFullscreen';
import {useVoiceCallTracksAndLayout} from '@app/components/voice/useVoiceCallTracksAndLayout';
import {VoiceCallLayoutContent} from '@app/components/voice/VoiceCallLayoutContent';
import styles from '@app/components/voice/VoiceCallView.module.css';
import {VoiceControlBar} from '@app/components/voice/VoiceControlBar';
import {parseVoiceParticipantIdentity} from '@app/components/voice/VoiceParticipantSpeakingUtils';
import {VoiceStatsOverlay} from '@app/components/voice/VoiceStatsOverlay';
import {Logger} from '@app/lib/Logger';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import ContextMenuStore, {isContextMenuNodeTarget} from '@app/stores/ContextMenuStore';
import FavoritesStore from '@app/stores/FavoritesStore';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import PiPStore from '@app/stores/PiPStore';
import PopoutStore from '@app/stores/PopoutStore';
import UserStore from '@app/stores/UserStore';
import VoiceSettingsStore from '@app/stores/VoiceSettingsStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {
	FloatingFocusManager,
	flip,
	offset,
	shift,
	useClick,
	useDismiss,
	useFloating,
	useInteractions,
	useRole,
} from '@floating-ui/react';
import {ME} from '@fluxer/constants/src/AppConstants';
import {useLingui} from '@lingui/react/macro';
import {type TrackReferenceOrPlaceholder, useConnectionState, useParticipants} from '@livekit/components-react';
import {
	ArrowLeftIcon,
	ChartBarIcon,
	CornersInIcon,
	CornersOutIcon,
	ListIcon,
	PhoneIcon,
	StarIcon,
} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {ConnectionState, Track} from 'livekit-client';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {forwardRef, useCallback, useEffect, useMemo, useRef, useState} from 'react';

const logger = new Logger('VoiceCallView');
const VOICE_HUD_IDLE_TIMEOUT_MS = 3000;

interface VoiceCallViewProps {
	channel: ChannelRecord;
	fullscreenRequestNonce?: number;
}

function useConnectionStateText(connectionState: ConnectionState) {
	const {t} = useLingui();
	return useMemo(() => {
		switch (connectionState) {
			case ConnectionState.Connecting:
				return t`Connecting...`;
			case ConnectionState.Reconnecting:
				return t`Reconnecting...`;
			case ConnectionState.Disconnected:
				return t`Disconnected`;
			default:
				return null;
		}
	}, [connectionState, t]);
}

const VoiceCallViewInner = observer(
	({channel, fullscreenRequestNonce}: {channel: ChannelRecord; fullscreenRequestNonce?: number}) => {
		const {t} = useLingui();
		const containerRef = useRef<HTMLDivElement>(null);
		const hudPointerTimeoutRef = useRef<number | null>(null);
		const previousFullscreenRequestNonceRef = useRef<number | undefined>(undefined);

		const isMobile = MobileLayoutStore.isMobileLayout();
		const pipContent = PiPStore.getContent();
		const pipOpen = PiPStore.getIsOpen();
		const {keyboardModeEnabled} = KeyboardModeStore;
		const disablePiP = VoiceSettingsStore.disablePictureInPicturePopout || PiPStore.getSessionDisable();

		const [isStatsOpen, setIsStatsOpen] = useState(false);
		const [isCallSheetOpen, setIsCallSheetOpen] = useState(false);
		const [isSpectatorsPopoutOpen, setIsSpectatorsPopoutOpen] = useState(false);
		const {
			isFullscreen: isVoiceCallAppFullscreen,
			supportsFullscreen: supportsVoiceCallAppFullscreen,
			enterFullscreen: enterVoiceCallAppFullscreen,
			toggleFullscreen: toggleVoiceCallAppFullscreen,
		} = useVoiceCallAppFullscreen({containerRef});
		const [isPointerHudActive, setIsPointerHudActive] = useState(false);

		const participants = useParticipants();
		const participantCount = participants.length;
		const connectionState = useConnectionState();
		const connectionStateText = useConnectionStateText(connectionState);

		const isInboxPopoutOpen = PopoutStore.isOpen('inbox');
		const isFavorited = channel ? Boolean(FavoritesStore.getChannel(channel.id)) : false;

		const isAnyContextMenuOpen = useMemo(() => {
			const cm = ContextMenuStore.contextMenu;
			const target = cm?.target?.target ?? null;
			const container = containerRef.current;
			if (!cm || !container || !isContextMenuNodeTarget(target)) return false;
			return Boolean(container.contains(target));
		}, [ContextMenuStore.contextMenu]);
		const isChromePinned = isAnyContextMenuOpen || isInboxPopoutOpen || isStatsOpen || isSpectatorsPopoutOpen;

		const {
			layoutMode,
			pinnedParticipantIdentity,
			hasScreenShare,
			cameraTracksAll,
			screenShareTracks,
			filteredCameraTracks,
			focusMainTrack,
			carouselTracks,
			pipTrack,
		} = useVoiceCallTracksAndLayout({channel});
		const mainContentClassName = clsx(
			styles.mainContent,
			!isMobile && layoutMode === 'focus' && styles.mainContentFocusFullscreen,
		);

		const isFocusedOnScreenShare = layoutMode === 'focus' && focusMainTrack?.source === Track.Source.ScreenShare;

		const focusedStreamInfo = useMemo(() => {
			if (!isFocusedOnScreenShare || !focusMainTrack) return null;
			const parsedIdentity = parseVoiceParticipantIdentity(focusMainTrack.participant.identity);
			if (!parsedIdentity.userId || !parsedIdentity.connectionId) return null;
			return {userId: parsedIdentity.userId, connectionId: parsedIdentity.connectionId};
		}, [isFocusedOnScreenShare, focusMainTrack]);

		const focusedStreamerUser = focusedStreamInfo ? UserStore.getUser(focusedStreamInfo.userId) : null;

		const focusedStreamKey = useMemo(() => {
			if (!focusedStreamInfo) return '';
			return getStreamKey(channel.guildId, channel.id, focusedStreamInfo.connectionId);
		}, [focusedStreamInfo, channel.guildId, channel.id]);

		const focusedStreamerDisplayName = useMemo(() => {
			if (!focusedStreamerUser) return '';
			return (
				NicknameUtils.getNickname(focusedStreamerUser, channel.guildId, channel.id) ||
				focusedStreamerUser.username ||
				''
			);
		}, [focusedStreamerUser, channel.guildId, channel.id]);

		const {viewerUsers: spectatorUsers, spectatorEntries} = useStreamSpectators(focusedStreamKey);
		const focusedTrackInfo = useStreamTrackInfo(isFocusedOnScreenShare ? (focusMainTrack ?? null) : null);
		const handleSpectatorsPopoutOpenChange = useCallback((open: boolean) => {
			setIsSpectatorsPopoutOpen(open);
		}, []);

		const {
			refs: statsRefs,
			floatingStyles: statsFloatingStyles,
			context: statsContext,
		} = useFloating({
			open: isStatsOpen,
			onOpenChange: setIsStatsOpen,
			placement: 'bottom-end',
			middleware: [offset(8), flip(), shift({padding: 8})],
		});

		const {getReferenceProps: getStatsReferenceProps, getFloatingProps: getStatsFloatingProps} = useInteractions([
			useClick(statsContext),
			useDismiss(statsContext),
			useRole(statsContext),
		]);
		const statsFloatingProps = isMobile ? {} : getStatsFloatingProps();

		useEffect(() => {
			if (!isMobile && isCallSheetOpen) {
				setIsCallSheetOpen(false);
			}
		}, [isCallSheetOpen, isMobile]);

		const handleBackClick = useCallback(() => window.history.back(), []);

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
			(event: React.PointerEvent<HTMLDivElement>) => {
				if (event.pointerType === 'touch') return;
				setIsPointerHudActive(true);
				scheduleHudIdleState();
			},
			[scheduleHudIdleState],
		);

		const handleVoiceRootPointerLeave = useCallback(
			(event: React.PointerEvent<HTMLDivElement>) => {
				if (event.pointerType === 'touch') return;
				clearHudPointerTimeout();
				setIsPointerHudActive(false);
			},
			[clearHudPointerTimeout],
		);

		useEffect(() => {
			return () => {
				clearHudPointerTimeout();
			};
		}, [clearHudPointerTimeout]);

		const handleToggleFavorite = useCallback(() => {
			if (!channel) return;

			if (isFavorited) {
				FavoritesStore.removeChannel(channel.id);
				ToastActionCreators.createToast({type: 'success', children: t`Channel removed from favorites`});
				return;
			}

			FavoritesStore.addChannel(channel.id, channel.guildId ?? ME);
			ToastActionCreators.createToast({type: 'success', children: t`Channel added to favorites`});
		}, [channel, isFavorited]);

		const handleOpenCallSheet = useCallback(() => setIsCallSheetOpen(true), []);
		const handleCloseCallSheet = useCallback(() => setIsCallSheetOpen(false), []);
		const handleToggleVoiceCallAppFullscreen = useCallback(() => {
			void toggleVoiceCallAppFullscreen();
		}, [toggleVoiceCallAppFullscreen]);
		const fullscreenButtonLabel = isVoiceCallAppFullscreen ? t`Exit fullscreen` : t`Enter fullscreen`;
		const FullscreenButtonIcon = useMemo(() => {
			const BaseIcon = isVoiceCallAppFullscreen ? CornersInIcon : CornersOutIcon;
			const BoldIcon = forwardRef<SVGSVGElement, React.ComponentProps<typeof BaseIcon>>((props, ref) => (
				<BaseIcon ref={ref} weight="bold" {...props} />
			));
			BoldIcon.displayName = 'FullscreenButtonIcon';
			return BoldIcon;
		}, [isVoiceCallAppFullscreen]);

		useEffect(() => {
			if (fullscreenRequestNonce == null) return;
			if (previousFullscreenRequestNonceRef.current === fullscreenRequestNonce) return;
			previousFullscreenRequestNonceRef.current = fullscreenRequestNonce;
			void enterVoiceCallAppFullscreen();
		}, [enterVoiceCallAppFullscreen, fullscreenRequestNonce]);

		const openPiPForTrack = useCallback(
			(trackRef: TrackReferenceOrPlaceholder) => {
				const identity = trackRef?.participant?.identity ?? '';
				if (!identity) {
					logger.error('PiP open aborted because track reference is missing', {
						trackRef,
						disablePiP,
					});
					return;
				}

				if (disablePiP) {
					logger.debug('PiP open aborted because picture-in-picture is disabled');
					return;
				}

				const parsedIdentity = parseVoiceParticipantIdentity(identity);
				if (!parsedIdentity.userId || !parsedIdentity.connectionId) {
					logger.error('PiP open aborted because participant identity is malformed', {
						identity,
						trackRef,
					});
					return;
				}

				const contentType = trackRef.source === Track.Source.ScreenShare ? 'stream' : 'camera';
				PiPActionCreators.openPiP({
					type: contentType,
					participantIdentity: identity,
					channelId: channel.id,
					guildId: channel.guildId ?? null,
					connectionId: parsedIdentity.connectionId,
					userId: parsedIdentity.userId,
				});
			},
			[channel.id, channel.guildId, disablePiP],
		);

		const pipSnapshotRef = useRef<{pipTrack: TrackReferenceOrPlaceholder | null}>({
			pipTrack,
		});

		useEffect(() => {
			pipSnapshotRef.current = {pipTrack};
		}, [pipTrack]);

		useEffect(() => {
			return () => {
				if (isMobile) return;
				if (disablePiP) return;
				const snapshot = pipSnapshotRef.current;
				if (!snapshot.pipTrack) return;
				openPiPForTrack(snapshot.pipTrack);
			};
		}, [disablePiP, isMobile, openPiPForTrack]);

		useEffect(() => {
			if (pipOpen && pipContent?.channelId === channel.id) {
				PiPActionCreators.closePiP();
			}
		}, [pipOpen, pipContent, channel.id]);

		const FavoriteIcon = useMemo(() => {
			const Icon = forwardRef<SVGSVGElement, React.ComponentProps<typeof StarIcon>>((props, ref) => (
				<StarIcon ref={ref} weight={isFavorited ? 'fill' : 'bold'} {...props} />
			));
			Icon.displayName = 'FavoriteIcon';
			return Icon;
		}, [isFavorited]);

		const statsReferencePropsRaw = getStatsReferenceProps();
		const {ref: _statsRef, onClick: statsOnClickRaw, ...statsReferenceProps} = statsReferencePropsRaw;
		const statsOnClick = statsOnClickRaw as React.MouseEventHandler<HTMLButtonElement> | undefined;

		return (
			<div
				ref={containerRef}
				data-voice-call-root
				className={clsx(
					styles.root,
					styles.voiceRoot,
					isVoiceCallAppFullscreen && styles.voiceCallFullscreen,
					isPointerHudActive && styles.pointerActive,
					isChromePinned && styles.contextMenuActive,
					keyboardModeEnabled && styles.keyboardModeActive,
				)}
				onPointerEnter={handleVoiceRootPointerActivity}
				onPointerMove={handleVoiceRootPointerActivity}
				onPointerDown={handleVoiceRootPointerActivity}
				onPointerLeave={handleVoiceRootPointerLeave}
			>
				<output className={styles.srOnly} aria-live="polite" aria-atomic="true">
					{participantCount === 1
						? t`${participantCount} participant in call`
						: t`${participantCount} participants in call`}
				</output>

				<NativeDragRegion className={clsx(channelHeaderStyles.headerContainer, styles.voiceChrome, styles.voiceHeader)}>
					<div className={channelHeaderStyles.headerLeftSection}>
						{isMobile ? (
							<FocusRing offset={-2}>
								<button type="button" className={channelHeaderStyles.backButton} onClick={handleBackClick}>
									<ArrowLeftIcon className={channelHeaderStyles.backIconBold} weight="bold" />
								</button>
							</FocusRing>
						) : (
							<FocusRing offset={-2}>
								<button type="button" className={channelHeaderStyles.backButtonDesktop} onClick={handleBackClick}>
									<ListIcon className={channelHeaderStyles.backIcon} />
								</button>
							</FocusRing>
						)}

						<div className={channelHeaderStyles.leftContentContainer}>
							<div className={channelHeaderStyles.channelInfoContainer}>
								{ChannelUtils.getIcon(channel, {className: channelHeaderStyles.channelIcon})}
								<span className={channelHeaderStyles.channelName}>{channel.name ?? ''}</span>
							</div>

							{isFocusedOnScreenShare && focusedStreamerUser && (
								<StreamFocusHeaderInfo
									streamerUser={focusedStreamerUser}
									streamerDisplayName={focusedStreamerDisplayName}
									viewerUsers={spectatorUsers}
									spectatorEntries={spectatorEntries}
									guildId={channel.guildId ?? undefined}
									channelId={channel.id}
									onOpenChange={handleSpectatorsPopoutOpenChange}
								/>
							)}
						</div>
					</div>

					<div className={channelHeaderStyles.headerRightSection}>
						{isFocusedOnScreenShare && focusedTrackInfo && (
							<div className={styles.headerStreamInfo}>
								<StreamInfoPill info={focusedTrackInfo} />
							</div>
						)}

						{channel && !isMobile && AccessibilityStore.showFavorites && (
							<ChannelHeaderIcon
								icon={FavoriteIcon}
								label={isFavorited ? t`Remove from Favorites` : t`Add to Favorites`}
								isSelected={isFavorited}
								onClick={handleToggleFavorite}
							/>
						)}

						{connectionStateText && (
							<div
								className={clsx(
									styles.connectionStatusContainer,
									connectionState === ConnectionState.Connecting && styles.statusConnecting,
									connectionState === ConnectionState.Reconnecting && styles.statusReconnecting,
									connectionState === ConnectionState.Disconnected && styles.statusDisconnected,
									connectionState === ConnectionState.Connected && styles.statusConnected,
								)}
							>
								<div className={styles.connectionStatusDot} />
								{connectionStateText}
							</div>
						)}

						<ChannelHeaderIcon
							ref={statsRefs.setReference}
							icon={ChartBarIcon}
							label={t`Connection Stats`}
							isSelected={isStatsOpen}
							onClick={statsOnClick}
							aria-expanded={isStatsOpen}
							{...statsReferenceProps}
						/>

						{isMobile && (
							<ChannelHeaderIcon icon={PhoneIcon} label={t`View call controls`} onClick={handleOpenCallSheet} />
						)}

						{!isMobile && <InboxButton />}
					</div>
				</NativeDragRegion>

				<div className={mainContentClassName}>
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
					/>
				</div>

				<div className={clsx(styles.controlBarContainer, styles.voiceChrome)}>
					<VoiceControlBar />
				</div>

				<div className={clsx(styles.fullscreenButtonWrap, styles.voiceChrome)}>
					{supportsVoiceCallAppFullscreen && (
						<ChannelHeaderIcon
							icon={FullscreenButtonIcon}
							label={fullscreenButtonLabel}
							isSelected={isVoiceCallAppFullscreen}
							onClick={handleToggleVoiceCallAppFullscreen}
						/>
					)}
				</div>

				{isStatsOpen &&
					(isMobile ? (
						<BottomSheet
							isOpen={isStatsOpen}
							onClose={() => setIsStatsOpen(false)}
							title={t`Connection Stats`}
							snapPoints={[0.3, 0.65, 0.9]}
						>
							<VoiceStatsOverlay onClose={() => setIsStatsOpen(false)} />
						</BottomSheet>
					) : (
						<FloatingFocusManager context={statsContext} modal={false}>
							<div ref={statsRefs.setFloating} style={{...statsFloatingStyles, zIndex: 30}} {...statsFloatingProps}>
								<VoiceStatsOverlay onClose={() => setIsStatsOpen(false)} />
							</div>
						</FloatingFocusManager>
					))}

				{isMobile && (
					<BottomSheet
						isOpen={isCallSheetOpen}
						onClose={handleCloseCallSheet}
						title={channel.name ?? t`Voice call`}
						snapPoints={[0.35, 0.65, 0.95]}
						disablePadding
						surface="primary"
					>
						<div className={styles.voiceCallSheetContent}>
							<CompactVoiceCallView channel={channel} className={styles.voiceCallSheetCompact} />
						</div>
					</BottomSheet>
				)}
			</div>
		);
	},
);

function hasValidRoomForVoiceCallView(channel: ChannelRecord): boolean {
	const room = MediaEngineStore.room;
	if (!room) return false;
	const normalizedGuildId = channel.guildId ?? null;
	return MediaEngineStore.channelId === channel.id && (MediaEngineStore.guildId ?? null) === normalizedGuildId;
}

export const VoiceCallView = observer(({channel, fullscreenRequestNonce}: VoiceCallViewProps) => {
	if (!hasValidRoomForVoiceCallView(channel)) {
		return null;
	}
	return <VoiceCallViewInner channel={channel} fullscreenRequestNonce={fullscreenRequestNonce} />;
});
