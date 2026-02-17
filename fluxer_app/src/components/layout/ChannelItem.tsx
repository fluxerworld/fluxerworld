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
import * as GuildMemberActionCreators from '@app/actions/GuildMemberActionCreators';
import * as InviteActionCreators from '@app/actions/InviteActionCreators';
import * as LayoutActionCreators from '@app/actions/LayoutActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {CategoryBottomSheet} from '@app/components/bottomsheets/CategoryBottomSheet';
import {ChannelBottomSheet} from '@app/components/bottomsheets/ChannelBottomSheet';
import {VoiceLobbyBottomSheet} from '@app/components/bottomsheets/VoiceLobbyBottomSheet';
import {Typing} from '@app/components/channel/Typing';
import {getTypingText, usePresentableTypingUsers} from '@app/components/channel/TypingUsers';
import styles from '@app/components/layout/ChannelItem.module.css';
import {ChannelItemContent} from '@app/components/layout/ChannelItemContent';
import {ChannelItemIcon} from '@app/components/layout/ChannelItemIcon';
import channelItemSurfaceStyles from '@app/components/layout/ChannelItemSurface.module.css';
import {computeVerticalDropPosition} from '@app/components/layout/dnd/DndDropPosition';
import {GenericChannelItem} from '@app/components/layout/GenericChannelItem';
import type {ScrollIndicatorSeverity} from '@app/components/layout/ScrollIndicatorOverlay';
import {DND_TYPES, type DragItem, type DropResult} from '@app/components/layout/types/DndTypes';
import {isCategory, isTextChannel} from '@app/components/layout/utils/ChannelOrganization';
import {getChannelUnreadState} from '@app/components/layout/utils/ChannelUnreadState';
import {VoiceChannelUserCount} from '@app/components/layout/VoiceChannelUserCount';
import {ChannelCreateModal} from '@app/components/modals/ChannelCreateModal';
import {ChannelSettingsModal} from '@app/components/modals/ChannelSettingsModal';
import {ExternalLinkWarningModal} from '@app/components/modals/ExternalLinkWarningModal';
import {InviteModal} from '@app/components/modals/InviteModal';
import {AvatarStack} from '@app/components/uikit/avatars/AvatarStack';
import {CategoryContextMenu} from '@app/components/uikit/context_menu/CategoryContextMenu';
import {ChannelContextMenu} from '@app/components/uikit/context_menu/ChannelContextMenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {MentionBadge} from '@app/components/uikit/MentionBadge';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useConnectedVoiceSession} from '@app/hooks/useConnectedVoiceSession';
import {useContextMenuHoverState} from '@app/hooks/useContextMenuHoverState';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import {usePendingVoiceConnection} from '@app/hooks/usePendingVoiceConnection';
import {useTextOverflow} from '@app/hooks/useTextOverflow';
import {useLocation} from '@app/lib/router/React';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import AccessibilityStore, {ChannelTypingIndicatorMode} from '@app/stores/AccessibilityStore';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import AutocompleteStore from '@app/stores/AutocompleteStore';
import ChannelStore from '@app/stores/ChannelStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import PermissionStore from '@app/stores/PermissionStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import TrustedDomainStore from '@app/stores/TrustedDomainStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import * as InviteUtils from '@app/utils/InviteUtils';
import {stopPropagationOnEnterSpace} from '@app/utils/KeyboardUtils';
import {openExternalUrl} from '@app/utils/NativeUtils';
import * as PermissionUtils from '@app/utils/PermissionUtils';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {CaretDownIcon, GearIcon, PlusIcon, UserPlusIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ConnectableElement} from 'react-dnd';
import {useDrag, useDrop} from 'react-dnd';
import {getEmptyImage} from 'react-dnd-html5-backend';

interface ChannelItemCoreProps {
	channel: {
		name: string;
		type: number;
	};
	isSelected?: boolean;
	typingIndicator?: React.ReactNode;
	className?: string;
}

