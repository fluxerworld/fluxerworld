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
import {DMBottomSheet} from '@app/components/bottomsheets/DMBottomSheet';
import {GroupDMAvatar} from '@app/components/common/GroupDMAvatar';
import {LongPressable} from '@app/components/LongPressable';
import guildStyles from '@app/components/layout/GuildsLayout.module.css';
import styles from '@app/components/layout/guild_list/GuildListDMItem.module.css';
import {VoiceBadge, type VoiceBadgeActivity} from '@app/components/layout/guild_list/VoiceBadge';
import type {ScrollIndicatorSeverity} from '@app/components/layout/ScrollIndicatorOverlay';
import {AvatarStack} from '@app/components/uikit/avatars/AvatarStack';
import {DMContextMenu} from '@app/components/uikit/context_menu/DMContextMenu';
import {GroupDMContextMenu} from '@app/components/uikit/context_menu/GroupDMContextMenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {MentionBadgeAnimated} from '@app/components/uikit/MentionBadge';
import {StatusAwareAvatar} from '@app/components/uikit/StatusAwareAvatar';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {
	createVoiceParticipantSortSnapshot,
	sortVoiceParticipantItemsWithSnapshot,
} from '@app/components/voice/VoiceParticipantSortUtils';
import {useHover} from '@app/hooks/useHover';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {UserRecord} from '@app/records/UserRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import CallStateStore from '@app/stores/CallStateStore';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import {isMobileExperienceEnabled} from '@app/utils/MobileExperience';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {MonitorPlayIcon, SpeakerHighIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useRef, useState} from 'react';

interface DMListItemProps {
	channel: ChannelRecord;
	isSelected: boolean;
	className?: string;
	voiceCallActive?: boolean;
}

interface VoiceRow {
	key: 'voice' | 'screenshare';
	users: Array<UserRecord>;
}

interface DMVoiceSummary {
	voiceUsers: Array<UserRecord>;
	streamingUsers: Array<UserRecord>;
	hasScreenshare: boolean;
	hasVideo: boolean;
}

