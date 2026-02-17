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
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import * as RelationshipActionCreators from '@app/actions/RelationshipActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import {ManageRolesBottomSheet} from '@app/components/guild/RoleManagement';
import {BanMemberModal} from '@app/components/modals/BanMemberModal';
import {ChangeNicknameModal} from '@app/components/modals/ChangeNicknameModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import styles from '@app/components/modals/guild_tabs/GuildMemberActionsSheet.module.css';
import {KickMemberModal} from '@app/components/modals/KickMemberModal';
import {RemoveTimeoutModal} from '@app/components/modals/RemoveTimeoutModal';
import {TimeoutMemberSheet} from '@app/components/modals/TimeoutMemberSheet';
import {TransferOwnershipModal} from '@app/components/modals/TransferOwnershipModal';
import {MenuBottomSheet, type MenuGroupType} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {StatusAwareAvatar} from '@app/components/uikit/StatusAwareAvatar';
import {useRoleHierarchy} from '@app/hooks/useRoleHierarchy';
import {Logger} from '@app/lib/Logger';
import type {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import type {UserRecord} from '@app/records/UserRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import GuildStore from '@app/stores/GuildStore';
import PermissionStore from '@app/stores/PermissionStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import UserProfileMobileStore from '@app/stores/UserProfileMobileStore';
import UserStore from '@app/stores/UserStore';
import * as CallUtils from '@app/utils/CallUtils';
import * as NicknameUtils from '@app/utils/NicknameUtils';
import * as PermissionUtils from '@app/utils/PermissionUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {useLingui} from '@lingui/react/macro';
import {
	ChatTeardropIcon,
	ClockIcon,
	CrownIcon,
	GavelIcon,
	IdentificationCardIcon,
	PencilIcon,
	ProhibitIcon,
	SignOutIcon,
	UserCircleIcon,
	UserGearIcon,
	UserMinusIcon,
	UserPlusIcon,
	VideoCameraIcon,
} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type {FC} from 'react';
import {useState} from 'react';

const logger = new Logger('GuildMemberActionsSheet');

interface GuildMemberActionsSheetProps {
	isOpen: boolean;
	onClose: () => void;
	user: UserRecord;
	member: GuildMemberRecord;
	guildId: string;
}

export const GuildMemberActionsSheet: FC<GuildMemberActionsSheetProps> = observer(
	({isOpen, onClose, user, member, guildId}) => {
		const {t, i18n} = useLingui();

		const currentUserId = AuthenticationStore.currentUserId;
		const isCurrentUser = user.id === currentUserId;
		const isBot = user.bot;
		const currentUserUnclaimed = !(UserStore.currentUser?.isClaimed() ?? true);

		const relationship = RelationshipStore.getRelationship(user.id);
		const relationshipType = relationship?.type;
		const isBlocked = relationshipType === RelationshipTypes.BLOCKED;

		const canKickMembers = PermissionStore.can(Permissions.KICK_MEMBERS, {guildId});
		const canBanMembers = PermissionStore.can(Permissions.BAN_MEMBERS, {guildId});
		const canModerateMembers = PermissionStore.can(Permissions.MODERATE_MEMBERS, {guildId});

		const guild = GuildStore.getGuild(guildId);
		const guildSnapshot = guild?.toJSON();
		const {canManageTarget} = useRoleHierarchy(guild);
		const canModerateTarget = !isCurrentUser && canManageTarget(user.id);
		const targetHasModerateMembersPermission =
			guildSnapshot !== undefined && PermissionUtils.can(Permissions.MODERATE_MEMBERS, user.id, guildSnapshot);

		const canKick = canModerateTarget && canKickMembers;
		const canBan = canModerateTarget && canBanMembers;
		const canTimeout = canModerateTarget && canModerateMembers && !targetHasModerateMembersPermission;
		const memberIsTimedOut = member.isTimedOut();
		const isOwner = guild?.ownerId === currentUserId;
		const canTransfer = !isCurrentUser && !isBot && isOwner;
		const hasRoles = guild && Object.values(guild.roles).some((r) => !r.isEveryone);

		const [manageRolesSheetOpen, setManageRolesSheetOpen] = useState(false);

		const hasChangeNicknamePermission = PermissionStore.can(Permissions.CHANGE_NICKNAME, {guildId});
		const hasManageNicknamesPermission = PermissionStore.can(Permissions.MANAGE_NICKNAMES, {guildId});
		const canManageNicknames =
			(isCurrentUser && hasChangeNicknamePermission) || (!isCurrentUser && hasManageNicknamesPermission);

		const handleViewProfile = () => {
			onClose();
			UserProfileMobileStore.open(user.id, guildId);
		};

		const openDmChannel = async () => {
			try {
				await PrivateChannelActionCreators.openDMChannel(user.id);
			} catch (error) {
				logger.error('Failed to open DM channel', error);
			}
		};

		const handleMessage = async () => {
			onClose();
			await openDmChannel();
		};

		const handleOpenBlockedDm = () => {
			onClose();
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Open DM`}
						description={t`You blocked ${user.username}. You won't be able to send messages unless you unblock them.`}
						primaryText={t`Open DM`}
						primaryVariant="primary"
						onPrimary={openDmChannel}
					/>
				)),
			);
		};

		const handleStartVoiceCall = async () => {
			onClose();
			try {
				const channelId = await PrivateChannelActionCreators.ensureDMChannel(user.id);
				await CallUtils.checkAndStartCall(channelId);
			} catch (error) {
				logger.error('Failed to start voice call', error);
			}
		};

		const handleChangeNickname = () => {
			onClose();
			ModalActionCreators.push(modal(() => <ChangeNicknameModal guildId={guildId} user={user} member={member} />));
		};

		const handleSendFriendRequest = () => {
			RelationshipActionCreators.sendFriendRequest(user.id);
			onClose();
		};

		const handleAcceptFriendRequest = () => {
			RelationshipActionCreators.acceptFriendRequest(user.id);
			onClose();
		};

		const handleRemoveFriend = () => {
			onClose();
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Remove Friend`}
						description={t`Are you sure you want to remove ${user.username} as a friend?`}
						primaryText={t`Remove Friend`}
						primaryVariant="danger-primary"
						onPrimary={async () => {
							RelationshipActionCreators.removeRelationship(user.id);
						}}
					/>
				)),
			);
		};

		const handleBlockUser = () => {
			onClose();
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Block User`}
						description={t`Are you sure you want to block ${user.username}? They won't be able to message you or send you friend requests.`}
						primaryText={t`Block`}
						primaryVariant="danger-primary"
						onPrimary={async () => {
							RelationshipActionCreators.blockUser(user.id);
						}}
					/>
				)),
			);
		};

		const handleUnblockUser = () => {
			onClose();
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Unblock User`}
						description={t`Are you sure you want to unblock ${user.username}?`}
						primaryText={t`Unblock`}
						primaryVariant="primary"
						onPrimary={async () => {
							RelationshipActionCreators.removeRelationship(user.id);
						}}
					/>
				)),
			);
		};

		const handleKickMember = () => {
			onClose();
			ModalActionCreators.push(modal(() => <KickMemberModal guildId={guildId} targetUser={user} />));
		};

		const handleBanMember = () => {
			onClose();
			ModalActionCreators.push(modal(() => <BanMemberModal guildId={guildId} targetUser={user} />));
		};

		const handleCopyUserId = () => {
			TextCopyActionCreators.copy(i18n, user.id, true);
			onClose();
		};

		const handleManageRoles = () => {
			setManageRolesSheetOpen(true);
		};

		const handleTransferOwnership = () => {
			onClose();
			ModalActionCreators.push(
				modal(() => <TransferOwnershipModal guildId={guildId} targetUser={user} targetMember={member} />),
			);
		};

		const menuGroups: Array<MenuGroupType> = [];

		const profileItems = [
			{
				icon: <UserCircleIcon className={styles.icon} />,
				label: t`View Profile`,
				onClick: handleViewProfile,
			},
		];

		if (!isCurrentUser) {
			profileItems.push({
				icon: <ChatTeardropIcon className={styles.icon} />,
				label: isBlocked ? t`Open DM` : t`Message`,
				onClick: isBlocked ? handleOpenBlockedDm : handleMessage,
			});

			if (!isBot && relationshipType === RelationshipTypes.FRIEND) {
				profileItems.push({
					icon: <VideoCameraIcon className={styles.icon} />,
					label: t`Voice Call`,
					onClick: handleStartVoiceCall,
				});
			}
		}

		menuGroups.push({items: profileItems});

		const guildItems = [];

		if (canManageNicknames) {
			guildItems.push({
				icon: <PencilIcon className={styles.icon} />,
				label: t`Change Nickname`,
				onClick: handleChangeNickname,
			});
		}

		if (guildItems.length > 0) {
			menuGroups.push({items: guildItems});
		}

		if (!isCurrentUser && !isBot) {
			const relationshipItems = [];

			if (relationshipType === RelationshipTypes.FRIEND) {
				relationshipItems.push({
					icon: <UserMinusIcon className={styles.icon} />,
					label: t`Remove Friend`,
					onClick: handleRemoveFriend,
					danger: true,
				});
			} else if (relationshipType === RelationshipTypes.INCOMING_REQUEST) {
				relationshipItems.push({
					icon: <UserPlusIcon className={styles.icon} />,
					label: t`Accept Friend Request`,
					onClick: handleAcceptFriendRequest,
				});
			} else if (
				relationshipType !== RelationshipTypes.OUTGOING_REQUEST &&
				relationshipType !== RelationshipTypes.BLOCKED &&
				!currentUserUnclaimed
			) {
				relationshipItems.push({
					icon: <UserPlusIcon className={styles.icon} />,
					label: t`Send Friend Request`,
					onClick: handleSendFriendRequest,
				});
			}

			if (relationshipItems.length > 0) {
				menuGroups.push({items: relationshipItems});
			}
		}

		if (hasRoles) {
			menuGroups.push({
				items: [
					{
						icon: <UserGearIcon className={styles.icon} />,
						label: t`Manage Roles`,
						onClick: handleManageRoles,
					},
				],
			});
		}

		if (canTransfer) {
			menuGroups.push({
				items: [
					{
						icon: <CrownIcon className={styles.icon} />,
						label: t`Transfer Ownership`,
						onClick: handleTransferOwnership,
					},
				],
			});
		}

		if (canTimeout || canKick || canBan) {
			const moderationItems = [];

			if (canTimeout) {
				moderationItems.push({
					icon: <ClockIcon className={styles.icon} />,
					label: memberIsTimedOut ? t`Remove Timeout` : t`Timeout`,
					onClick: () => {
						onClose();
						if (memberIsTimedOut) {
							ModalActionCreators.push(modal(() => <RemoveTimeoutModal guildId={guildId} targetUser={user} />));
						} else {
							ModalActionCreators.push(
								modal(() => (
									<TimeoutMemberSheet
										isOpen={true}
										onClose={() => ModalActionCreators.pop()}
										guildId={guildId}
										targetUser={user}
										targetMember={member}
									/>
								)),
							);
						}
					},
					danger: !memberIsTimedOut,
				});
			}

			if (canKick) {
				moderationItems.push({
					icon: <SignOutIcon className={styles.icon} />,
					label: t`Kick`,
					onClick: handleKickMember,
					danger: true,
				});
			}

			if (canBan) {
				moderationItems.push({
					icon: <GavelIcon className={styles.icon} />,
					label: t`Ban`,
					onClick: handleBanMember,
					danger: true,
				});
			}

			menuGroups.push({items: moderationItems});
		}

		if (!isCurrentUser) {
			if (relationshipType === RelationshipTypes.BLOCKED) {
				menuGroups.push({
					items: [
						{
							icon: <ProhibitIcon className={styles.icon} />,
							label: t`Unblock`,
							onClick: handleUnblockUser,
						},
					],
				});
			} else {
				menuGroups.push({
					items: [
						{
							icon: <ProhibitIcon className={styles.icon} />,
							label: t`Block`,
							onClick: handleBlockUser,
							danger: true,
						},
					],
				});
			}
		}

		menuGroups.push({
			items: [
				{
					icon: <IdentificationCardIcon className={styles.icon} />,
					label: t`Copy User ID`,
					onClick: handleCopyUserId,
				},
			],
		});

		const headerContent = (
			<div className={styles.header}>
				<StatusAwareAvatar user={user} size={48} guildId={guildId} />
				<div className={styles.headerInfo}>
					<span className={styles.headerName}>{NicknameUtils.getNickname(user, guildId)}</span>
					<span className={styles.headerTag}>{user.tag}</span>
				</div>
			</div>
		);

		return (
			<>
				<MenuBottomSheet isOpen={isOpen} onClose={onClose} groups={menuGroups} headerContent={headerContent} />
				<ManageRolesBottomSheet
					isOpen={manageRolesSheetOpen}
					onClose={() => setManageRolesSheetOpen(false)}
					guildId={guildId}
					userId={user.id}
				/>
			</>
		);
	},
);
