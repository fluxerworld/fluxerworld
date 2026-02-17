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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import {VoiceParticipantBottomSheet} from '@app/components/bottomsheets/VoiceParticipantBottomSheet';
import {PreloadableUserPopout} from '@app/components/channel/PreloadableUserPopout';
import {LongPressable} from '@app/components/LongPressable';
import channelItemSurfaceStyles from '@app/components/layout/ChannelItemSurface.module.css';
import {DND_TYPES} from '@app/components/layout/types/DndTypes';
import styles from '@app/components/layout/VoiceParticipantItem.module.css';
import {VoiceStateIcons} from '@app/components/layout/VoiceStateIcons';
import {AvatarWithPresence} from '@app/components/uikit/avatars/AvatarWithPresence';
import {VoiceParticipantContextMenu} from '@app/components/uikit/context_menu/VoiceParticipantContextMenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {getStreamKey} from '@app/components/voice/StreamKeys';
import {StreamWatchHoverPopout} from '@app/components/voice/StreamWatchHoverPopout';
import {useStreamWatchState} from '@app/components/voice/useStreamWatchState';
import {isVoiceParticipantActuallySpeaking} from '@app/components/voice/VoiceParticipantSpeakingUtils';
import {useContextMenuHoverState} from '@app/hooks/useContextMenuHoverState';
import {useStreamWatchDoubleClick} from '@app/hooks/useStreamWatchDoubleClick';
import type {UserRecord} from '@app/records/UserRecord';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import PermissionStore from '@app/stores/PermissionStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {VoiceState} from '@app/types/gateway/GatewayVoiceTypes';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {DesktopIcon, DeviceMobileIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';
import type {ConnectableElement} from 'react-dnd';
import {useDrag} from 'react-dnd';

