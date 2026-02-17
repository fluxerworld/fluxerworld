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
import {PreloadableUserPopout} from '@app/components/channel/PreloadableUserPopout';
import styles from '@app/components/layout/GroupedVoiceParticipant.module.css';
import {VoiceParticipantItem} from '@app/components/layout/VoiceParticipantItem';
import {VoiceStateIcons} from '@app/components/layout/VoiceStateIcons';
import {AvatarWithPresence} from '@app/components/uikit/avatars/AvatarWithPresence';
import {VoiceParticipantContextMenu} from '@app/components/uikit/context_menu/VoiceParticipantContextMenu';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {getStreamKey} from '@app/components/voice/StreamKeys';
import {StreamWatchHoverPopout} from '@app/components/voice/StreamWatchHoverPopout';
import {useStreamWatchState} from '@app/components/voice/useStreamWatchState';
import {useContextMenuHoverState} from '@app/hooks/useContextMenuHoverState';
import {useStreamWatchDoubleClick} from '@app/hooks/useStreamWatchDoubleClick';
import type {UserRecord} from '@app/records/UserRecord';
import LocalVoiceStateStore from '@app/stores/LocalVoiceStateStore';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {VoiceState} from '@app/types/gateway/GatewayVoiceTypes';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';

function useOpenProfileAriaLabel(user: UserRecord) {
	const {t} = useLingui();
	const nickname = NicknameUtils.getNickname(user);
	return useMemo(() => t`Open profile for ${nickname}`, [t, nickname]);
}

interface GroupedVoiceParticipantProps {
	user: UserRecord;
	voiceStates: Array<VoiceState>;
	guildId: string;
	anySpeaking?: boolean;
}

