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

import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import * as VoiceCallLayoutActionCreators from '@app/actions/VoiceCallLayoutActionCreators';
import {GroupDMAvatar} from '@app/components/common/GroupDMAvatar';
import {GuildIcon} from '@app/components/popouts/GuildIcon';
import styles from '@app/components/profile/VoiceActivityCard.module.css';
import {Avatar} from '@app/components/uikit/Avatar';
import {AvatarStack} from '@app/components/uikit/avatars/AvatarStack';
import {Button} from '@app/components/uikit/button/Button';
import {LiveBadge} from '@app/components/uikit/LiveBadge';
import {Spinner} from '@app/components/uikit/Spinner';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useStreamPreview} from '@app/components/voice/useStreamPreview';
import {useStreamWatchState} from '@app/components/voice/useStreamWatchState';
import {
	createVoiceParticipantSortSnapshot,
	sortVoiceParticipantItemsWithSnapshot,
} from '@app/components/voice/VoiceParticipantSortUtils';
import {usePendingVoiceConnection} from '@app/hooks/usePendingVoiceConnection';
import type {UserVoiceActivity} from '@app/hooks/useUserVoiceActivities';
import {useVoiceJoinEligibility} from '@app/hooks/useVoiceJoinEligibility';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import type {UserRecord} from '@app/records/UserRecord';
import PermissionStore from '@app/stores/PermissionStore';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import type {VoiceState} from '@app/types/gateway/GatewayVoiceTypes';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {canViewStreamPreview} from '@app/utils/StreamPreviewPermissionUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {CaretRightIcon, PhoneIcon, SpeakerHighIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useRef} from 'react';

interface VoiceActivityCardProps {
	activity: UserVoiceActivity;
	onNavigate?: () => void;
}