export const ChannelItemCore: React.FC<ChannelItemCoreProps> = observer(
	({channel, isSelected = false, typingIndicator, className}) => {
		const channelLabelRef = useRef<HTMLSpanElement>(null);
		const isChannelNameOverflowing = useTextOverflow(channelLabelRef);

		return (
			<div
				className={clsx(
					styles.channelItemCore,
					isSelected ? styles.channelItemCoreSelected : styles.channelItemCoreUnselected,
					className,
				)}
			>
				<Tooltip text={channel.name}>
					<div>
						{ChannelUtils.getIcon(channel, {
							className: clsx(
								styles.channelItemIcon,
								isSelected ? styles.channelItemIconSelected : styles.channelItemIconUnselected,
							),
						})}
					</div>
				</Tooltip>
				<Tooltip text={isChannelNameOverflowing ? channel.name : ''}>
					<span ref={channelLabelRef} className={styles.channelItemLabel}>
						{channel.name}
					</span>
				</Tooltip>
				<div className={styles.channelItemActions}>{typingIndicator}</div>
			</div>
		);
	},
);

export const ChannelItem = observer(
	({
		guild,
		channel,
		isCollapsed,
		onToggle,
		isDraggingAnything,
		activeDragItem,
		onChannelDrop,
		onDragStateChange,
	}: {
		guild: GuildRecord;
		channel: ChannelRecord;
		isCollapsed?: boolean;
		onToggle?: () => void;
		isDraggingAnything: boolean;
		activeDragItem?: DragItem | null;
		onChannelDrop?: (item: DragItem, result: DropResult) => void;
		onDragStateChange?: (item: DragItem | null) => void;
	}) => {
		const {t, i18n} = useLingui();
		const elementRef = useRef<HTMLDivElement | null>(null);
		const contextMenuOpen = useContextMenuHoverState(elementRef);

		const channelIsCategory = useMemo(() => isCategory(channel), [channel]);
		const channelIsVoice = useMemo(() => channel.type === ChannelTypes.GUILD_VOICE, [channel.type]);
		const channelIsText = useMemo(() => isTextChannel(channel), [channel]);
		const draggingChannel = useMemo(
			() => (activeDragItem?.type === DND_TYPES.CHANNEL ? activeDragItem : null),
			[activeDragItem],
		);
		const isVoiceDragActive = useMemo(
			() => draggingChannel?.channelType === ChannelTypes.GUILD_VOICE,
			[draggingChannel],
		);
		const shouldDimForVoiceDrag = useMemo(
			() => Boolean(isVoiceDragActive && channelIsText && channel.parentId !== null),
			[isVoiceDragActive, channelIsText, channel.parentId],
		);
		const location = useLocation();
		const channelPath = useMemo(() => `/channels/${guild.id}/${channel.id}`, [guild.id, channel.id]);
		const unreadCount = ReadStateStore.getUnreadCount(channel.id);
		const selectedChannelId = SelectedChannelStore.selectedChannelIds.get(guild.id);
		const {guildId: connectedVoiceGuildId, channelId: connectedVoiceChannelId} = useConnectedVoiceSession();
		const canManageChannels = PermissionStore.can(Permissions.MANAGE_CHANNELS, channel);
		const canInvite = InviteUtils.canInviteToChannel(channel.id, channel.guildId);
		const mobileLayout = MobileLayoutStore;
		const isMuted = UserGuildSettingsStore.isChannelMuted(guild.id, channel.id);
		const voiceStatesInChannel = MediaEngineStore.getAllVoiceStatesInChannel(guild.id, channel.id);
		const currentUserCount = useMemo(() => Object.keys(voiceStatesInChannel).length, [voiceStatesInChannel]);
		const isMobileLayout = MobileLayoutStore.isMobileLayout();
		const allowHoverAffordances = useMemo(() => !isMobileLayout, [isMobileLayout]);
		const [menuOpen, setMenuOpen] = useState(false);
		const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
		const [voiceLobbyOpen, setVoiceLobbyOpen] = useState(false);
		const lastClickTime = useRef<number>(0);
		const voiceChannelJoinRequiresDoubleClick = AccessibilityStore.voiceChannelJoinRequiresDoubleClick;
		const [isFocused, setIsFocused] = useState(false);
		const {keyboardModeEnabled} = KeyboardModeStore;

		const showKeyboardAffordances = useMemo(() => keyboardModeEnabled && isFocused, [keyboardModeEnabled, isFocused]);
		const currentUserId = AuthenticationStore.currentUserId;
		const currentUser = UserStore.getCurrentUser();
		const isUnclaimed = useMemo(() => !(currentUser?.isClaimed() ?? false), [currentUser]);
		const isGuildOwner = useMemo(() => (currentUser ? guild.isOwner(currentUser.id) : false), [currentUser, guild]);
		const currentMember = useMemo(
			() => (currentUserId ? GuildMemberStore.getMember(guild.id, currentUserId) : null),
			[currentUserId, guild.id],
		);
		const isCurrentUserTimedOut = useMemo(() => Boolean(currentMember?.isTimedOut()), [currentMember]);
		const voiceBlockedForUnclaimed = useMemo(
			() => channelIsVoice && isUnclaimed && !isGuildOwner,
			[channelIsVoice, isUnclaimed, isGuildOwner],
		);
		const voiceTooltipText = useMemo(
			() =>
				channelIsVoice && isCurrentUserTimedOut
					? t`You can't join while you're on timeout.`
					: channelIsVoice && voiceBlockedForUnclaimed
						? t`Claim your account to join this voice channel.`
						: undefined,
			[channelIsVoice, isCurrentUserTimedOut, voiceBlockedForUnclaimed, t],
		);

		const isVoiceSelected = useMemo(
			() =>
				channel.type === ChannelTypes.GUILD_VOICE &&
				connectedVoiceGuildId === guild.id &&
				connectedVoiceChannelId === channel.id,
			[channel.type, connectedVoiceGuildId, guild.id, connectedVoiceChannelId, channel.id],
		);
		const isOnMembersRoute = location.pathname === `/channels/${guild.id}/members`;
		const isSelected = useMemo(
			() =>
				isVoiceSelected ||
				location.pathname.startsWith(channelPath) ||
				(!isOnMembersRoute && selectedChannelId === channel.id),
			[isVoiceSelected, location.pathname, channelPath, isOnMembersRoute, selectedChannelId, channel.id],
		);
		const mentionCount = ReadStateStore.getMentionCount(channel.id);
		const unreadState = getChannelUnreadState({
			unreadCount,
			mentionCount,
			isMuted,
			showFadedUnreadOnMutedChannels: AccessibilityStore.showFadedUnreadOnMutedChannels,
		});
		const hasUnreadMessages = unreadState.hasUnreadMessages;
		const hasMentions = unreadState.hasMentions;
		const isHighlight = unreadState.isHighlight;
		const scrollIndicatorSeverity: ScrollIndicatorSeverity | undefined = useMemo(() => {
			if (channelIsCategory) return undefined;
			if (mentionCount > 0) return 'mention';
			if (hasUnreadMessages) return 'unread';
			return undefined;
		}, [channelIsCategory, mentionCount, hasUnreadMessages]);
		const scrollIndicatorId = useMemo(() => `channel-${channel.id}`, [channel.id]);
		const isAutocompleteHighlight = AutocompleteStore.highlightChannelId === channel.id;
		const typingUsers = usePresentableTypingUsers(channel);
		const channelTypingIndicatorMode = AccessibilityStore.channelTypingIndicatorMode;
		const showSelectedChannelTypingIndicator = AccessibilityStore.showSelectedChannelTypingIndicator;

		const handleVoiceConnected = useCallback(() => {
			NavigationActionCreators.selectChannel(guild.id, channel.id);
			if (MobileLayoutStore.isMobileLayout()) {
				LayoutActionCreators.updateMobileLayoutState(false, true);
			}
		}, [guild.id, channel.id]);

		const {startConnection: startVoiceConnection} = usePendingVoiceConnection({
			guildId: guild.id,
			channelId: channel.id,
			onConnected: handleVoiceConnected,
		});

		const [dropIndicator, setDropIndicator] = useState<{position: 'top' | 'bottom'; isValid: boolean} | null>(null);

		const dragItemData = useMemo<DragItem>(
			() => ({
				type: channelIsCategory ? DND_TYPES.CATEGORY : DND_TYPES.CHANNEL,
				id: channel.id,
				channelType: channel.type,
				parentId: channel.parentId,
				guildId: guild.id,
			}),
			[channelIsCategory, channel.id, channel.type, channel.parentId, guild.id],
		);

		const [{isDragging}, dragRef, preview] = useDrag(
			() => ({
				type: dragItemData.type,
				item: () => {
					onDragStateChange?.(dragItemData);
					return dragItemData;
				},
				canDrag: canManageChannels && !mobileLayout.enabled,
				collect: (monitor) => ({isDragging: monitor.isDragging()}),
				end: () => {
					onDragStateChange?.(null);
					setDropIndicator(null);
				},
			}),
			[dragItemData, canManageChannels, mobileLayout.enabled, onDragStateChange],
		);

		const [{isOver}, dropRef] = useDrop(
			() => ({
				accept: [DND_TYPES.CHANNEL, DND_TYPES.CATEGORY, DND_TYPES.VOICE_PARTICIPANT],
				canDrop: (item: DragItem) => {
					if (item.id === channel.id) return false;
					if (item.type === DND_TYPES.VOICE_PARTICIPANT) return channelIsVoice;
					if (item.type === DND_TYPES.CHANNEL) {
						if (item.channelType === ChannelTypes.GUILD_VOICE) {
							if (!channelIsCategory && !channelIsVoice && !channelIsText) return false;
						}
						if (item.channelType !== ChannelTypes.GUILD_VOICE && channelIsVoice) return false;
					}
					if (item.type === DND_TYPES.CATEGORY && channel.parentId !== null && !channelIsCategory) return false;
					return true;
				},
				hover: (_item: DragItem, monitor) => {
					const node = elementRef.current;
					if (!node) return;
					const hoverBoundingRect = node.getBoundingClientRect();
					const clientOffset = monitor.getClientOffset();
					if (!clientOffset) return;
					const dropPos = computeVerticalDropPosition(clientOffset, hoverBoundingRect);
					setDropIndicator({
						position: dropPos === 'before' ? 'top' : 'bottom',
						isValid: monitor.canDrop(),
					});
				},
				drop: (item: DragItem, monitor): DropResult | undefined => {
					if (!monitor.canDrop()) {
						setDropIndicator(null);
						return;
					}
					if (item.type === DND_TYPES.VOICE_PARTICIPANT && channelIsVoice) {
						const canMove = PermissionStore.can(Permissions.MOVE_MEMBERS, {guildId: guild.id});
						if (!canMove || item.currentChannelId === channel.id) {
							setDropIndicator(null);
							return;
						}
						const currentUserId = UserStore.getCurrentUser()?.id ?? null;
						if (currentUserId && item.userId === currentUserId) {
							void MediaEngineStore.connectToVoiceChannel(guild.id, channel.id);
							setDropIndicator(null);
							return;
						}
						const targetChannel = ChannelStore.getChannel(channel.id);
						if (targetChannel) {
							const canTargetConnect = PermissionUtils.can(Permissions.CONNECT, item.userId!, targetChannel.toJSON());
							if (!canTargetConnect) {
								setDropIndicator(null);
								return;
							}
						}
						void GuildMemberActionCreators.update(guild.id, item.userId!, {channel_id: channel.id});
						setDropIndicator(null);
						return;
					}
					const node = elementRef.current;
					if (!node) return;
					const hoverBoundingRect = node.getBoundingClientRect();
					const clientOffset = monitor.getClientOffset();
					if (!clientOffset) return;
					const dropPos = computeVerticalDropPosition(clientOffset, hoverBoundingRect);
					let result: DropResult;
					if (channelIsCategory) {
						result = {
							targetId: channel.id,
							position: dropPos === 'before' ? 'before' : 'inside',
							targetParentId: dropPos === 'before' ? channel.parentId : channel.id,
						};
					} else {
						result = {
							targetId: channel.id,
							position: dropPos === 'before' ? 'before' : 'after',
							targetParentId: channel.parentId,
						};
					}
					onChannelDrop?.(item, result);
					setDropIndicator(null);
					return result;
				},
				collect: (monitor) => ({
					isOver: monitor.isOver({shallow: true}),
					canDrop: monitor.canDrop(),
				}),
			}),
			[channel.id, channel.type, channel.parentId, guild.id, channelIsCategory, channelIsVoice, onChannelDrop],
		);

		useEffect(() => {
			if (!isOver) setDropIndicator(null);
		}, [isOver]);

		useEffect(() => {
			preview(getEmptyImage(), {captureDraggingState: true});
		}, [preview]);

		const handleSelect = useCallback(() => {
			if (channel.type === ChannelTypes.GUILD_VOICE && isCurrentUserTimedOut) {
				ToastActionCreators.createToast({
					type: 'error',
					children: t`You can't join while you're on timeout.`,
				});
				return;
			}
			if (channel.type === ChannelTypes.GUILD_VOICE && voiceBlockedForUnclaimed) {
				ToastActionCreators.createToast({
					type: 'error',
					children: t`Claim your account to join this voice channel.`,
				});
				return;
			}
			if (channel.type === ChannelTypes.GUILD_CATEGORY) {
				onToggle?.();
				return;
			}
			if (channel.type === ChannelTypes.GUILD_LINK && channel.url) {
				const inviteCode = InviteUtils.findInvite(channel.url);
				if (inviteCode) {
					void InviteActionCreators.openAcceptModal(inviteCode);
					return;
				}
				try {
					const parsed = new URL(channel.url);
					const isTrusted = TrustedDomainStore.isTrustedDomain(parsed.hostname);
					if (!isTrusted) {
						ModalActionCreators.push(modal(() => <ExternalLinkWarningModal url={channel.url!} />));
					} else {
						void openExternalUrl(channel.url);
					}
				} catch {}
				return;
			}
			if (channel.type === ChannelTypes.GUILD_VOICE) {
				if (isMobileLayout) {
					setVoiceLobbyOpen(true);
					return;
				}
				if (isVoiceSelected) {
					NavigationActionCreators.selectChannel(guild.id, channel.id);
					if (MobileLayoutStore.isMobileLayout()) {
						LayoutActionCreators.updateMobileLayoutState(false, true);
					}
				} else {
					if (voiceChannelJoinRequiresDoubleClick) {
						const now = Date.now();
						const timeSinceLastClick = now - lastClickTime.current;
						lastClickTime.current = now;

						if (timeSinceLastClick < 500) {
							startVoiceConnection();
						} else {
							NavigationActionCreators.selectChannel(guild.id, channel.id);
							if (MobileLayoutStore.isMobileLayout()) {
								LayoutActionCreators.updateMobileLayoutState(false, true);
							}
						}
					} else {
						startVoiceConnection();
					}
				}
				return;
			}
			NavigationActionCreators.selectChannel(guild.id, channel.id);
			if (MobileLayoutStore.isMobileLayout()) {
				LayoutActionCreators.updateMobileLayoutState(false, true);
			}
		}, [
			channel,
			guild.id,
			isVoiceSelected,
			onToggle,
			isMobileLayout,
			voiceChannelJoinRequiresDoubleClick,
			startVoiceConnection,
		]);

		const handleContextMenu = useCallback(
			(event: React.MouseEvent) => {
				event.preventDefault();
				event.stopPropagation();

				if (isMobileLayout) {
					return;
				}

				ContextMenuActionCreators.openFromEvent(event, ({onClose}) =>
					channelIsCategory ? (
						<CategoryContextMenu category={channel} onClose={onClose} />
					) : (
						<ChannelContextMenu channel={channel} onClose={onClose} />
					),
				);
			},
			[channel, channelIsCategory, isMobileLayout],
		);

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
		const mergedRef = useMergeRefs([dragConnectorRef, dropConnectorRef, elementRef]);

		const shouldShowSelectedState = useMemo(
			() =>
				!channelIsCategory &&
				isSelected &&
				(channel.type !== ChannelTypes.GUILD_VOICE || location.pathname.startsWith(channelPath)),
			[channelIsCategory, isSelected, channel.type, location.pathname, channelPath],
		);

		const hasMountedRef = useRef(false);

		useEffect(() => {
			if (shouldShowSelectedState && hasMountedRef.current) {
				elementRef.current?.scrollIntoView({block: 'nearest'});
			}
			hasMountedRef.current = true;
		}, [shouldShowSelectedState]);

		const extraContent = unreadState.shouldShowUnreadIndicator ? (
			<div className={clsx(styles.unreadIndicator, isMuted && styles.unreadIndicatorMuted)} />
		) : null;

		const ariaLabel = useMemo(
			() => `${channel.name} ${channelIsCategory ? 'category' : 'channel'}`,
			[channel.name, channelIsCategory],
		);

		const [isPointerHovered, setIsPointerHovered] = useState(false);
		const handleMouseEnter = useCallback(() => setIsPointerHovered(true), []);
		const handleMouseLeave = useCallback(() => setIsPointerHovered(false), []);

		const hoverAffordancesActive = useMemo(
			() =>
				allowHoverAffordances &&
				(contextMenuOpen || showKeyboardAffordances || shouldShowSelectedState || isPointerHovered),
			[allowHoverAffordances, contextMenuOpen, showKeyboardAffordances, shouldShowSelectedState, isPointerHovered],
		);
		const hasVoiceUserLimit = useMemo(
			() => channelIsVoice && channel.userLimit != null && channel.userLimit > 0,
			[channelIsVoice, channel.userLimit],
		);
		const hasVoiceHoverAffordances = useMemo(
			() => allowHoverAffordances && !isDraggingAnything && !channelIsCategory && (canInvite || canManageChannels),
			[allowHoverAffordances, isDraggingAnything, channelIsCategory, canInvite, canManageChannels],
		);
		const shouldShowVoiceUserCount = useMemo(
			() => hasVoiceUserLimit && !(hasVoiceHoverAffordances && hoverAffordancesActive),
			[hasVoiceUserLimit, hasVoiceHoverAffordances, hoverAffordancesActive],
		);
		const showMentionBadge = !isSelected && hasMentions && !hoverAffordancesActive;

		const channelItemClassName = useMemo(
			() =>
				clsx(
					styles.channelItem,
					channelItemSurfaceStyles.channelItemSurface,
					shouldShowSelectedState && channelItemSurfaceStyles.channelItemSurfaceSelected,
					isAutocompleteHighlight && styles.channelItemAutocompleteHighlight,
					channelIsCategory ? styles.channelItemCategory : styles.channelItemRegular,
					!channelIsCategory && isHighlight && !shouldShowSelectedState && styles.channelItemHighlight,
					!channelIsCategory && !(isHighlight || isSelected || isVoiceSelected) && styles.channelItemMuted,
					shouldShowSelectedState && styles.channelItemSelected,
					shouldShowSelectedState && isHighlight && styles.channelItemSelectedWithUnread,
					!channelIsCategory &&
						(!isSelected ||
							(channel.type === ChannelTypes.GUILD_VOICE && !location.pathname.startsWith(channelPath))) &&
						styles.channelItemHoverable,
					isOver && styles.channelItemOver,
					contextMenuOpen && !isSelected && !channelIsCategory && styles.channelItemContextMenu,
					contextMenuOpen && channelIsCategory && styles.channelItemCategoryContextMenu,
					isDragging && styles.channelItemDragging,
					shouldDimForVoiceDrag && !isSelected && styles.channelItemDimmed,
					isMuted && styles.channelItemMutedState,
					contextMenuOpen && styles.contextMenuOpen,
					showKeyboardAffordances && styles.keyboardFocus,
					channelIsVoice && styles.channelItemVoice,
					hoverAffordancesActive && styles.channelItemHoverAffordancesActive,
					voiceBlockedForUnclaimed && styles.channelItemDisabled,
				),
			[
				channelIsCategory,
				isAutocompleteHighlight,
				isHighlight,
				shouldShowSelectedState,
				isSelected,
				isVoiceSelected,
				channel.type,
				location.pathname,
				channelPath,
				isOver,
				contextMenuOpen,
				isDragging,
				shouldDimForVoiceDrag,
				isMuted,
				showKeyboardAffordances,
				channelIsVoice,
				voiceBlockedForUnclaimed,
				hoverAffordancesActive,
			],
		);

		const handleKeyDown = useCallback(
			(e: React.KeyboardEvent) => {
				if (e.key === 'Enter') handleSelect();
			},
			[handleSelect],
		);

		const handleFocus = useCallback(() => setIsFocused(true), []);
		const handleBlur = useCallback(() => setIsFocused(false), []);
		const handleLongPress = useCallback(() => {
			if (isMobileLayout) {
				if (channelIsCategory) {
					setCategoryMenuOpen(true);
				} else {
					setMenuOpen(true);
				}
			}
		}, [isMobileLayout, channelIsCategory]);

		const handleInviteClick = useCallback(() => {
			ModalActionCreators.push(modal(() => <InviteModal channelId={channel.id} />));
		}, [channel.id]);

		const handleCreateChannelClick = useCallback(
			(e: React.MouseEvent) => {
				e.stopPropagation();
				ModalActionCreators.push(modal(() => <ChannelCreateModal guildId={guild.id} parentId={channel.id} />));
			},
			[guild.id, channel.id],
		);

		const handleChannelSettingsClick = useCallback(() => {
			ModalActionCreators.push(modal(() => <ChannelSettingsModal channelId={channel.id} />));
		}, [channel.id]);

		const channelSettingsLabel = useMemo(
			() => (channelIsCategory ? t`Edit Category` : t`Channel Settings`),
			[channelIsCategory, t],
		);

		const channelIconNode = channelIsCategory
			? null
			: ChannelUtils.getIcon(channel, {
					className: clsx(
						styles.channelItemIcon,
						shouldShowSelectedState || (isHighlight && isSelected)
							? styles.channelItemIconSelected
							: isVoiceSelected && channel.type === ChannelTypes.GUILD_VOICE
								? styles.channelItemHighlight
								: isHighlight && !isSelected
									? styles.channelItemIconHighlight
									: styles.channelItemIconUnselected,
					),
				});

		const channelActionsNode = !isDraggingAnything && (
			<>
				{!channelIsCategory && channel.type !== ChannelTypes.GUILD_VOICE && (
					<>
						{typingUsers.length > 0 &&
							channelTypingIndicatorMode !== ChannelTypingIndicatorMode.HIDDEN &&
							(showSelectedChannelTypingIndicator || !isSelected) && (
								<Tooltip
									text={() => <span className={styles.typingTooltip}>{getTypingText(i18n, typingUsers, channel)}</span>}
								>
									<div className={styles.channelTypingIndicator}>
										<Typing className={styles.typingIndicatorIcon} size={20} />
										{channelTypingIndicatorMode === ChannelTypingIndicatorMode.AVATARS && (
											<AvatarStack
												size={12}
												maxVisible={5}
												className={styles.typingAvatars}
												users={typingUsers}
												guildId={channel.guildId}
												channelId={channel.id}
											/>
										)}
									</div>
								</Tooltip>
							)}
						{showMentionBadge && <MentionBadge mentionCount={mentionCount} size="small" />}
					</>
				)}
				{shouldShowVoiceUserCount && channel.userLimit != null && (
					<div className={styles.voiceUserCount}>
						<VoiceChannelUserCount currentUserCount={currentUserCount} userLimit={channel.userLimit} />
					</div>
				)}
				{allowHoverAffordances && canInvite && !channelIsCategory && (
					<div className={styles.hoverAffordance}>
						<ChannelItemIcon
							icon={UserPlusIcon}
							label={t`Invite Members`}
							selected={shouldShowSelectedState}
							onClick={handleInviteClick}
						/>
					</div>
				)}
				{allowHoverAffordances && channelIsCategory && canManageChannels && (
					<div className={styles.hoverAffordance}>
						<Tooltip text={t`Create Channel`}>
							<FocusRing offset={-2}>
								<button
									type="button"
									className={styles.createChannelButton}
									onClick={handleCreateChannelClick}
									onKeyDown={stopPropagationOnEnterSpace}
								>
									<PlusIcon weight="bold" className={styles.createChannelIcon} />
								</button>
							</FocusRing>
						</Tooltip>
					</div>
				)}
				{allowHoverAffordances && canManageChannels && (
					<div className={styles.hoverAffordance}>
						<ChannelItemIcon
							icon={GearIcon}
							label={channelSettingsLabel}
							selected={shouldShowSelectedState}
							onClick={handleChannelSettingsClick}
						/>
					</div>
				)}
				{channelIsCategory && (
					<CaretDownIcon
						weight="bold"
						className={styles.categoryIcon}
						style={{transform: `rotate(${isCollapsed ? -90 : 0}deg)`}}
					/>
				)}
			</>
		);

		const channelItem = (
			<GenericChannelItem
				innerRef={mergedRef}
				containerClassName={styles.container}
				extraContent={extraContent}
				isOver={isOver}
				dropIndicator={dropIndicator}
				disabled={!isMobileLayout}
				data-dnd-name={channel.name}
				dataScrollIndicator={scrollIndicatorSeverity}
				dataScrollId={scrollIndicatorId}
				aria-label={ariaLabel}
				className={channelItemClassName}
				onClick={handleSelect}
				onContextMenu={handleContextMenu}
				onKeyDown={handleKeyDown}
				onFocus={handleFocus}
				onBlur={handleBlur}
				onLongPress={handleLongPress}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				<ChannelItemContent
					icon={channelIconNode}
					name={channel.name ?? ''}
					actions={channelActionsNode}
					isCategory={channelIsCategory}
				/>
			</GenericChannelItem>
		);
		const channelWrapper = useMemo(
			() =>
				voiceTooltipText ? (
					<Tooltip text={voiceTooltipText} position="top">
						{channelItem}
					</Tooltip>
				) : (
					channelItem
				),
			[voiceTooltipText, channelItem],
		);

		const handleCloseMenu = useCallback(() => setMenuOpen(false), []);
		const handleCloseCategoryMenu = useCallback(() => setCategoryMenuOpen(false), []);
		const handleCloseLobby = useCallback(() => setVoiceLobbyOpen(false), []);

		return (
			<>
				{channelWrapper}
				{isMobileLayout && !channelIsCategory && (
					<ChannelBottomSheet isOpen={menuOpen} onClose={handleCloseMenu} channel={channel} guild={guild} />
				)}
				{isMobileLayout && channelIsCategory && (
					<CategoryBottomSheet isOpen={categoryMenuOpen} onClose={handleCloseCategoryMenu} category={channel} />
				)}
				{isMobileLayout && channel.type === ChannelTypes.GUILD_VOICE && (
					<VoiceLobbyBottomSheet isOpen={voiceLobbyOpen} onClose={handleCloseLobby} channel={channel} guild={guild} />
				)}
			</>
		);
	},
);
