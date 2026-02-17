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
import * as MessageActionCreators from '@app/actions/MessageActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import * as ReadStateActionCreators from '@app/actions/ReadStateActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as UserProfileActionCreators from '@app/actions/UserProfileActionCreators';
import {DMCloseFailedModal} from '@app/components/alerts/DMCloseFailedModal';
import {GroupLeaveFailedModal} from '@app/components/alerts/GroupLeaveFailedModal';
import {ChannelDebugModal} from '@app/components/debug/ChannelDebugModal';
import {UserDebugModal} from '@app/components/debug/UserDebugModal';
import {ChangeFriendNicknameModal} from '@app/components/modals/ChangeFriendNicknameModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {EditGroupModal} from '@app/components/modals/EditGroupModal';
import {GroupInvitesModal} from '@app/components/modals/GroupInvitesModal';
import {
	AcceptFriendRequestIcon,
	AddNoteIcon,
	BlockUserIcon,
	CloseDMIcon,
	CopyIdIcon,
	DebugIcon,
	EditGroupIcon,
	EditIcon,
	FavoriteIcon,
	GroupInvitesIcon,
	InviteToCommunityIcon,
	LeaveIcon,
	MarkAsReadIcon,
	MuteIcon,
	PinIcon,
	RemoveFriendIcon,
	SendFriendRequestIcon,
	SendInviteToCommunityIcon,
	ViewProfileIcon,
	VoiceCallIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import type {
	MenuGroupType,
	MenuItemType,
	MenuSubmenuItemType,
} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {Logger} from '@app/lib/Logger';
import {Routes} from '@app/Routes';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import type {UserRecord} from '@app/records/UserRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import FavoritesStore from '@app/stores/FavoritesStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import UserStore from '@app/stores/UserStore';
import * as CallUtils from '@app/utils/CallUtils';
import {getMutedText} from '@app/utils/ContextMenuUtils';
import * as InviteUtils from '@app/utils/InviteUtils';
import * as RelationshipActionUtils from '@app/utils/RelationshipActionUtils';
import * as RouterUtils from '@app/utils/RouterUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {PublicUserFlags, RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import type {Invite} from '@fluxer/schema/src/domains/invite/InviteSchemas';
import {fromTimestamp} from '@fluxer/snowflake/src/SnowflakeUtils';
import {useLingui} from '@lingui/react/macro';
import {useCallback, useMemo} from 'react';

const logger = new Logger('DMMenuData');

interface InviteCandidate {
	guild: GuildRecord;
	channelId: string;
}

const getDefaultInviteChannelId = (guildId: string): string | null => {
	const selectedChannelId = SelectedChannelStore.selectedChannelIds.get(guildId);
	if (selectedChannelId) {
		const selectedChannel = ChannelStore.getChannel(selectedChannelId);
		if (selectedChannel?.guildId && InviteUtils.canInviteToChannel(selectedChannel.id, selectedChannel.guildId)) {
			return selectedChannel.id;
		}
	}

	const guildChannels = ChannelStore.getGuildChannels(guildId);
	for (const channel of guildChannels) {
		if (channel.type === ChannelTypes.GUILD_TEXT && InviteUtils.canInviteToChannel(channel.id, channel.guildId)) {
			return channel.id;
		}
	}

	return null;
};

export interface DMMenuHandlers {
	handleMarkAsRead: () => void;
	handleToggleFavorite: () => void;
	handleViewProfile: () => void;
	handleStartVoiceCall: () => Promise<void>;
	handleAddNote: () => void;
	handleChangeFriendNickname: () => void;
	handleInviteToCommunity: (guildId: string, channelId: string, guildName: string) => Promise<void>;
	handleSendFriendRequest: () => void;
	handleAcceptFriendRequest: () => void;
	handleRemoveFriend: () => void;
	handleBlockUser: () => void;
	handleUnblockUser: () => void;
	handleCloseDM: () => void;
	handleLeaveGroup: () => void;
	handlePinDM: () => Promise<void>;
	handleUnpinDM: () => Promise<void>;
	handleEditGroup: () => void;
	handleShowInvites: () => void;
	handleCopyChannelId: () => Promise<void>;
	handleCopyUserId: () => Promise<void>;
	handleDebugUser: () => void;
	handleDebugChannel: () => void;
}

export interface DMMenuDataOptions {
	onClose: () => void;
	onOpenMuteSheet?: () => void;
}

export interface DMMenuData {
	groups: Array<MenuGroupType>;
	handlers: DMMenuHandlers;
	invitableCommunities: Array<InviteCandidate>;
	isGroupDM: boolean;
	isOwner: boolean;
	isMuted: boolean;
	mutedText: string | null;
	isFavorited: boolean;
	relationshipType: number | undefined;
	isRecipientBot: boolean | undefined;
	isRecipientSystem: boolean;
	restrictRecipientActions: boolean;
	developerMode: boolean;
}

export function useDMMenuData(
	channel: ChannelRecord,
	recipient: UserRecord | null | undefined,
	options: DMMenuDataOptions,
): DMMenuData {
	const {t, i18n} = useLingui();
	const {onClose, onOpenMuteSheet} = options;

	const isGroupDM = channel.type === ChannelTypes.GROUP_DM;
	const currentUserId = AuthenticationStore.currentUserId;
	const isOwner = isGroupDM && channel.ownerId === currentUserId;
	const developerMode = UserSettingsStore.developerMode;

	const channelOverride = UserGuildSettingsStore.getChannelOverride(null, channel.id);
	const isMuted = channelOverride?.muted ?? false;
	const muteConfig = channelOverride?.mute_config;
	const mutedText = getMutedText(isMuted, muteConfig);

	const hasUnread = ReadStateStore.hasUnread(channel.id);
	const isFavorited = !!FavoritesStore.getChannel(channel.id);
	const isRecipientBot = recipient?.bot;
	const recipientFlags = recipient?.flags ?? 0;
	const isFriendlyBot = Boolean(
		isRecipientBot && (recipientFlags & PublicUserFlags.FRIENDLY_BOT) === PublicUserFlags.FRIENDLY_BOT,
	);
	const relationship = recipient ? RelationshipStore.getRelationship(recipient.id) : null;
	const relationshipType = relationship?.type;
	const currentUserUnclaimed = !(UserStore.currentUser?.isClaimed() ?? true);
	const isRecipientSystem = recipient?.system ?? false;
	const restrictRecipientActions = isRecipientSystem;

	const invitableCommunities = useMemo(() => {
		if (!recipient || isRecipientBot) return [];
		return GuildStore.getGuilds()
			.filter((guild) => !GuildMemberStore.getMember(guild.id, recipient.id))
			.map((guild): InviteCandidate | null => {
				const channelId = getDefaultInviteChannelId(guild.id);
				return channelId ? {guild, channelId} : null;
			})
			.filter((candidate): candidate is InviteCandidate => candidate !== null)
			.sort((a, b) => a.guild.name.localeCompare(b.guild.name));
	}, [recipient, isRecipientBot]);

	const handleMarkAsRead = useCallback(() => {
		ReadStateActionCreators.ack(channel.id, true, true);
		onClose();
	}, [channel.id, onClose]);

	const handleToggleFavorite = useCallback(() => {
		onClose();
		if (isFavorited) {
			FavoritesStore.removeChannel(channel.id);
			ToastActionCreators.createToast({type: 'success', children: t`Removed from Favorites`});
		} else {
			FavoritesStore.addChannel(channel.id, ME, null);
			ToastActionCreators.createToast({type: 'success', children: t`Added to Favorites`});
		}
	}, [channel.id, isFavorited, onClose]);

	const handleViewProfile = useCallback(() => {
		if (!recipient) return;
		onClose();
		UserProfileActionCreators.openUserProfile(recipient.id);
	}, [recipient, onClose]);

	const handleStartVoiceCall = useCallback(async () => {
		if (!recipient) return;
		onClose();
		try {
			const channelId = await PrivateChannelActionCreators.ensureDMChannel(recipient.id);
			await CallUtils.checkAndStartCall(channelId);
		} catch (error) {
			logger.error('Failed to start voice call:', error);
		}
	}, [recipient, onClose]);

	const handleAddNote = useCallback(() => {
		if (!recipient) return;
		onClose();
		UserProfileActionCreators.openUserProfile(recipient.id, undefined, true);
	}, [recipient, onClose]);

	const handleChangeFriendNickname = useCallback(() => {
		if (!recipient) return;
		onClose();
		ModalActionCreators.push(modal(() => <ChangeFriendNicknameModal user={recipient} />));
	}, [recipient, onClose]);

	const handleInviteToCommunity = useCallback(
		async (_guildId: string, channelId: string, guildName: string) => {
			if (!recipient) return;
			onClose();

			let invite: Invite;
			try {
				invite = await InviteActionCreators.create(channelId);
			} catch {
				return;
			}

			const inviteUrl = `${RuntimeConfigStore.inviteEndpoint}/${invite.code}`;
			const dmChannelId = await PrivateChannelActionCreators.ensureDMChannel(recipient.id);
			try {
				const result = await MessageActionCreators.send(dmChannelId, {
					content: inviteUrl,
					nonce: fromTimestamp(Date.now()),
				});

				if (result) {
					ToastActionCreators.createToast({
						type: 'success',
						children: t`Invite sent to ${guildName}`,
					});
				}
			} catch (error) {
				logger.error('Failed to send community invite:', error);
				ToastActionCreators.error(t`Failed to send invite. Please try again.`);
			}
		},
		[recipient, onClose],
	);

	const handleSendFriendRequest = useCallback(() => {
		if (!recipient) return;
		RelationshipActionUtils.sendFriendRequest(i18n, recipient.id);
		onClose();
	}, [recipient, i18n, onClose]);

	const handleAcceptFriendRequest = useCallback(() => {
		if (!recipient) return;
		RelationshipActionUtils.acceptFriendRequest(i18n, recipient.id);
		onClose();
	}, [recipient, i18n, onClose]);

	const handleRemoveFriend = useCallback(() => {
		if (!recipient) return;
		onClose();
		RelationshipActionUtils.showRemoveFriendConfirmation(i18n, recipient);
	}, [recipient, i18n, onClose]);

	const handleBlockUser = useCallback(() => {
		if (!recipient) return;
		onClose();
		RelationshipActionUtils.showBlockUserConfirmation(i18n, recipient);
	}, [recipient, i18n, onClose]);

	const handleUnblockUser = useCallback(() => {
		if (!recipient) return;
		onClose();
		RelationshipActionUtils.unblockUser(i18n, recipient.id);
	}, [recipient, i18n, onClose]);

	const handleCloseDM = useCallback(() => {
		onClose();
		ModalActionCreators.push(
			modal(() => (
				<ConfirmModal
					title={t`Close DM`}
					description={t`Are you sure you want to close your DM with ${recipient?.username ?? ''}? You can always reopen it later.`}
					primaryText={t`Close DM`}
					primaryVariant="danger-primary"
					onPrimary={async () => {
						try {
							await ChannelActionCreators.remove(channel.id);
							const selectedChannel = SelectedChannelStore.selectedChannelIds.get(ME);
							if (selectedChannel === channel.id) {
								RouterUtils.transitionTo(Routes.ME);
							}
							ToastActionCreators.createToast({
								type: 'success',
								children: t`DM closed`,
							});
						} catch (error) {
							logger.error('Failed to close DM:', error);
							window.setTimeout(() => {
								ModalActionCreators.push(modal(() => <DMCloseFailedModal />));
							}, 0);
						}
					}}
				/>
			)),
		);
	}, [channel.id, recipient?.username, onClose]);

	const handleLeaveGroup = useCallback(() => {
		if (!currentUserId) {
			onClose();
			return;
		}

		onClose();
		ModalActionCreators.push(
			modal(() => (
				<ConfirmModal
					title={t`Leave Group`}
					description={t`Are you sure you want to leave this group? You will no longer be able to see any messages.`}
					primaryText={t`Leave Group`}
					primaryVariant="danger-primary"
					onPrimary={async () => {
						try {
							await PrivateChannelActionCreators.removeRecipient(channel.id, currentUserId);
							const selectedChannel = SelectedChannelStore.selectedChannelIds.get(ME);
							if (selectedChannel === channel.id) {
								RouterUtils.transitionTo(Routes.ME);
							}
							ToastActionCreators.createToast({
								type: 'success',
								children: t`Left group`,
							});
						} catch (error) {
							logger.error('Failed to leave group:', error);
							window.setTimeout(() => {
								ModalActionCreators.push(modal(() => <GroupLeaveFailedModal />));
							}, 0);
						}
					}}
				/>
			)),
		);
	}, [channel.id, currentUserId, onClose]);

	const handlePinDM = useCallback(async () => {
		onClose();
		try {
			await PrivateChannelActionCreators.pinDmChannel(channel.id);
			ToastActionCreators.createToast({
				type: 'success',
				children: isGroupDM ? t`Pinned group DM` : t`Pinned DM`,
			});
		} catch (error) {
			logger.error('Failed to pin:', error);
			ToastActionCreators.createToast({
				type: 'error',
				children: isGroupDM ? t`Failed to pin group DM` : t`Failed to pin DM`,
			});
		}
	}, [channel.id, isGroupDM, onClose]);

	const handleUnpinDM = useCallback(async () => {
		onClose();
		try {
			await PrivateChannelActionCreators.unpinDmChannel(channel.id);
			ToastActionCreators.createToast({
				type: 'success',
				children: isGroupDM ? t`Unpinned group DM` : t`Unpinned DM`,
			});
		} catch (error) {
			logger.error('Failed to unpin:', error);
			ToastActionCreators.createToast({
				type: 'error',
				children: isGroupDM ? t`Failed to unpin group DM` : t`Failed to unpin DM`,
			});
		}
	}, [channel.id, isGroupDM, onClose]);

	const handleEditGroup = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <EditGroupModal channelId={channel.id} />));
	}, [channel.id, onClose]);

	const handleShowInvites = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <GroupInvitesModal channelId={channel.id} />));
	}, [channel.id, onClose]);

	const handleCopyChannelId = useCallback(async () => {
		await TextCopyActionCreators.copy(i18n, channel.id, true);
		ToastActionCreators.createToast({
			type: 'success',
			children: t`Channel ID copied`,
		});
		onClose();
	}, [channel.id, i18n, onClose]);

	const handleCopyUserId = useCallback(async () => {
		if (!recipient) return;
		await TextCopyActionCreators.copy(i18n, recipient.id, true);
		ToastActionCreators.createToast({
			type: 'success',
			children: t`User ID copied`,
		});
		onClose();
	}, [recipient, i18n, onClose]);

	const handleDebugUser = useCallback(() => {
		if (!recipient) return;
		onClose();
		ModalActionCreators.push(modal(() => <UserDebugModal title={t`User Debug`} user={recipient} />));
	}, [recipient, onClose]);

	const handleDebugChannel = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <ChannelDebugModal title={t`Channel Debug`} channel={channel} />));
	}, [channel, onClose]);

	const handlers: DMMenuHandlers = useMemo(
		() => ({
			handleMarkAsRead,
			handleToggleFavorite,
			handleViewProfile,
			handleStartVoiceCall,
			handleAddNote,
			handleChangeFriendNickname,
			handleInviteToCommunity,
			handleSendFriendRequest,
			handleAcceptFriendRequest,
			handleRemoveFriend,
			handleBlockUser,
			handleUnblockUser,
			handleCloseDM,
			handleLeaveGroup,
			handlePinDM,
			handleUnpinDM,
			handleEditGroup,
			handleShowInvites,
			handleCopyChannelId,
			handleCopyUserId,
			handleDebugUser,
			handleDebugChannel,
		}),
		[
			handleMarkAsRead,
			handleToggleFavorite,
			handleViewProfile,
			handleStartVoiceCall,
			handleAddNote,
			handleChangeFriendNickname,
			handleInviteToCommunity,
			handleSendFriendRequest,
			handleAcceptFriendRequest,
			handleRemoveFriend,
			handleBlockUser,
			handleUnblockUser,
			handleCloseDM,
			handleLeaveGroup,
			handlePinDM,
			handleUnpinDM,
			handleEditGroup,
			handleShowInvites,
			handleCopyChannelId,
			handleCopyUserId,
			handleDebugUser,
			handleDebugChannel,
		],
	);

	const groups = useMemo(() => {
		const menuGroups: Array<MenuGroupType> = [];

		if (hasUnread) {
			menuGroups.push({
				items: [
					{
						icon: <MarkAsReadIcon size={20} />,
						label: t`Mark as Read`,
						onClick: handleMarkAsRead,
					},
				],
			});
		}

		if (AccessibilityStore.showFavorites) {
			menuGroups.push({
				items: [
					{
						icon: <FavoriteIcon size={20} filled={isFavorited} />,
						label: isFavorited ? t`Remove from Favorites` : t`Add to Favorites`,
						onClick: handleToggleFavorite,
					},
				],
			});
		}

		if (recipient && !isGroupDM) {
			const recipientItems: Array<MenuItemType> = [
				{
					icon: <ViewProfileIcon size={20} />,
					label: t`View Profile`,
					onClick: handleViewProfile,
				},
			];

			if (!restrictRecipientActions && !isRecipientBot) {
				recipientItems.push({
					icon: <VoiceCallIcon size={20} />,
					label: t`Voice Call`,
					onClick: handleStartVoiceCall,
				});
			}

			if (!restrictRecipientActions) {
				recipientItems.push({
					icon: <AddNoteIcon size={20} />,
					label: t`Add Note`,
					onClick: handleAddNote,
				});
			}

			if (!restrictRecipientActions && relationshipType === RelationshipTypes.FRIEND) {
				recipientItems.push({
					icon: <EditIcon size={20} />,
					label: t`Change Friend Nickname`,
					onClick: handleChangeFriendNickname,
				});
			}

			menuGroups.push({items: recipientItems});
		}

		if (onOpenMuteSheet) {
			menuGroups.push({
				items: [
					{
						icon: <MuteIcon size={20} />,
						label: isMuted ? t`Unmute Conversation` : t`Mute Conversation`,
						hint: mutedText || undefined,
						onClick: onOpenMuteSheet,
					},
				],
			});
		}

		const groupActionsItems: Array<MenuItemType> = [];

		if (isGroupDM) {
			groupActionsItems.push({
				icon: <EditGroupIcon size={20} />,
				label: t`Edit Group`,
				onClick: handleEditGroup,
			});

			if (isOwner) {
				groupActionsItems.push({
					icon: <GroupInvitesIcon size={20} />,
					label: t`Invites`,
					onClick: handleShowInvites,
				});
			}
		}

		groupActionsItems.push(
			channel.isPinned
				? {
						icon: <PinIcon size={20} />,
						label: isGroupDM ? t`Unpin Group DM` : t`Unpin DM`,
						onClick: handleUnpinDM,
					}
				: {
						icon: <PinIcon size={20} />,
						label: isGroupDM ? t`Pin Group DM` : t`Pin DM`,
						onClick: handlePinDM,
					},
		);

		menuGroups.push({items: groupActionsItems});

		if (recipient && !isGroupDM && !restrictRecipientActions && (!isRecipientBot || isFriendlyBot)) {
			const relationshipItems: Array<MenuItemType | MenuSubmenuItemType> = [];

			if (invitableCommunities.length > 0) {
				const submenuItems: Array<MenuItemType> = invitableCommunities.map(({guild, channelId}) => ({
					icon: <SendInviteToCommunityIcon size={20} />,
					label: guild.name,
					onClick: () => handleInviteToCommunity(guild.id, channelId, guild.name),
				}));
				relationshipItems.push({
					icon: <InviteToCommunityIcon size={20} />,
					label: t`Invite to Community`,
					items: submenuItems,
				});
			}

			if (relationshipType === RelationshipTypes.FRIEND) {
				relationshipItems.push({
					icon: <RemoveFriendIcon size={20} />,
					label: t`Remove Friend`,
					onClick: handleRemoveFriend,
					danger: true,
				});
			} else if (relationshipType === RelationshipTypes.INCOMING_REQUEST) {
				relationshipItems.push({
					icon: <AcceptFriendRequestIcon size={20} />,
					label: t`Accept Friend Request`,
					onClick: handleAcceptFriendRequest,
				});
			} else if (
				relationshipType !== RelationshipTypes.OUTGOING_REQUEST &&
				relationshipType !== RelationshipTypes.BLOCKED &&
				!currentUserUnclaimed
			) {
				relationshipItems.push({
					icon: <SendFriendRequestIcon size={20} />,
					label: t`Add Friend`,
					onClick: handleSendFriendRequest,
				});
			}

			if (relationshipType === RelationshipTypes.BLOCKED) {
				relationshipItems.push({
					icon: <BlockUserIcon size={20} />,
					label: t`Unblock`,
					onClick: handleUnblockUser,
				});
			} else {
				relationshipItems.push({
					icon: <BlockUserIcon size={20} />,
					label: t`Block`,
					onClick: handleBlockUser,
					danger: true,
				});
			}

			if (relationshipItems.length > 0) {
				menuGroups.push({items: relationshipItems});
			}
		}

		const closeItems: Array<MenuItemType> = [
			isGroupDM
				? {
						icon: <LeaveIcon size={20} />,
						label: t`Leave Group`,
						onClick: handleLeaveGroup,
						danger: true,
					}
				: {
						icon: <CloseDMIcon size={20} />,
						label: t`Close DM`,
						onClick: handleCloseDM,
						danger: true,
					},
		];

		menuGroups.push({items: closeItems});

		if (developerMode) {
			const debugItems: Array<MenuItemType> = [];

			if (recipient) {
				debugItems.push({
					icon: <DebugIcon size={20} />,
					label: t`Debug User`,
					onClick: handleDebugUser,
				});
			}

			debugItems.push({
				icon: <DebugIcon size={20} />,
				label: t`Debug Channel`,
				onClick: handleDebugChannel,
			});

			menuGroups.push({items: debugItems});
		}

		const copyItems: Array<MenuItemType> = [];

		if (recipient) {
			copyItems.push({
				icon: <CopyIdIcon size={20} />,
				label: t`Copy User ID`,
				onClick: handleCopyUserId,
			});
		}

		copyItems.push({
			icon: <CopyIdIcon size={20} />,
			label: t`Copy Channel ID`,
			onClick: handleCopyChannelId,
		});

		menuGroups.push({items: copyItems});

		return menuGroups;
	}, [
		hasUnread,
		isFavorited,
		recipient,
		isGroupDM,
		restrictRecipientActions,
		isRecipientBot,
		relationshipType,
		isMuted,
		mutedText,
		onOpenMuteSheet,
		isOwner,
		channel.isPinned,
		isFriendlyBot,
		invitableCommunities,
		currentUserUnclaimed,
		developerMode,
		handleMarkAsRead,
		handleToggleFavorite,
		handleViewProfile,
		handleStartVoiceCall,
		handleAddNote,
		handleChangeFriendNickname,
		handleEditGroup,
		handleShowInvites,
		handleUnpinDM,
		handlePinDM,
		handleInviteToCommunity,
		handleRemoveFriend,
		handleAcceptFriendRequest,
		handleSendFriendRequest,
		handleUnblockUser,
		handleBlockUser,
		handleLeaveGroup,
		handleCloseDM,
		handleDebugUser,
		handleDebugChannel,
		handleCopyUserId,
		handleCopyChannelId,
	]);

	return {
		groups,
		handlers,
		invitableCommunities,
		isGroupDM,
		isOwner,
		isMuted,
		mutedText: mutedText ?? null,
		isFavorited,
		relationshipType,
		isRecipientBot,
		isRecipientSystem,
		restrictRecipientActions,
		developerMode,
	};
}