export const VoiceActivityCard: React.FC<VoiceActivityCardProps> = observer(({activity, onNavigate}) => {
	const {t} = useLingui();
	const {voiceState, connectionId, guildId, channelId, channel, guild, isStreaming, streamKey, participantUsers} =
		activity;

	const isConnectedToChannel = useMemo(() => {
		if (!channelId) return false;
		return MediaEngineStore.channelId === channelId && MediaEngineStore.guildId === (guildId ?? null);
	}, [channelId, guildId]);

	const {canJoin} = useVoiceJoinEligibility({
		guildId: guildId ?? null,
		channelId,
	});
	const canFetchStreamPreview = canViewStreamPreview({
		guildId,
		channelId,
		hasConnectPermission: () =>
			PermissionStore.can(Permissions.CONNECT, {guildId: guildId ?? undefined, channelId: channelId ?? undefined}),
	});

	const {previewUrl, isPreviewLoading} = useStreamPreview(
		isStreaming && !!streamKey && canFetchStreamPreview,
		streamKey ?? '',
	);

	const streamWatchArgs = useMemo(
		() => ({
			streamKey: streamKey ?? '',
			guildId: guildId ?? null,
			channelId,
		}),
		[streamKey, guildId, channelId],
	);
	const {isWatching, isPendingJoin, canWatch, startWatching} = useStreamWatchState(streamWatchArgs);

	const pendingWatchIdentityRef = useRef<string | null>(null);

	const handleVoiceConnected = useCallback(() => {
		NavigationActionCreators.selectChannel(guildId ?? ME, channelId);
		onNavigate?.();
	}, [guildId, channelId, onNavigate]);

	const {isPending: isJoining, startConnection: startJoinConnection} = usePendingVoiceConnection({
		guildId,
		channelId,
		onConnected: handleVoiceConnected,
	});

	const {isPending: isWatchingStarting, markPending: markWatchPending} = usePendingVoiceConnection({
		guildId,
		channelId,
		onConnected: handleVoiceConnected,
	});

	const handleWatchStream = useCallback(
		(event: React.SyntheticEvent) => {
			event.stopPropagation();
			const streamingUser = UserStore.getUser(voiceState.user_id);
			if (streamingUser) {
				const participantIdentity = `user_${streamingUser.id}_${connectionId}`;
				pendingWatchIdentityRef.current = participantIdentity;
				startWatching();
				VoiceCallLayoutActionCreators.setLayoutMode('focus');
				VoiceCallLayoutActionCreators.setPinnedParticipant(participantIdentity);
				VoiceCallLayoutActionCreators.markUserOverride();
				markWatchPending();
			}
		},
		[startWatching, voiceState.user_id, connectionId, markWatchPending],
	);

	const handleJoinOrOpenVoice = useCallback(() => {
		if (isConnectedToChannel) {
			NavigationActionCreators.selectChannel(guildId ?? ME, channelId);
			onNavigate?.();
		} else if (canJoin && channelId) {
			startJoinConnection();
		}
	}, [isConnectedToChannel, canJoin, guildId, channelId, onNavigate, startJoinConnection]);
	const avatarSortSnapshotRef = useRef(createVoiceParticipantSortSnapshot());

	const avatarStackUsers = useMemo(() => {
		const ownerUser = UserStore.getUser(voiceState.user_id);
		const userMap = new Map<string, UserRecord>();
		if (ownerUser) {
			userMap.set(ownerUser.id, ownerUser);
		}
		for (const user of participantUsers) {
			userMap.set(user.id, user);
		}
		return sortVoiceParticipantItemsWithSnapshot(Array.from(userMap.values()), {
			snapshot: avatarSortSnapshotRef.current,
			getParticipantKey: (user) => user.id,
			getUserId: (user) => user.id,
			guildId,
			channelId,
		});
	}, [voiceState.user_id, participantUsers, guildId, channelId]);

	const participantLabel = useMemo(() => {
		if (avatarStackUsers.length === 0) {
			return t`Participants`;
		}
		const names = avatarStackUsers
			.map((user) => NicknameUtils.getNickname(user, guildId ?? undefined, channelId ?? undefined))
			.join(', ');
		return t`Participants: ${names}`;
	}, [avatarStackUsers, guildId, channelId, t]);

	const cannotJoinReason = useMemo(() => {
		if (isConnectedToChannel || canJoin) return null;
		return t`You don't have permission to join this voice channel`;
	}, [isConnectedToChannel, canJoin, t]);

	const buttonLabel = useMemo(() => {
		if (isConnectedToChannel) return t`Open Voice`;
		return t`Join Voice`;
	}, [isConnectedToChannel, t]);

	return (
		<div className={styles.card}>
			<div className={styles.headerContextGroup}>
				<div className={styles.headerRow}>
					<div className={styles.headerLeft}>
						{isStreaming ? (
							<>
								<span className={clsx(styles.activityLabel, styles.streamingLabel)}>
									<Trans>Streaming</Trans>
								</span>
								<LiveBadge showTooltip={false} />
							</>
						) : (
							<span className={styles.activityLabel}>
								<Trans>In Voice</Trans>
							</span>
						)}
					</div>
					<div className={styles.participantsAvatarStack} role="group" aria-label={participantLabel}>
						<AvatarStack
							size={22}
							maxVisible={avatarStackUsers.length}
							users={avatarStackUsers}
							guildId={guildId}
							channelId={channelId}
						/>
					</div>
				</div>

				<VoiceActivityContext channel={channel} guild={guild} guildId={guildId} voiceState={voiceState} />
			</div>

			{isStreaming && streamKey && (
				<StreamPreviewSection
					previewUrl={previewUrl}
					isPreviewLoading={isPreviewLoading}
					isWatching={isWatching}
					isPendingJoin={isPendingJoin}
					canWatch={canWatch}
					onWatch={handleWatchStream}
					watchLabel={isWatching ? t`Watching` : t`Watch Stream`}
					isSubmitting={isWatchingStarting}
				/>
			)}

			<div className={styles.actionRow}>
				{cannotJoinReason ? (
					<Tooltip text={cannotJoinReason} maxWidth="xl">
						<div style={{width: '100%'}}>
							<Button
								compact
								fitContent={false}
								disabled={true}
								leftIcon={<PhoneIcon weight="fill" className={styles.actionIcon} />}
								className={styles.actionButton}
							>
								{buttonLabel}
							</Button>
						</div>
					</Tooltip>
				) : (
					<Button
						compact
						fitContent={false}
						onClick={handleJoinOrOpenVoice}
						leftIcon={<PhoneIcon weight="fill" className={styles.actionIcon} />}
						className={styles.actionButton}
						submitting={isJoining}
					>
						{buttonLabel}
					</Button>
				)}
			</div>
		</div>
	);
});

interface VoiceActivityContextProps {
	channel: ChannelRecord | undefined;
	guild: GuildRecord | undefined;
	guildId: string | null;
	voiceState: VoiceState;
}

