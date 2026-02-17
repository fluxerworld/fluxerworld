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

import {StartVoiceCallMenuItem} from '@app/components/uikit/context_menu/items/CallMenuItems';
import {CopyUserIdMenuItem} from '@app/components/uikit/context_menu/items/CopyMenuItems';
import {DebugGuildMemberMenuItem, DebugUserMenuItem} from '@app/components/uikit/context_menu/items/DebugMenuItems';
import {
	BanMemberMenuItem,
	ChangeNicknameMenuItem,
	KickMemberMenuItem,
	ManageRolesMenuItem,
	TimeoutMemberMenuItem,
	TransferOwnershipMenuItem,
} from '@app/components/uikit/context_menu/items/GuildMemberMenuItems';
import {InviteToCommunityMenuItem} from '@app/components/uikit/context_menu/items/InviteMenuItems';
import {MentionUserMenuItem} from '@app/components/uikit/context_menu/items/MentionUserMenuItem';
import {MessageUserMenuItem} from '@app/components/uikit/context_menu/items/MessageUserMenuItem';
import {
	BlockUserMenuItem,
	ChangeFriendNicknameMenuItem,
	RelationshipActionMenuItem,
	UnblockUserMenuItem,
} from '@app/components/uikit/context_menu/items/RelationshipMenuItems';
import {AddNoteMenuItem} from '@app/components/uikit/context_menu/items/UserNoteMenuItems';
import {UserProfileMenuItem} from '@app/components/uikit/context_menu/items/UserProfileMenuItem';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {useRoleHierarchy} from '@app/hooks/useRoleHierarchy';
import type {UserRecord} from '@app/records/UserRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import PermissionStore from '@app/stores/PermissionStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import * as PermissionUtils from '@app/utils/PermissionUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface GuildMemberContextMenuProps {
	user: UserRecord;
	onClose: () => void;
	guildId: string;
	channelId?: string;
}

export const GuildMemberContextMenu: React.FC<GuildMemberContextMenuProps> = observer(
	({user, onClose, guildId, channelId}) => {
		const channel = channelId ? ChannelStore.getChannel(channelId) : null;
		const canSendMessages = channel ? PermissionStore.can(Permissions.SEND_MESSAGES, {channelId, guildId}) : true;
		const canMention = channel !== null && canSendMessages;
		const isCurrentUser = user.id === AuthenticationStore.currentUserId;
		const relationship = RelationshipStore.getRelationship(user.id);
		const relationshipType = relationship?.type;

		const guild = GuildStore.getGuild(guildId);
		const member = GuildMemberStore.getMember(guildId, user.id);
		const currentUserId = AuthenticationStore.currentUserId;
		const isBot = user.bot;

		const canKickMembers = PermissionStore.can(Permissions.KICK_MEMBERS, {guildId});
		const canBanMembers = PermissionStore.can(Permissions.BAN_MEMBERS, {guildId});
		const canModerateMembers = PermissionStore.can(Permissions.MODERATE_MEMBERS, {guildId});
		const isOwner = guild?.ownerId === currentUserId;
		const {canManageTarget} = useRoleHierarchy(guild);
		const canModerateTarget = !isCurrentUser && canManageTarget(user.id);

		const canKick = canModerateTarget && canKickMembers;
		const canBan = canModerateTarget && canBanMembers;
		const guildSnapshot = guild?.toJSON();
		const targetHasModerateMembersPermission =
			guildSnapshot !== undefined && PermissionUtils.can(Permissions.MODERATE_MEMBERS, user.id, guildSnapshot);
		const canTimeout = canModerateTarget && canModerateMembers && !targetHasModerateMembersPermission;
		const canTransfer = !isCurrentUser && !isBot && isOwner;
		const developerMode = UserSettingsStore.developerMode;

		const hasManageNicknamesPermission = PermissionStore.can(Permissions.MANAGE_NICKNAMES, {guildId});
		const canManageNicknames = member && (isCurrentUser || hasManageNicknamesPermission);
		const hasRoles = guild && Object.values(guild.roles).some((r) => !r.isEveryone);

		return (
			<>
				<MenuGroup>
					<UserProfileMenuItem user={user} guildId={guildId} onClose={onClose} />
					{canMention && <MentionUserMenuItem user={user} onClose={onClose} />}
					{!isCurrentUser && <MessageUserMenuItem user={user} onClose={onClose} />}
					{!isCurrentUser && !isBot && <StartVoiceCallMenuItem user={user} onClose={onClose} />}
					{!isCurrentUser && <AddNoteMenuItem user={user} onClose={onClose} />}
					<ChangeFriendNicknameMenuItem user={user} onClose={onClose} />
				</MenuGroup>

				<MenuGroup>
					{canManageNicknames && member && (
						<ChangeNicknameMenuItem guildId={guildId} user={user} member={member} onClose={onClose} />
					)}
					{!isCurrentUser && !isBot && <InviteToCommunityMenuItem user={user} onClose={onClose} />}
					{!isCurrentUser && !isBot && <RelationshipActionMenuItem user={user} onClose={onClose} />}
					{!isCurrentUser &&
						(relationshipType === RelationshipTypes.BLOCKED ? (
							<UnblockUserMenuItem user={user} onClose={onClose} />
						) : (
							<BlockUserMenuItem user={user} onClose={onClose} />
						))}
				</MenuGroup>

				{canTransfer && member && (
					<MenuGroup>
						<TransferOwnershipMenuItem guildId={guildId} user={user} member={member} onClose={onClose} />
					</MenuGroup>
				)}

				{(canTimeout || canKick || canBan) && member && (
					<MenuGroup>
						{canTimeout && <TimeoutMemberMenuItem guildId={guildId} user={user} member={member} onClose={onClose} />}
						{canKick && <KickMemberMenuItem guildId={guildId} user={user} onClose={onClose} />}
						{canBan && <BanMemberMenuItem guildId={guildId} user={user} onClose={onClose} />}
					</MenuGroup>
				)}

				{member && hasRoles && (
					<MenuGroup>
						<ManageRolesMenuItem guildId={guildId} member={member} />
					</MenuGroup>
				)}

				{developerMode && (
					<MenuGroup>
						<DebugUserMenuItem user={user} onClose={onClose} />
						{member && <DebugGuildMemberMenuItem member={member} onClose={onClose} />}
					</MenuGroup>
				)}

				<MenuGroup>
					<CopyUserIdMenuItem user={user} onClose={onClose} />
				</MenuGroup>
			</>
		);
	},
);
