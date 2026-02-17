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
import {GuildHeaderBottomSheet} from '@app/components/bottomsheets/GuildHeaderBottomSheet';
import {GuildBadge} from '@app/components/guild/GuildBadge';
import {LongPressable} from '@app/components/LongPressable';
import {computeVerticalDropPosition} from '@app/components/layout/dnd/DndDropPosition';
import styles from '@app/components/layout/GuildsLayout.module.css';
import {VoiceBadge, type VoiceBadgeActivity} from '@app/components/layout/guild_list/VoiceBadge';
import type {ScrollIndicatorSeverity} from '@app/components/layout/ScrollIndicatorOverlay';
import {DND_TYPES, type GuildDragItem, type GuildDropResult} from '@app/components/layout/types/DndTypes';
import {AvatarStack} from '@app/components/uikit/avatars/AvatarStack';
import {GuildContextMenu} from '@app/components/uikit/context_menu/GuildContextMenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {KeybindHint} from '@app/components/uikit/keybind_hint/KeybindHint';
import {MentionBadgeAnimated} from '@app/components/uikit/MentionBadge';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {
	createVoiceParticipantSortSnapshot,
	sortVoiceParticipantItemsWithSnapshot,
} from '@app/components/voice/VoiceParticipantSortUtils';
import {useContextMenuHoverState} from '@app/hooks/useContextMenuHoverState';
import {useHover} from '@app/hooks/useHover';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import type {GuildRecord} from '@app/records/GuildRecord';
import type {UserRecord} from '@app/records/UserRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import GuildStore from '@app/stores/GuildStore';
import KeybindStore from '@app/stores/KeybindStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import PermissionStore from '@app/stores/PermissionStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import * as DateUtils from '@app/utils/DateUtils';
import {getInitialsLength} from '@app/utils/GuildInitialsUtils';
import * as ImageCacheUtils from '@app/utils/ImageCacheUtils';
import {isMobileExperienceEnabled} from '@app/utils/MobileExperience';
import * as StringUtils from '@app/utils/StringUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {GuildFeatures} from '@fluxer/constants/src/GuildConstants';
import {useLingui} from '@lingui/react/macro';
import {BellSlashIcon, ExclamationMarkIcon, MonitorPlayIcon, PauseIcon, SpeakerHighIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ConnectableElement} from 'react-dnd';
import {useDrag, useDrop} from 'react-dnd';
import {getEmptyImage} from 'react-dnd-html5-backend';

interface GuildListItemProps {
	guild: GuildRecord;
	isSortingList?: boolean;
	isSelected: boolean;
	guildIndex?: number;
	selectedGuildIndex?: number;
	onGuildDrop?: (item: GuildDragItem, result: GuildDropResult) => void;
	onDragStateChange?: (item: GuildDragItem | null) => void;
	disableDrag?: boolean;
	insideFolderId?: number | null;
}

interface VoiceRow {
	key: 'voice' | 'screenshare';
	users: Array<UserRecord>;
}

interface GuildVoiceSummary {
	voiceUsers: Array<UserRecord>;
	streamingUsers: Array<UserRecord>;
	hasScreenshare: boolean;
	hasVideo: boolean;
}

interface CombinePreviewProps {
	targetGuild: GuildRecord;
	sourceGuildId: string;
}

function CombinePreview({targetGuild, sourceGuildId}: CombinePreviewProps) {
	const sourceGuild = GuildStore.getGuild(sourceGuildId);
	if (!sourceGuild) return null;

	const targetIcon = AvatarUtils.getGuildIconURL(targetGuild, false);
	const sourceIcon = AvatarUtils.getGuildIconURL(sourceGuild, false);
	const targetInitials = StringUtils.getInitialsFromName(targetGuild.name);
	const sourceInitials = StringUtils.getInitialsFromName(sourceGuild.name);

	return (
		<div className={styles.combinePreview}>
			<div className={styles.combinePreviewGrid}>
				<div
					className={clsx(styles.combinePreviewIcon, !targetIcon && styles.combinePreviewIconInitials)}
					style={targetIcon ? {backgroundImage: `url(${targetIcon})`} : undefined}
				>
					{!targetIcon && <span>{targetInitials?.slice(0, 2)}</span>}
				</div>
				<div
					className={clsx(styles.combinePreviewIcon, !sourceIcon && styles.combinePreviewIconInitials)}
					style={sourceIcon ? {backgroundImage: `url(${sourceIcon})`} : undefined}
				>
					{!sourceIcon && <span>{sourceInitials?.slice(0, 2)}</span>}
				</div>
				<div className={clsx(styles.combinePreviewIcon, styles.combinePreviewIconEmpty)} />
				<div className={clsx(styles.combinePreviewIcon, styles.combinePreviewIconEmpty)} />
			</div>
		</div>
	);
}