const VoiceActivityContext: React.FC<VoiceActivityContextProps> = observer(({channel, guild, guildId, voiceState}) => {
	const {t} = useLingui();
	const channelId = channel?.id;

	const handleGuildNavigate = useCallback(() => {
		if (!guildId || !channelId) return;
		NavigationActionCreators.selectChannel(guildId, channelId);
	}, [channelId, guildId]);

	const handleDMNavigate = useCallback(() => {
		if (!channelId) return;
		NavigationActionCreators.selectChannel(ME, channelId);
	}, [channelId]);

	if (!channel || !channelId) return null;

	if (guild && guildId) {
		const guildName = guild.name ?? '';
		const channelName = channel.name ?? '';
		const contextName = guildName && channelName ? `${guildName} · ${channelName}` : (guildName || channelName).trim();
		return (
			<button
				type="button"
				className={styles.contextButton}
				onClick={handleGuildNavigate}
				aria-label={t`Open ${contextName}`}
			>
				<Tooltip text={guild.name ?? ''}>
					<div>
						<GuildIcon
							id={guild.id}
							name={guild.name}
							icon={guild.icon}
							className={styles.contextGuildIcon}
							sizePx={16}
						/>
					</div>
				</Tooltip>
				<CaretRightIcon weight="bold" className={styles.contextChevron} />
				<SpeakerHighIcon weight="fill" className={styles.contextIcon} />
				<span className={styles.contextChannelName}>{channel.name}</span>
			</button>
		);
	}

	if (channel.isGroupDM()) {
		const displayName = ChannelUtils.getDMDisplayName(channel);
		return (
			<button
				type="button"
				className={styles.contextButton}
				onClick={handleDMNavigate}
				aria-label={t`Open ${displayName}`}
			>
				<Tooltip text={displayName}>
					<div className={styles.contextDmAvatar}>
						<GroupDMAvatar channel={channel} size={16} />
					</div>
				</Tooltip>
				<span className={styles.contextChannelName}>{displayName}</span>
			</button>
		);
	}

	if (channel.isDM()) {
		const recipientId = channel.recipientIds.find((id) => id !== voiceState.user_id);
		const recipientUser = recipientId ? UserStore.getUser(recipientId) : undefined;
		if (recipientUser) {
			const displayName = NicknameUtils.getNickname(recipientUser);
			return (
				<button
					type="button"
					className={styles.contextButton}
					onClick={handleDMNavigate}
					aria-label={t`Open @${displayName}`}
				>
					<Tooltip text={displayName}>
						<div className={styles.contextDmAvatar}>
							<Avatar user={recipientUser} size={16} />
						</div>
					</Tooltip>
					<span className={styles.contextChannelName}>@{displayName}</span>
				</button>
			);
		}
	}

	return null;
});

interface StreamPreviewSectionProps {
	previewUrl: string | null;
	isPreviewLoading: boolean;
	isWatching: boolean;
	isPendingJoin: boolean;
	canWatch: boolean;
	onWatch: (event: React.SyntheticEvent) => void;
	watchLabel: string;
	isSubmitting?: boolean;
}

const StreamPreviewSection: React.FC<StreamPreviewSectionProps> = observer(
	({previewUrl, isPreviewLoading, isWatching, isPendingJoin, canWatch, onWatch, watchLabel, isSubmitting}) => {
		const {t} = useLingui();
		const isDisabled = !canWatch || isPendingJoin || isWatching || isSubmitting;

		const handleClick = useCallback(
			(event: React.MouseEvent) => {
				if (isDisabled) return;
				onWatch(event);
			},
			[isDisabled, onWatch],
		);

		return (
			<div
				className={clsx(styles.previewContainer, isSubmitting && styles.previewSubmitting)}
				onClick={handleClick}
				role="button"
				tabIndex={isDisabled ? -1 : 0}
				onKeyDown={(e) => {
					if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
						onWatch(e);
					}
				}}
			>
				{previewUrl ? (
					<img src={previewUrl} alt={t`Stream preview`} className={styles.previewImage} />
				) : (
					<div className={styles.previewFallback}>
						{isPreviewLoading ? <Spinner size="small" /> : t`No preview yet`}
					</div>
				)}
				{!isDisabled && (
					<div className={styles.previewHoverOverlay}>
						<span className={styles.previewHoverText}>{watchLabel}</span>
					</div>
				)}
			</div>
		);
	},
);