export const DMListItem = observer(({channel, isSelected, className, voiceCallActive = false}: DMListItemProps) => {
	const {t} = useLingui();
	const [hoverRef, isHovering] = useHover();
	const buttonRef = useRef<HTMLButtonElement | null>(null);
	const iconRef = useRef<HTMLDivElement | null>(null);
	const mergedButtonRef = useMergeRefs([hoverRef, buttonRef]);
	const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
	const isMobileExperience = isMobileExperienceEnabled();
	const [isFocused, setIsFocused] = useState(false);
	const {keyboardModeEnabled} = KeyboardModeStore;

	const mentionCount = ReadStateStore.getMentionCount(channel.id);
	const hasUnreadMessages = ReadStateStore.hasUnread(channel.id);
	const dmScrollSeverity: ScrollIndicatorSeverity | undefined = (() => {
		if (mentionCount > 0) return 'mention';
		if (hasUnreadMessages) return 'unread';
		return undefined;
	})();
	const dmScrollId = `dm-${channel.id}`;

	const isGroupDM = channel.type === ChannelTypes.GROUP_DM;
	const recipient = !isGroupDM ? UserStore.getUser(channel.recipientIds[0]) : null;
	const isMuted = UserGuildSettingsStore.isChannelMuted(null, channel.id);

	const directMessageName = recipient ? NicknameUtils.getNickname(recipient) : null;
	const computedDisplayName = ChannelUtils.getDMDisplayName(channel);
	const displayName = isGroupDM ? computedDisplayName : (directMessageName ?? computedDisplayName);
	const hasActiveCall = CallStateStore.hasActiveCall(channel.id);
	const voiceUserSortSnapshotRef = useRef(createVoiceParticipantSortSnapshot());
	const streamingUserSortSnapshotRef = useRef(createVoiceParticipantSortSnapshot());
	const allVoiceStates = MediaEngineStore.getAllVoiceStates();
	const voiceSummary = useMemo<DMVoiceSummary>(() => {
		if (!hasActiveCall && !voiceCallActive) {
			return {
				voiceUsers: [],
				streamingUsers: [],
				hasScreenshare: false,
				hasVideo: false,
			};
		}

		const dmChannelVoiceStates = allVoiceStates[ME]?.[channel.id];
		if (!dmChannelVoiceStates) {
			return {
				voiceUsers: [],
				streamingUsers: [],
				hasScreenshare: false,
				hasVideo: false,
			};
		}

		const voiceUsers: Array<UserRecord> = [];
		const streamingUsers: Array<UserRecord> = [];
		const seen = new Set<string>();
		let hasScreenshare = false;
		let hasVideo = false;

		for (const voiceState of Object.values(dmChannelVoiceStates)) {
			const isScreensharing = voiceState.self_stream === true;
			const isVideo = voiceState.self_video === true;
			if (isScreensharing) {
				hasScreenshare = true;
			}
			if (isVideo) {
				hasVideo = true;
			}
			if (seen.has(voiceState.user_id)) continue;
			const user = UserStore.getUser(voiceState.user_id);
			if (!user) continue;

			if (isScreensharing) {
				streamingUsers.push(user);
			} else {
				voiceUsers.push(user);
			}
			seen.add(user.id);
		}

		const sortedVoiceUsers = sortVoiceParticipantItemsWithSnapshot(voiceUsers, {
			snapshot: voiceUserSortSnapshotRef.current,
			getParticipantKey: (user) => user.id,
			getUserId: (user) => user.id,
			channelId: channel.id,
		});
		const sortedStreamingUsers = sortVoiceParticipantItemsWithSnapshot(streamingUsers, {
			snapshot: streamingUserSortSnapshotRef.current,
			getParticipantKey: (user) => user.id,
			getUserId: (user) => user.id,
			channelId: channel.id,
		});

		return {
			voiceUsers: sortedVoiceUsers,
			streamingUsers: sortedStreamingUsers,
			hasScreenshare,
			hasVideo,
		};
	}, [allVoiceStates, channel.id, hasActiveCall, voiceCallActive]);
	const voiceRows = useMemo<Array<VoiceRow>>(() => {
		const rows: Array<VoiceRow> = [];
		if (voiceSummary.voiceUsers.length > 0) {
			rows.push({key: 'voice', users: voiceSummary.voiceUsers});
		}
		if (voiceSummary.streamingUsers.length > 0) {
			rows.push({key: 'screenshare', users: voiceSummary.streamingUsers});
		}
		return rows;
	}, [voiceSummary.streamingUsers, voiceSummary.voiceUsers]);
	const hasVoiceActivity = voiceSummary.voiceUsers.length > 0 || voiceSummary.streamingUsers.length > 0;
	const voiceBadgeActivity = useMemo<VoiceBadgeActivity | null>(() => {
		if (!hasVoiceActivity) return voiceCallActive ? 'voice' : null;
		if (voiceSummary.hasScreenshare) return 'screenshare';
		if (voiceSummary.hasVideo) return 'video';
		return 'voice';
	}, [hasVoiceActivity, voiceCallActive, voiceSummary.hasScreenshare, voiceSummary.hasVideo]);
	const dmAriaLabel = useMemo(() => {
		if (isSelected) return t`${displayName} (selected)`;
		return displayName;
	}, [displayName, isSelected, t]);

	const handleSelect = () => {
		NavigationActionCreators.selectChannel(ME, channel.id);
	};

	const handleOpenBottomSheet = useCallback(() => {
		setBottomSheetOpen(true);
	}, []);

	const handleCloseBottomSheet = useCallback(() => {
		setBottomSheetOpen(false);
	}, []);

	const handleLongPress = useCallback(() => {
		if (isMobileExperience) {
			handleOpenBottomSheet();
		}
	}, [isMobileExperience, handleOpenBottomSheet]);

	const handleContextMenu = useCallback(
		(event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();

			if (isMobileExperience) {
				return;
			}

			ContextMenuActionCreators.openFromEvent(event, (props) =>
				isGroupDM ? (
					<GroupDMContextMenu channel={channel} onClose={props.onClose} />
				) : (
					<DMContextMenu channel={channel} recipient={recipient} onClose={props.onClose} />
				),
			);
		},
		[channel, isGroupDM, recipient, isMobileExperience],
	);

	if (!isGroupDM && !recipient) return null;

	const indicatorHeight = (() => {
		if (isSelected) return 40;
		if (isHovering) return 20;
		return 8;
	})();
	const tooltipContent = useMemo<string | (() => React.ReactNode)>(() => {
		if (!hasVoiceActivity) {
			return displayName;
		}

		return () => (
			<div className={guildStyles.guildTooltipContainer}>
				<div className={guildStyles.guildTooltipHeader}>
					<span className={guildStyles.guildTooltipName}>{displayName}</span>
				</div>
				{voiceRows.map((row) => (
					<div key={row.key} className={guildStyles.guildVoiceInfo}>
						{row.key === 'screenshare' ? (
							<MonitorPlayIcon weight="fill" className={guildStyles.guildVoiceIcon} />
						) : (
							<SpeakerHighIcon className={guildStyles.guildVoiceIcon} />
						)}
						<AvatarStack size={28} maxVisible={3} users={row.users} channelId={channel.id} />
					</div>
				))}
			</div>
		);
	}, [channel.id, displayName, hasVoiceActivity, voiceRows]);

	const showControls = isHovering || (keyboardModeEnabled && isFocused);

	return (
		<>
			<Tooltip position="right" size="large" text={tooltipContent}>
				<LongPressable
					className={clsx(guildStyles.dmListItem, className, isMuted && styles.muted)}
					onLongPress={handleLongPress}
					data-scroll-indicator={dmScrollSeverity}
					data-scroll-id={dmScrollId}
				>
					<FocusRing offset={-2} focusTarget={buttonRef} ringTarget={iconRef}>
						<button
							type="button"
							className={styles.button}
							aria-label={dmAriaLabel}
							aria-pressed={isSelected}
							data-guild-list-focus-item="true"
							onClick={handleSelect}
							onContextMenu={handleContextMenu}
							onFocus={() => setIsFocused(true)}
							onBlur={() => setIsFocused(false)}
							ref={mergedButtonRef}
						>
							<AnimatePresence>
								{(hasUnreadMessages || isSelected || showControls) && (
									<div className={guildStyles.guildIndicator}>
										<motion.span
											className={guildStyles.guildIndicatorBar}
											initial={false}
											animate={{opacity: 1, scale: 1, height: indicatorHeight}}
											exit={
												AccessibilityStore.useReducedMotion
													? {opacity: 1, scale: 1, height: indicatorHeight}
													: {opacity: 0, scale: 0, height: 0}
											}
											transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.2, ease: [0.25, 0.1, 0.25, 1]}}
										/>
									</div>
								)}
							</AnimatePresence>

							<div className={styles.relative}>
								<motion.div
									ref={iconRef}
									className={guildStyles.dmIcon}
									animate={{borderRadius: isSelected || showControls ? '30%' : '50%'}}
									initial={false}
									transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.07, ease: 'easeOut'}}
									whileHover={AccessibilityStore.useReducedMotion ? undefined : {borderRadius: '30%'}}
								>
									{isGroupDM ? (
										<GroupDMAvatar channel={channel} size={44} disableStatusIndicator />
									) : (
										recipient && (
											<StatusAwareAvatar
												disablePresence={true}
												user={recipient}
												size={44}
												className={styles.fullSize}
											/>
										)
									)}
								</motion.div>

								<div className={clsx(guildStyles.guildBadge, mentionCount > 0 && guildStyles.guildBadgeActive)}>
									<MentionBadgeAnimated mentionCount={mentionCount} size="small" />
								</div>

								{voiceBadgeActivity && <VoiceBadge activity={voiceBadgeActivity} />}
							</div>
						</button>
					</FocusRing>
				</LongPressable>
			</Tooltip>
			{isMobileExperience && (
				<DMBottomSheet
					isOpen={bottomSheetOpen}
					onClose={handleCloseBottomSheet}
					channel={channel}
					recipient={recipient}
				/>
			)}
		</>
	);
});