export const GuildListItem = observer(
	({
		guild,
		isSortingList = false,
		isSelected,
		guildIndex,
		selectedGuildIndex,
		onGuildDrop,
		onDragStateChange,
		disableDrag = false,
		insideFolderId,
	}: GuildListItemProps) => {
		const {t} = useLingui();
		const initials = StringUtils.getInitialsFromName(guild.name);
		const initialsLength = useMemo(() => (initials ? getInitialsLength(initials) : null), [initials]);
		const guildAriaLabel = useMemo(() => {
			if (isSelected) return t`${guild.name} (selected)`;
			return guild.name;
		}, [guild.name, isSelected, t]);
		const [hoverRef, isHovering] = useHover();
		const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
		const isMobileExperience = isMobileExperienceEnabled();
		const mobileLayout = MobileLayoutStore;
		const targetRadius = '50%';

		const guildReadSentinel = GuildReadStateStore.getGuildChangeSentinel(guild.id);
		const hasUnreadMessages = GuildReadStateStore.hasUnread(guild.id);
		const mentionCount = GuildReadStateStore.getMentionCount(guild.id);
		const guildScrollSeverity: ScrollIndicatorSeverity | undefined = (() => {
			if (mentionCount > 0) return 'mention';
			if (hasUnreadMessages) return 'unread';
			return undefined;
		})();
		const guildScrollId = `guild-${guild.id}`;
		const selectedChannel = SelectedChannelStore.selectedChannelIds.get(guild.id);

		const guildSettings = UserGuildSettingsStore.getSettings(guild.id);
		const isMuted = guildSettings?.muted || false;
		const muteConfig = guildSettings?.mute_config;
		const canManageGuild = PermissionStore.can(Permissions.MANAGE_GUILD, guild);
		const voiceUserSortSnapshotRef = useRef(createVoiceParticipantSortSnapshot());
		const streamingUserSortSnapshotRef = useRef(createVoiceParticipantSortSnapshot());

		const allVoiceStates = MediaEngineStore.getAllVoiceStates();
		const voiceSummary = useMemo<GuildVoiceSummary>(() => {
			const guildVoiceStates = allVoiceStates[guild.id];
			if (!guildVoiceStates) {
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
			for (const channelStates of Object.values(guildVoiceStates)) {
				for (const voiceState of Object.values(channelStates)) {
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
			}
			const sortedVoiceUsers = sortVoiceParticipantItemsWithSnapshot(voiceUsers, {
				snapshot: voiceUserSortSnapshotRef.current,
				getParticipantKey: (user) => user.id,
				getUserId: (user) => user.id,
				guildId: guild.id,
			});
			const sortedStreamingUsers = sortVoiceParticipantItemsWithSnapshot(streamingUsers, {
				snapshot: streamingUserSortSnapshotRef.current,
				getParticipantKey: (user) => user.id,
				getUserId: (user) => user.id,
				guildId: guild.id,
			});

			return {
				voiceUsers: sortedVoiceUsers,
				streamingUsers: sortedStreamingUsers,
				hasScreenshare,
				hasVideo,
			};
		}, [allVoiceStates, guild.id]);
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
			if (!hasVoiceActivity) return null;
			if (voiceSummary.hasScreenshare) return 'screenshare';
			if (voiceSummary.hasVideo) return 'video';
			return 'voice';
		}, [hasVoiceActivity, voiceSummary.hasScreenshare, voiceSummary.hasVideo]);

		const iconUrl = AvatarUtils.getGuildIconURL(guild, false);
		const hoverIconUrl = AvatarUtils.getGuildIconURL(guild, true);

		const [isStaticLoaded, setIsStaticLoaded] = useState(ImageCacheUtils.hasImage(iconUrl));
		const [isAnimatedLoaded, setIsAnimatedLoaded] = useState(ImageCacheUtils.hasImage(hoverIconUrl));
		const [shouldPlayAnimated, setShouldPlayAnimated] = useState(false);
		const [dropIndicator, setDropIndicator] = useState<'top' | 'bottom' | 'combine' | null>(null);
		const [combineSourceGuildId, setCombineSourceGuildId] = useState<string | null>(null);

		const dragItemData = useMemo<GuildDragItem>(
			() => ({
				type: DND_TYPES.GUILD_ITEM,
				id: guild.id,
				isFolder: false,
				folderId: insideFolderId,
			}),
			[guild.id, insideFolderId],
		);

		const [{isDragging}, dragRef, preview] = useDrag(
			() => ({
				type: DND_TYPES.GUILD_ITEM,
				item: () => {
					onDragStateChange?.(dragItemData);
					return dragItemData;
				},
				canDrag: !disableDrag && !mobileLayout.enabled,
				collect: (monitor) => ({isDragging: monitor.isDragging()}),
				end: () => {
					onDragStateChange?.(null);
					setDropIndicator(null);
				},
			}),
			[dragItemData, disableDrag, mobileLayout.enabled, onDragStateChange],
		);

		const [{isOver}, dropRef] = useDrop(
			() => ({
				accept: [DND_TYPES.GUILD_ITEM, DND_TYPES.GUILD_FOLDER],
				canDrop: (item: GuildDragItem) => item.id !== guild.id,
				hover: (item: GuildDragItem, monitor) => {
					if (item.id === guild.id) {
						setDropIndicator(null);
						setCombineSourceGuildId(null);
						return;
					}
					const node = itemRef.current;
					if (!node) return;
					const clientOffset = monitor.getClientOffset();
					if (!clientOffset) return;
					const boundingRect = node.getBoundingClientRect();
					const canCombine = !item.isFolder && insideFolderId == null;
					const dropPos = computeVerticalDropPosition(clientOffset, boundingRect, canCombine ? 0.25 : 0.5);

					if (dropPos === 'center') {
						setDropIndicator('combine');
						setCombineSourceGuildId(item.id);
					} else {
						setDropIndicator(dropPos === 'before' ? 'top' : 'bottom');
						setCombineSourceGuildId(null);
					}
				},
				drop: (item: GuildDragItem, monitor): GuildDropResult | undefined => {
					if (!monitor.canDrop()) {
						setDropIndicator(null);
						return;
					}
					const node = itemRef.current;
					if (!node) return;
					const clientOffset = monitor.getClientOffset();
					if (!clientOffset) return;
					const boundingRect = node.getBoundingClientRect();
					const canCombine = !item.isFolder && insideFolderId == null;
					const dropPos = computeVerticalDropPosition(clientOffset, boundingRect, canCombine ? 0.25 : 0.5);

					let position: 'before' | 'after' | 'combine';
					if (dropPos === 'center') {
						position = 'combine';
					} else {
						position = dropPos;
					}

					const result: GuildDropResult = {
						targetId: guild.id,
						position,
						targetIsFolder: false,
						targetFolderId: insideFolderId,
					};
					onGuildDrop?.(item, result);
					setDropIndicator(null);
					return result;
				},
				collect: (monitor) => ({
					isOver: monitor.isOver({shallow: true}),
				}),
			}),
			[guild.id, onGuildDrop, insideFolderId],
		);

		useEffect(() => {
			if (!isOver) {
				setDropIndicator(null);
				setCombineSourceGuildId(null);
			}
		}, [isOver]);

		useEffect(() => {
			preview(getEmptyImage(), {captureDraggingState: true});
		}, [preview]);

		const itemRef = useRef<HTMLElement | null>(null);
		const contextMenuOpen = useContextMenuHoverState(itemRef);

		useEffect(() => {
			ImageCacheUtils.loadImage(iconUrl, () => setIsStaticLoaded(true));
			if (isHovering || contextMenuOpen) {
				ImageCacheUtils.loadImage(hoverIconUrl, () => setIsAnimatedLoaded(true));
			}
		}, [iconUrl, hoverIconUrl, isHovering, contextMenuOpen]);

		useEffect(() => {
			setShouldPlayAnimated((isHovering || contextMenuOpen) && isAnimatedLoaded);
		}, [isHovering, isAnimatedLoaded, contextMenuOpen]);

		const handleSelect = () => {
			NavigationActionCreators.selectGuild(guild.id, isMobileExperience ? undefined : selectedChannel);
		};

		const handleContextMenu = useCallback(
			(event: React.MouseEvent) => {
				if (isSortingList) return;

				event.preventDefault();
				event.stopPropagation();

				if (isMobileExperience) {
					return;
				}

				ContextMenuActionCreators.openFromEvent(event, (props) => (
					<GuildContextMenu guild={guild} onClose={props.onClose} />
				));
			},
			[guild, isSortingList, isMobileExperience],
		);

		const handleOpenBottomSheet = useCallback(() => {
			setBottomSheetOpen(true);
		}, []);

		const handleCloseBottomSheet = useCallback(() => {
			setBottomSheetOpen(false);
		}, []);

		const handleLongPress = useCallback(() => {
			if (isSortingList) return;
			if (isMobileExperience) {
				handleOpenBottomSheet();
			}
		}, [handleOpenBottomSheet, isMobileExperience, isSortingList]);

		const shouldShowHoverState = isHovering || contextMenuOpen;
		const indicatorHeight = (() => {
			if (isSelected) return 40;
			if (shouldShowHoverState) return 20;
			return 8;
		})();
		const isActive = isSelected || shouldShowHoverState;

		const focusableRef = useRef<HTMLDivElement | null>(null);
		const focusRingTargetRef = useRef<HTMLDivElement | null>(null);

		const dragConnectorRef = useCallback(
			(node: ConnectableElement | null) => {
				dragRef(node);
			},
			[dragRef],
		);
		const dropConnectorRef = useCallback(
			(node: ConnectableElement | null) => {
				dropRef(node);
			},
			[dropRef],
		);
		const mergedRef = useMergeRefs([dragConnectorRef, dropConnectorRef, hoverRef, focusableRef, itemRef]);

		useEffect(() => {
			if (isSelected) {
				focusableRef.current?.scrollIntoView({block: 'nearest'});
			}
		}, [isSelected]);

		const getMutedText = () => {
			if (!isMuted) return null;
			const now = Date.now();
			if (muteConfig?.end_time && new Date(muteConfig.end_time).getTime() <= now) {
				return null;
			}
			if (muteConfig?.end_time) {
				return t`Muted until ${DateUtils.getFormattedDateTime(new Date(muteConfig.end_time))}`;
			}
			return t`Muted`;
		};

		const getNavigationKeybind = () => {
			if (guildIndex === undefined || selectedGuildIndex === undefined || selectedGuildIndex === -1) {
				return null;
			}
			if (guildIndex < selectedGuildIndex) {
				return KeybindStore.getByAction('navigate_server_previous').combo;
			}
			if (guildIndex > selectedGuildIndex) {
				return KeybindStore.getByAction('navigate_server_next').combo;
			}
			return null;
		};

		const navigationKeybind = getNavigationKeybind();

		return (
			<>
				<Tooltip
					position="right"
					maxWidth="xl"
					size="large"
					text={() =>
						!isSortingList && (
							<div className={styles.guildTooltipContainer}>
								<div className={styles.guildTooltipHeader}>
									<GuildBadge features={guild.features} showTooltip={false} />
									<span className={styles.guildTooltipName}>{guild.name}</span>
								</div>
								{guild.unavailable && (
									<span className={styles.guildTooltipMessage}>We fluxed up! Hang tight, we're working on it.</span>
								)}
								{guild.features.has(GuildFeatures.UNAVAILABLE_FOR_EVERYONE_BUT_STAFF) && (
									<span className={styles.guildTooltipError}>Only accessible to Fluxer staff</span>
								)}
								{canManageGuild && guild.features.has(GuildFeatures.INVITES_DISABLED) && (
									<span
										className={styles.guildTooltipMessage}
									>{t`Invites are currently paused in this community`}</span>
								)}
								{isMuted && (
									<div className={styles.guildMutedInfo}>
										<BellSlashIcon weight="fill" className={styles.guildMutedIcon} />
										<span className={styles.guildMutedText}>{getMutedText()}</span>
									</div>
								)}
								{voiceRows.map((row) => (
									<div key={row.key} className={styles.guildVoiceInfo}>
										{row.key === 'screenshare' ? (
											<MonitorPlayIcon weight="fill" className={styles.guildVoiceIcon} />
										) : (
											<SpeakerHighIcon className={styles.guildVoiceIcon} />
										)}
										<AvatarStack size={28} maxVisible={3} users={row.users} guildId={guild.id} />
									</div>
								))}
								{navigationKeybind && <KeybindHint combo={navigationKeybind} />}
							</div>
						)
					}
				>
					<FocusRing focusTarget={focusableRef} ringTarget={focusRingTargetRef} offset={-2}>
						<LongPressable
							className={clsx(
								styles.guildListItem,
								contextMenuOpen && styles.contextMenuHover,
								dropIndicator === 'top' && styles.dropIndicatorTop,
								dropIndicator === 'bottom' && styles.dropIndicatorBottom,
								dropIndicator === 'combine' && styles.dropIndicatorCombine,
							)}
							aria-label={guildAriaLabel}
							aria-pressed={isSelected}
							onClick={handleSelect}
							onContextMenu={handleContextMenu}
							onKeyDown={(event) => event.key === 'Enter' && handleSelect()}
							ref={mergedRef as React.Ref<HTMLDivElement>}
							role="button"
							tabIndex={0}
							data-guild-list-focus-item="true"
							data-scroll-indicator={guildScrollSeverity}
							data-scroll-id={guildScrollId}
							data-guild-read-sentinel={guildReadSentinel}
							onLongPress={handleLongPress}
						>
							<AnimatePresence>
								{!isSortingList && (hasUnreadMessages || isSelected || shouldShowHoverState) && (
									<div className={styles.guildIndicator}>
										<motion.span
											className={styles.guildIndicatorBar}
											initial={false}
											animate={{opacity: 1, scale: 1, height: indicatorHeight}}
											exit={
												AccessibilityStore.useReducedMotion
													? {opacity: 1, scale: 1, height: 0}
													: {opacity: 0, scale: 0, height: 0}
											}
											transition={{
												duration: AccessibilityStore.useReducedMotion ? 0 : 0.2,
												ease: [0.25, 0.1, 0.25, 1],
											}}
										/>
									</div>
								)}
							</AnimatePresence>

							<div className={styles.relative}>
								<motion.div
									ref={focusRingTargetRef}
									tabIndex={-1}
									className={clsx(
										styles.guildIcon,
										!guild.icon && styles.guildIconNoImage,
										isSelected && styles.guildIconSelected,
									)}
									animate={{borderRadius: isActive ? '30%' : targetRadius}}
									initial={false}
									transition={{duration: AccessibilityStore.useReducedMotion ? 0 : 0.07, ease: 'easeOut'}}
									whileHover={AccessibilityStore.useReducedMotion ? undefined : {borderRadius: '30%'}}
									data-initials-length={initialsLength}
									style={{
										backgroundImage: isStaticLoaded
											? `url(${shouldPlayAnimated && isAnimatedLoaded ? hoverIconUrl : iconUrl})`
											: undefined,
										cursor: isDragging ? 'grabbing' : undefined,
										opacity: isDragging ? 0.5 : 1,
									}}
								>
									{!guild.icon && <span className={styles.guildIconInitials}>{initials}</span>}
								</motion.div>

								{!(isSortingList || guild.unavailable) && (
									<div className={clsx(styles.guildBadge, mentionCount > 0 && styles.guildBadgeActive)}>
										<MentionBadgeAnimated mentionCount={mentionCount} size="small" />
									</div>
								)}

								{voiceBadgeActivity && !isSortingList && <VoiceBadge activity={voiceBadgeActivity} />}

								{canManageGuild &&
									guild.features.has(GuildFeatures.INVITES_DISABLED) &&
									!isSortingList &&
									mentionCount === 0 &&
									!hasVoiceActivity && (
										<div className={styles.guildInvitesPausedBadge}>
											<div className={styles.guildInvitesPausedBadgeInner}>
												<PauseIcon weight="fill" className={styles.guildInvitesPausedIcon} />
											</div>
										</div>
									)}

								{(guild.unavailable || guild.features.has(GuildFeatures.UNAVAILABLE_FOR_EVERYONE_BUT_STAFF)) &&
									!isSortingList && (
										<div className={styles.guildErrorBadge}>
											<div className={styles.guildErrorBadgeInner}>
												<ExclamationMarkIcon weight="regular" className={styles.guildErrorIcon} />
											</div>
										</div>
									)}
							</div>

							{dropIndicator === 'combine' && combineSourceGuildId && (
								<CombinePreview targetGuild={guild} sourceGuildId={combineSourceGuildId} />
							)}
						</LongPressable>
					</FocusRing>
				</Tooltip>
				{isMobileExperience && (
					<GuildHeaderBottomSheet isOpen={bottomSheetOpen} onClose={handleCloseBottomSheet} guild={guild} />
				)}
			</>
		);
	},
);