export const VoiceParticipantItem = observer(function VoiceParticipantItem({
	user,
	voiceState,
	guildId,
	isGroupedItem = false,
	isCurrentUserConnection = false,
	isCurrentUser = false,
}: {
	user: UserRecord;
	voiceState: VoiceState | null;
	guildId: string;
	isGroupedItem?: boolean;
	isCurrentUserConnection?: boolean;
	isCurrentUser?: boolean;
}) {
	const {t} = useLingui();
	const connectionId = voiceState?.connection_id ?? '';
	const participant = MediaEngineStore.getParticipantByUserIdAndConnectionId(user.id, connectionId);
	const connectedChannelId = MediaEngineStore.channelId;
	const currentChannelId = voiceState?.channel_id ?? connectedChannelId ?? null;

	const canMoveMembers = PermissionStore.can(Permissions.MOVE_MEMBERS, {guildId});
	const canDragParticipant = canMoveMembers && currentChannelId !== null;

	const isSpeaking = participant?.isSpeaking ?? false;
	const isMobileLayout = MobileLayoutStore.isMobileLayout();
	const [menuOpen, setMenuOpen] = useState(false);
	const [isProfilePopoutOpen, setIsProfilePopoutOpen] = useState(false);
	const localSelfVideo = LocalVoiceStateStore.selfVideo;
	const localSelfStream = LocalVoiceStateStore.selfStream;
	const isLocalParticipant = isCurrentUser || isCurrentUserConnection;

	const rowRef = useRef<HTMLDivElement>(null);
	const isContextMenuOpen = useContextMenuHoverState(rowRef);

	const [{isDragging}, dragRef] = useDrag(
		() => ({
			type: DND_TYPES.VOICE_PARTICIPANT,
			item: {
				type: DND_TYPES.VOICE_PARTICIPANT,
				id: user.id,
				userId: user.id,
				guildId,
				currentChannelId,
			},
			canDrag: canDragParticipant,
			collect: (monitor) => ({isDragging: monitor.isDragging()}),
		}),
		[user.id, guildId, currentChannelId, canDragParticipant],
	);

	const dragConnectorRef = useCallback(
		(node: ConnectableElement | null) => {
			dragRef(node);
			rowRef.current = node as HTMLDivElement | null;
		},
		[dragRef],
	);

	const isSelfMuted = voiceState?.self_mute ?? (participant ? !participant.isMicrophoneEnabled : false);
	const isSelfDeafened = voiceState?.self_deaf ?? false;
	const isGuildMuted = voiceState?.mute ?? false;
	const isGuildDeafened = voiceState?.deaf ?? false;
	const isActuallySpeaking = isVoiceParticipantActuallySpeaking({
		isSpeaking,
		voiceState,
		isMicrophoneEnabled: participant?.isMicrophoneEnabled ?? !isSelfMuted,
	});

	const remoteCameraOn = voiceState?.self_video ?? (participant ? participant.isCameraEnabled : false);
	const remoteLive = voiceState?.self_stream ?? (participant ? participant.isScreenShareEnabled : false);
	const displayCameraOn = !!(remoteCameraOn || (isLocalParticipant ? localSelfVideo : false));
	const displayLive = !!(remoteLive || (isLocalParticipant ? localSelfStream : false));
	const streamKey = useMemo(
		() => getStreamKey(guildId, currentChannelId, connectionId),
		[guildId, currentChannelId, connectionId],
	);
	const showStreamHover = displayLive && Boolean(connectionId);
	const hasVoiceStateIcons =
		displayCameraOn || displayLive || isSelfMuted || isSelfDeafened || isGuildMuted || isGuildDeafened;

	const streamWatchStateArgs = useMemo(
		() => ({streamKey, guildId, channelId: currentChannelId}),
		[streamKey, guildId, currentChannelId],
	);
	const {startWatching} = useStreamWatchState(streamWatchStateArgs);

	const streamParticipantIdentity = useMemo(
		() => (connectionId ? `user_${user.id}_${connectionId}` : null),
		[user.id, connectionId],
	);

	const handleNavigateToWatch = useCallback(() => {
		if (currentChannelId) {
			NavigationActionCreators.selectChannel(guildId ?? ME, currentChannelId);
		}
	}, [guildId, currentChannelId]);

	const {onClick: handleClick, onDoubleClick: handleDoubleClick} = useStreamWatchDoubleClick({
		streamParticipantIdentity: showStreamHover ? streamParticipantIdentity : null,
		guildId,
		channelId: currentChannelId,
		startWatching,
		onNavigateToWatch: handleNavigateToWatch,
	});

	const handleContextMenu = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			const participantName = NicknameUtils.getNickname(user, guildId, currentChannelId ?? undefined) || user.username;
			ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
				<VoiceParticipantContextMenu
					user={user}
					participantName={participantName}
					onClose={onClose}
					guildId={guildId}
					connectionId={connectionId}
					isGroupedItem={isGroupedItem}
				/>
			));
		},
		[user, guildId, connectionId, currentChannelId],
	);

	const handleProfilePopoutOpen = useCallback(() => {
		setIsProfilePopoutOpen(true);
	}, []);

	const handleProfilePopoutClose = useCallback(() => {
		setIsProfilePopoutOpen(false);
	}, []);

	const DeviceIcon = voiceState?.is_mobile ? DeviceMobileIcon : DesktopIcon;
	const unknownDeviceFallback = useMemo(() => t`Unknown Device`, []);
	const displayName = isGroupedItem
		? voiceState?.connection_id || unknownDeviceFallback
		: NicknameUtils.getNickname(user, guildId, currentChannelId ?? undefined);
	const openProfileAriaLabel = !isGroupedItem ? t`Open profile for ${displayName}` : undefined;

	const row = (
		<FocusRing offset={-2} ringClassName={channelItemSurfaceStyles.channelItemFocusRing}>
			<LongPressable
				ref={dragConnectorRef}
				className={clsx(
					styles.participantRow,
					isActuallySpeaking && styles.participantRowSpeaking,
					isDragging && styles.participantRowDragging,
					isCurrentUserConnection && !isActuallySpeaking && styles.participantRowCurrentConnection,
					isProfilePopoutOpen && styles.participantRowPopoutOpen,
					isContextMenuOpen && styles.participantRowContextMenuActive,
				)}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				onDoubleClick={handleDoubleClick}
				onLongPress={() => {
					if (isMobileLayout) setMenuOpen(true);
				}}
				role={!isGroupedItem ? 'button' : undefined}
				tabIndex={!isGroupedItem ? 0 : -1}
				aria-label={openProfileAriaLabel}
			>
				{isGroupedItem ? (
					<div
						className={clsx(
							styles.deviceIcon,
							isActuallySpeaking && styles.deviceIconSpeaking,
							isCurrentUserConnection && !isActuallySpeaking && styles.deviceIconCurrent,
						)}
					>
						<DeviceIcon className={styles.iconContainer} weight="regular" />
					</div>
				) : (
					<AvatarWithPresence user={user} size={24} speaking={isActuallySpeaking} guildId={guildId} />
				)}

				{isGroupedItem ? (
					<Tooltip text={displayName} position="top">
						<span
							className={clsx(
								styles.participantName,
								isActuallySpeaking && styles.participantNameSpeaking,
								isCurrentUserConnection && !isActuallySpeaking && styles.participantNameCurrent,
							)}
						>
							{displayName}
						</span>
					</Tooltip>
				) : (
					<span
						className={clsx(
							styles.participantName,
							isActuallySpeaking && styles.participantNameSpeaking,
							isCurrentUser && !isActuallySpeaking && styles.participantNameCurrent,
						)}
					>
						{displayName}
					</span>
				)}

				{hasVoiceStateIcons && (
					<div className={styles.iconsContainer}>
						<VoiceStateIcons
							isSelfMuted={isSelfMuted}
							isSelfDeafened={isSelfDeafened}
							isGuildMuted={isGuildMuted}
							isGuildDeafened={isGuildDeafened}
							isCameraOn={displayCameraOn}
							isScreenSharing={displayLive}
							className={styles.flexShrinkZero}
						/>
					</div>
				)}
			</LongPressable>
		</FocusRing>
	);

	const rowWithHover = (
		<StreamWatchHoverPopout
			enabled={showStreamHover}
			streamKey={streamKey}
			guildId={guildId}
			channelId={currentChannelId}
		>
			{row}
		</StreamWatchHoverPopout>
	);

	return (
		<>
			{isGroupedItem ? (
				rowWithHover
			) : (
				<PreloadableUserPopout
					user={user}
					isWebhook={false}
					guildId={guildId}
					channelId={currentChannelId ?? undefined}
					position="right-start"
					disableContextMenu={true}
					onPopoutOpen={handleProfilePopoutOpen}
					onPopoutClose={handleProfilePopoutClose}
				>
					{rowWithHover}
				</PreloadableUserPopout>
			)}

			{isMobileLayout && (
				<VoiceParticipantBottomSheet
					isOpen={menuOpen}
					onClose={() => setMenuOpen(false)}
					user={user}
					participant={participant}
					guildId={guildId}
					connectionId={connectionId}
					isConnectionItem={isGroupedItem}
				/>
			)}
		</>
	);
});
