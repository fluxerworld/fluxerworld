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

import * as ChannelActionCreators from '@app/actions/ChannelActionCreators';
import * as InviteActionCreators from '@app/actions/InviteActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import * as ReadStateActionCreators from '@app/actions/ReadStateActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {ChannelDebugModal} from '@app/components/debug/ChannelDebugModal';
import {ChannelSettingsModal} from '@app/components/modals/ChannelSettingsModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {EditGroupModal} from '@app/components/modals/EditGroupModal';
import {ExternalLinkWarningModal} from '@app/components/modals/ExternalLinkWarningModal';
import {GroupInvitesModal} from '@app/components/modals/GroupInvitesModal';
import {GuildNotificationSettingsModal} from '@app/components/modals/GuildNotificationSettingsModal';
import {InviteModal} from '@app/components/modals/InviteModal';
import {
	CloseDMIcon,
	CopyIdIcon,
	CopyLinkIcon,
	DebugChannelIcon,
	DeleteIcon,
	EditGroupIcon,
	FavoriteIcon,
	InviteIcon,
	LeaveIcon,
	MarkAsReadIcon,
	MuteIcon,
	NotificationSettingsIcon,
	OpenLinkIcon,
	PinIcon,
	SendInvitesIcon,
	SettingsIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import type {MenuGroupType, MenuItemType} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {useLeaveGroup} from '@app/hooks/useLeaveGroup';
import {Logger} from '@app/lib/Logger';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import FavoritesStore from '@app/stores/FavoritesStore';
import PermissionStore from '@app/stores/PermissionStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import TrustedDomainStore from '@app/stores/TrustedDomainStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import {getMutedText} from '@app/utils/ContextMenuUtils';
import * as InviteUtils from '@app/utils/InviteUtils';
import {buildChannelLink} from '@app/utils/MessageLinkUtils';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {useMemo} from 'react';

const logger = new Logger('ChannelMenuData');

export interface ChannelMenuDataOptions {
	onClose: () => void;
	onOpenMuteSheet?: () => void;
}

export interface ChannelMenuData {
	groups: Array<MenuGroupType>;
	handlers: ChannelMenuHandlers;
	state: ChannelMenuState;
}

export interface ChannelMenuHandlers {
	handleMarkAsRead: () => void;
	handleToggleFavorite: () => void;
	handleInviteMembers: () => void;
	handleCopyChannelLink: () => Promise<void>;
	handleOpenChannelLink: () => void;
	handleOpenMuteSheet: () => void;
	handleNotificationSettings: () => void;
	handleChannelSettings: () => void;
	handleDeleteChannel: () => void;
	handleCopyChannelId: () => Promise<void>;
	handleEditGroup: () => void;
	handleShowInvites: () => void;
	handlePinChannel: () => Promise<void>;
	handleUnpinChannel: () => Promise<void>;
	handleLeaveGroup: () => void;
	handleCloseDM: () => void;
	handleDebugChannel: () => void;
}

export interface ChannelMenuState {
	isGroupDM: boolean;
	isDM: boolean;
	isTextChannel: boolean;
	isVoiceChannel: boolean;
	isLinkChannel: boolean;
	isOwner: boolean;
	isMuted: boolean;
	isFavorited: boolean;
	hasUnread: boolean;
	canManageChannels: boolean;
	canInvite: boolean;
	developerMode: boolean;
	isPinned: boolean;
	mutedText: string | undefined;
}

function getChannelMenuState(channel: ChannelRecord, guild: GuildRecord | undefined): ChannelMenuState {
	const currentUserId = AuthenticationStore.currentUserId;
	const isGroupDM = channel.type === ChannelTypes.GROUP_DM;
	const isDM = channel.type === ChannelTypes.DM;
	const isTextChannel = channel.type === ChannelTypes.GUILD_TEXT;
	const isVoiceChannel = channel.type === ChannelTypes.GUILD_VOICE;
	const isLinkChannel = channel.type === ChannelTypes.GUILD_LINK;
	const isOwner = isGroupDM && channel.ownerId === currentUserId;
	const settingsGuildId = guild?.id ?? null;
	const channelOverride = UserGuildSettingsStore.getChannelOverride(settingsGuildId, channel.id);
	const isMuted = channelOverride?.muted ?? false;
	const muteConfig = channelOverride?.mute_config;
	const mutedText = getMutedText(isMuted, muteConfig);
	const isFavorited = !!FavoritesStore.getChannel(channel.id);
	const readState = ReadStateStore.get(channel.id);
	const hasUnread = readState.hasUnread();
	const canManageChannels = PermissionStore.can(Permissions.MANAGE_CHANNELS, {
		channelId: channel.id,
		guildId: channel.guildId,
	});
	const canInvite = InviteUtils.canInviteToChannel(channel.id, channel.guildId);
	const developerMode = UserSettingsStore.developerMode;
	const isPinned = channel.isPinned;

	return {
		isGroupDM,
		isDM,
		isTextChannel,
		isVoiceChannel,
		isLinkChannel,
		isOwner,
		isMuted,
		isFavorited,
		hasUnread,
		canManageChannels,
		canInvite,
		developerMode,
		isPinned,
		mutedText,
	};
}

export function useChannelMenuData(
	channel: ChannelRecord,
	guild: GuildRecord | undefined,
	options: ChannelMenuDataOptions,
): ChannelMenuData {
	const {t, i18n} = useLingui();
	const {onClose, onOpenMuteSheet} = options;
	const leaveGroup = useLeaveGroup();

	const state = useMemo(() => getChannelMenuState(channel, guild), [channel, guild]);

	const handlers = useMemo(
		() => ({
			handleMarkAsRead: () => {
				ReadStateActionCreators.ack(channel.id, true, true);
				onClose();
			},
			handleToggleFavorite: () => {
				onClose();
				const guildId = channel.guildId ?? ME;
				const isFavorited = !!FavoritesStore.getChannel(channel.id);
				if (isFavorited) {
					FavoritesStore.removeChannel(channel.id);
					ToastActionCreators.createToast({type: 'success', children: t`Removed from favorites`});
				} else {
					FavoritesStore.addChannel(channel.id, guildId, null);
					ToastActionCreators.createToast({type: 'success', children: t`Added to favorites`});
				}
			},
			handleInviteMembers: () => {
				onClose();
				ModalActionCreators.push(modal(() => <InviteModal channelId={channel.id} />));
			},
			handleCopyChannelLink: async () => {
				const link = buildChannelLink({
					guildId: channel.guildId,
					channelId: channel.id,
				});
				await TextCopyActionCreators.copy(i18n, link, true);
				ToastActionCreators.createToast({
					type: 'success',
					children: t`Channel link copied`,
				});
				onClose();
			},
			handleOpenChannelLink: () => {
				const channelUrl = channel.url;
				if (!channelUrl) return;

				const inviteCode = InviteUtils.findInvite(channelUrl);
				if (inviteCode) {
					void InviteActionCreators.openAcceptModal(inviteCode);
					onClose();
					return;
				}

				try {
					const parsedUrl = new URL(channelUrl);
					const isTrusted = TrustedDomainStore.isTrustedDomain(parsedUrl.hostname);
					if (!isTrusted) {
						ModalActionCreators.push(modal(() => <ExternalLinkWarningModal url={channelUrl} />));
					} else {
						void openExternalUrl(channelUrl);
					}
				} catch {}
				onClose();
			},
			handleOpenMuteSheet: () => {
				onOpenMuteSheet?.();
			},
			handleNotificationSettings: () => {
				onClose();
				if (guild) {
					ModalActionCreators.push(modal(() => <GuildNotificationSettingsModal guildId={guild.id} />));
				}
			},
			handleChannelSettings: () => {
				onClose();
				ModalActionCreators.push(modal(() => <ChannelSettingsModal channelId={channel.id} />));
			},
			handleDeleteChannel: () => {
				onClose();
				ModalActionCreators.push(
					modal(() => (
						<ConfirmModal
							title={t`Delete Channel`}
							description={t`Are you sure you want to delete #${channel.name ?? channel.id}? This action cannot be undone.`}
							primaryText={t`Delete Channel`}
							primaryVariant="danger-primary"
							onPrimary={async () => {
								try {
									await ChannelActionCreators.remove(channel.id);
									ToastActionCreators.createToast({
										type: 'success',
										children: t`Channel deleted`,
									});
								} catch (error) {
									logger.error('Failed to delete channel:', error);
									ToastActionCreators.createToast({
										type: 'error',
										children: t`Failed to delete channel`,
									});
								}
							}}
						/>
					)),
				);
			},
			handleCopyChannelId: async () => {
				await TextCopyActionCreators.copy(i18n, channel.id, true);
				ToastActionCreators.createToast({
					type: 'success',
					children: t`Channel ID copied`,
				});
				onClose();
			},
			handleEditGroup: () => {
				onClose();
				ModalActionCreators.push(modal(() => <EditGroupModal channelId={channel.id} />));
			},
			handleShowInvites: () => {
				onClose();
				ModalActionCreators.push(modal(() => <GroupInvitesModal channelId={channel.id} />));
			},
			handlePinChannel: async () => {
				onClose();
				const isGroupDM = channel.type === ChannelTypes.GROUP_DM;
				try {
					await PrivateChannelActionCreators.pinDmChannel(channel.id);
					ToastActionCreators.createToast({
						type: 'success',
						children: isGroupDM ? t`Pinned group` : t`Pinned DM`,
					});
				} catch (error) {
					logger.error('Failed to pin:', error);
				}
			},
			handleUnpinChannel: async () => {
				onClose();
				const isGroupDM = channel.type === ChannelTypes.GROUP_DM;
				try {
					await PrivateChannelActionCreators.unpinDmChannel(channel.id);
					ToastActionCreators.createToast({
						type: 'success',
						children: isGroupDM ? t`Unpinned group` : t`Unpinned DM`,
					});
				} catch (error) {
					logger.error('Failed to unpin:', error);
				}
			},
			handleLeaveGroup: () => {
				onClose();
				leaveGroup?.(channel.id);
			},
			handleCloseDM: () => {
				onClose();
				ChannelActionCreators.remove(channel.id);
			},
			handleDebugChannel: () => {
				onClose();
				ModalActionCreators.push(modal(() => <ChannelDebugModal title={t`Channel Debug`} channel={channel} />));
			},
		}),
		[channel, guild, i18n, leaveGroup, onClose, onOpenMuteSheet, t],
	);

	const groups = useMemo(() => {
		const menuGroups: Array<MenuGroupType> = [];

		if (state.isGroupDM) {
			const primaryItems: Array<MenuItemType> = [
				{
					icon: <EditGroupIcon size={20} />,
					label: t`Edit Group`,
					onClick: handlers.handleEditGroup,
				},
				state.isPinned
					? {
							icon: <PinIcon size={20} />,
							label: t`Unpin Group DM`,
							onClick: handlers.handleUnpinChannel,
						}
					: {
							icon: <PinIcon size={20} />,
							label: t`Pin Group DM`,
							onClick: handlers.handlePinChannel,
						},
			];

			if (state.isOwner) {
				primaryItems.push({
					icon: <SendInvitesIcon size={20} />,
					label: t`Invites`,
					onClick: handlers.handleShowInvites,
				});
			}

			menuGroups.push({items: primaryItems});

			const secondaryItems: Array<MenuItemType> = [
				{
					icon: <LeaveIcon size={20} />,
					label: t`Leave Group`,
					onClick: handlers.handleLeaveGroup,
					danger: true,
				},
			];

			if (state.developerMode) {
				secondaryItems.push({
					icon: <DebugChannelIcon size={20} />,
					label: t`Debug Channel`,
					onClick: handlers.handleDebugChannel,
				});
			}

			secondaryItems.push({
				icon: <CopyIdIcon size={20} />,
				label: t`Copy Channel ID`,
				onClick: handlers.handleCopyChannelId,
			});

			menuGroups.push({items: secondaryItems});

			return menuGroups;
		}

		if (state.isDM) {
			const items: Array<MenuItemType> = [
				state.isPinned
					? {
							icon: <PinIcon size={20} />,
							label: t`Unpin DM`,
							onClick: handlers.handleUnpinChannel,
						}
					: {
							icon: <PinIcon size={20} />,
							label: t`Pin DM`,
							onClick: handlers.handlePinChannel,
						},
				{
					icon: <CloseDMIcon size={20} />,
					label: t`Close DM`,
					onClick: handlers.handleCloseDM,
					danger: true,
				},
			];

			if (state.developerMode) {
				items.push({
					icon: <DebugChannelIcon size={20} />,
					label: t`Debug Channel`,
					onClick: handlers.handleDebugChannel,
				});
			}

			items.push({
				icon: <CopyIdIcon size={20} />,
				label: t`Copy Channel ID`,
				onClick: handlers.handleCopyChannelId,
			});

			menuGroups.push({items});

			return menuGroups;
		}

		if (guild && (state.isTextChannel || state.isVoiceChannel || state.isLinkChannel)) {
			if (state.hasUnread) {
				menuGroups.push({
					items: [
						{
							icon: <MarkAsReadIcon size={20} />,
							label: t`Mark as Read`,
							onClick: handlers.handleMarkAsRead,
						},
					],
				});
			}

			if (AccessibilityStore.showFavorites) {
				menuGroups.push({
					items: [
						{
							icon: <FavoriteIcon filled={state.isFavorited} size={20} />,
							label: state.isFavorited ? t`Remove from Favorites` : t`Add to Favorites`,
							onClick: handlers.handleToggleFavorite,
						},
					],
				});
			}

			const inviteItems: Array<MenuItemType> = [];
			if (state.canInvite) {
				inviteItems.push({
					icon: <InviteIcon size={20} />,
					label: t`Invite People`,
					onClick: handlers.handleInviteMembers,
				});
			}
			if (state.isLinkChannel && channel.url) {
				inviteItems.push({
					icon: <OpenLinkIcon size={20} />,
					label: t`Open Link`,
					onClick: handlers.handleOpenChannelLink,
				});
			}
			inviteItems.push({
				icon: <CopyLinkIcon size={20} />,
				label: t`Copy Channel Link`,
				onClick: handlers.handleCopyChannelLink,
			});
			menuGroups.push({items: inviteItems});

			const notificationItems: Array<MenuItemType> = [];
			if (!state.isLinkChannel) {
				notificationItems.push({
					icon: state.isMuted ? <MuteIcon size={20} /> : <NotificationSettingsIcon size={20} />,
					label: state.isMuted ? t`Unmute Channel` : t`Mute Channel`,
					onClick: handlers.handleOpenMuteSheet,
				});
			}
			notificationItems.push({
				icon: <NotificationSettingsIcon size={20} />,
				label: t`Notification Settings`,
				onClick: handlers.handleNotificationSettings,
			});
			menuGroups.push({items: notificationItems});

			if (state.canManageChannels) {
				menuGroups.push({
					items: [
						{
							icon: <SettingsIcon size={20} />,
							label: t`Edit Channel`,
							onClick: handlers.handleChannelSettings,
						},
						{
							icon: <DeleteIcon size={20} />,
							label: t`Delete Channel`,
							onClick: handlers.handleDeleteChannel,
							danger: true,
						},
					],
				});
			}

			if (state.developerMode) {
				menuGroups.push({
					items: [
						{
							icon: <DebugChannelIcon size={20} />,
							label: t`Debug Channel`,
							onClick: handlers.handleDebugChannel,
						},
					],
				});
			}

			menuGroups.push({
				items: [
					{
						icon: <CopyIdIcon size={20} />,
						label: t`Copy Channel ID`,
						onClick: handlers.handleCopyChannelId,
					},
				],
			});

			return menuGroups;
		}

		return [];
	}, [state, handlers, guild, t]);

	return {
		groups,
		handlers,
		state,
	};
}