export const GroupedVoiceParticipant = observer(function GroupedVoiceParticipant({
	user,
	voiceStates,
	guildId,
	anySpeaking: propAnySpeaking,
}: GroupedVoiceParticipantProps) {
	const {t} = useLingui();
	const openProfileAriaLabel = useOpenProfileAriaLabel(user);
	const [isExpanded, setIsExpanded] = useState(false);
	const currentUser = UserStore.getCurrentUser();
	const isCurrentUser = currentUser?.id === user.id;
	const currentConnectionId = MediaEngineStore.connectionId;
	const localSelfVideo = LocalVoiceStateStore.selfVideo;
	const localSelfStream = LocalVoiceStateStore.selfStream;

	const rowRef = useRef<HTMLDivElement>(null);
	const isContextMenuOpen = useContextMenuHoverState(rowRef);

	const toggleExpanded = useCallback(() => setIsExpanded((prev) => !prev), []);
	const connectionCount = voiceStates.length;

	const handleContextMenu = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
				<VoiceParticipantContextMenu
					user={user}
					participantName={NicknameUtils.getNickname(user)}
					onClose={onClose}
					guildId={guildId}
					isGroupedItem={true}
					isParentGroupedItem={true}
				/>
			));
		},
		[user, guildId],
	);

	const stateAgg = useMemo(() => {
		let anyCameraOn = false;
		let anyLive = false;
		let guildMuted = false;
		let guildDeaf = false;
		let allSelfMuted = true;
		let allSelfDeaf = true;

		for (const state of voiceStates) {
			const connectionId = state.connection_id ?? '';
			const participant = MediaEngineStore.getParticipantByUserIdAndConnectionId(user.id, connectionId);

			const selfMuted = state.self_mute ?? (participant ? !participant.isMicrophoneEnabled : false);
			const selfDeaf = !!state.self_deaf;
			const camera = state.self_video === true || (participant ? participant.isCameraEnabled : false);
			const live = state.self_stream === true || (participant ? participant.isScreenShareEnabled : false);

			anyCameraOn = anyCameraOn || camera;
			anyLive = anyLive || live;
			guildMuted = guildMuted || !!state.mute;
			guildDeaf = guildDeaf || !!state.deaf;
			allSelfMuted = allSelfMuted && !!selfMuted;
			allSelfDeaf = allSelfDeaf && !!selfDeaf;
		}

		if (isCurrentUser) {
			anyCameraOn = anyCameraOn || localSelfVideo;
			anyLive = anyLive || localSelfStream;
		}

		let anySpeaking = propAnySpeaking !== undefined ? propAnySpeaking : false;
		if (propAnySpeaking === undefined) {
			for (const state of voiceStates) {
				const connectionId = state.connection_id ?? '';
				const participant = MediaEngineStore.getParticipantByUserIdAndConnectionId(user.id, connectionId);
				const selfMuted = state.self_mute ?? (participant ? !participant.isMicrophoneEnabled : false);
				const speaking = !!(participant?.isSpeaking && !selfMuted && !(state.mute ?? false));
				anySpeaking = anySpeaking || speaking;
			}
		}

		return {anySpeaking, anyCameraOn, anyLive, guildMuted, guildDeaf, allSelfMuted, allSelfDeaf};
	}, [voiceStates, user.id, isCurrentUser, localSelfVideo, localSelfStream, propAnySpeaking]);

	const activeStreamState = useMemo(() => {
		for (const state of voiceStates) {
			const connectionId = state.connection_id ?? '';
			if (!connectionId) continue;
			const participant = MediaEngineStore.getParticipantByUserIdAndConnectionId(user.id, connectionId);
			const live = state.self_stream === true || (participant ? participant.isScreenShareEnabled : false);
			if (live) return state;
		}

		if (isCurrentUser && localSelfStream) {
			return (
				voiceStates.find((state) => state.connection_id === currentConnectionId) ??
				voiceStates.find((state) => Boolean(state.connection_id)) ??
				null
			);
		}

		return null;
	}, [voiceStates, user.id, isCurrentUser, localSelfStream, currentConnectionId]);

	const streamKey = activeStreamState?.connection_id
		? getStreamKey(guildId, activeStreamState.channel_id ?? null, activeStreamState.connection_id)
		: '';
	const showStreamHover = Boolean(activeStreamState?.connection_id);

	const activeChannelId = activeStreamState?.channel_id ?? null;

	const streamWatchStateArgs = useMemo(
		() => ({streamKey, guildId, channelId: activeChannelId}),
		[streamKey, guildId, activeChannelId],
	);
	const {startWatching} = useStreamWatchState(streamWatchStateArgs);

	const streamParticipantIdentity = useMemo(() => {
		if (!activeStreamState?.connection_id) return null;
		return `user_${user.id}_${activeStreamState.connection_id}`;
	}, [user.id, activeStreamState?.connection_id]);

	const handleNavigateToWatch = useCallback(() => {
		if (activeChannelId) {
			NavigationActionCreators.selectChannel(guildId ?? ME, activeChannelId);
		}
	}, [guildId, activeChannelId]);

	const {onClick: handleClick, onDoubleClick: handleDoubleClick} = useStreamWatchDoubleClick({
		streamParticipantIdentity: showStreamHover ? streamParticipantIdentity : null,
		guildId,
		channelId: activeChannelId,
		startWatching,
		onNavigateToWatch: handleNavigateToWatch,
	});

	return (
		<div className={styles.container}>
			<PreloadableUserPopout
				user={user}
				isWebhook={false}
				guildId={guildId}
				position="right-start"
				disableContextMenu={true}
			>
				<StreamWatchHoverPopout
					enabled={showStreamHover}
					streamKey={streamKey}
					guildId={guildId}
					channelId={activeStreamState?.channel_id ?? null}
				>
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handling is managed elsewhere */}
					<div
						ref={rowRef}
						className={clsx(
							styles.participantButton,
							stateAgg.anySpeaking && styles.participantButtonSpeaking,
							isContextMenuOpen && styles.participantButtonContextMenuActive,
						)}
						role="button"
						tabIndex={0}
						aria-label={openProfileAriaLabel}
						onClick={handleClick}
						onContextMenu={handleContextMenu}
						onDoubleClick={handleDoubleClick}
					>
						<div className={styles.avatarAndName}>
							<AvatarWithPresence user={user} size={24} speaking={stateAgg.anySpeaking} guildId={guildId} />
							<div className={styles.nameContainer}>
								<span
									className={clsx(
										styles.participantName,
										stateAgg.anySpeaking && styles.participantNameSpeaking,
										isCurrentUser && !stateAgg.anySpeaking && styles.participantNameCurrent,
									)}
								>
									{NicknameUtils.getNickname(user)}
								</span>
								<Tooltip
									text={
										isExpanded
											? connectionCount === 1
												? t`Hide ${connectionCount} device`
												: t`Hide ${connectionCount} devices`
											: connectionCount === 1
												? t`Show ${connectionCount} device`
												: t`Show ${connectionCount} devices`
									}
								>
									<button
										type="button"
										aria-label={
											isExpanded
												? connectionCount === 1
													? t`Hide ${connectionCount} device`
													: t`Hide ${connectionCount} devices`
												: connectionCount === 1
													? t`Show ${connectionCount} device`
													: t`Show ${connectionCount} devices`
										}
										aria-expanded={isExpanded}
										onClick={(event) => {
											event.stopPropagation();
											toggleExpanded();
										}}
										className={styles.deviceCountButton}
									>
										({connectionCount})
									</button>
								</Tooltip>
							</div>
						</div>

						<div className={styles.iconsAndToggle}>
							<VoiceStateIcons
								isSelfMuted={stateAgg.allSelfMuted && !stateAgg.guildMuted}
								isSelfDeafened={stateAgg.allSelfDeaf && !stateAgg.guildDeaf}
								isGuildMuted={stateAgg.guildMuted}
								isGuildDeafened={stateAgg.guildDeaf}
								isCameraOn={stateAgg.anyCameraOn}
								isScreenSharing={stateAgg.anyLive}
								className={styles.flexShrinkZero}
							/>
						</div>
					</div>
				</StreamWatchHoverPopout>
			</PreloadableUserPopout>

			{isExpanded && (
				<div className={styles.devicesContainer}>
					{[...voiceStates]
						.sort((a, b) => (a.connection_id || '').localeCompare(b.connection_id || ''))
						.map((voiceState, index) => (
							<VoiceParticipantItem
								key={voiceState.connection_id || `${user.id}-${index}`}
								user={user}
								voiceState={voiceState}
								guildId={guildId}
								isGroupedItem={true}
								isCurrentUserConnection={isCurrentUser && voiceState.connection_id === currentConnectionId}
							/>
						))}
				</div>
			)}
		</div>
	);
});
