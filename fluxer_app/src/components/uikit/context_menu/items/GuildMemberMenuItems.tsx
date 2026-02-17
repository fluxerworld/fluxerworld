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

import * as GuildMemberActionCreators from '@app/actions/GuildMemberActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {BanMemberModal} from '@app/components/modals/BanMemberModal';
import {ChangeNicknameModal} from '@app/components/modals/ChangeNicknameModal';
import {KickMemberModal} from '@app/components/modals/KickMemberModal';
import {RemoveTimeoutModal} from '@app/components/modals/RemoveTimeoutModal';
import {TimeoutMemberModal} from '@app/components/modals/TimeoutMemberModal';
import {TransferOwnershipModal} from '@app/components/modals/TransferOwnershipModal';
import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import {
	BanMemberIcon,
	ChangeNicknameIcon,
	KickMemberIcon,
	ManageRolesIcon,
	TimeoutIcon,
	TransferOwnershipIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import itemStyles from '@app/components/uikit/context_menu/items/MenuItems.module.css';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import {useRoleHierarchy} from '@app/hooks/useRoleHierarchy';
import type {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import type {UserRecord} from '@app/records/UserRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import PermissionStore from '@app/stores/PermissionStore';
import * as ColorUtils from '@app/utils/ColorUtils';
import * as PermissionUtils from '@app/utils/PermissionUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo} from 'react';

interface TransferOwnershipMenuItemProps {
	guildId: string;
	user: UserRecord;
	member: GuildMemberRecord;
	onClose: () => void;
}

export const TransferOwnershipMenuItem: React.FC<TransferOwnershipMenuItemProps> = observer(
	function TransferOwnershipMenuItem({guildId, user, member, onClose}) {
		const {t} = useLingui();
		const handleTransferOwnership = useCallback(() => {
			onClose();
			ModalActionCreators.push(
				modal(() => <TransferOwnershipModal guildId={guildId} targetUser={user} targetMember={member} />),
			);
		}, [guildId, user, member, onClose]);

		return (
			<MenuItem icon={<TransferOwnershipIcon size={16} />} onClick={handleTransferOwnership}>
				{t`Transfer Ownership`}
			</MenuItem>
		);
	},
);

interface KickMemberMenuItemProps {
	guildId: string;
	user: UserRecord;
	onClose: () => void;
}

export const KickMemberMenuItem: React.FC<KickMemberMenuItemProps> = observer(function KickMemberMenuItem({
	guildId,
	user,
	onClose,
}) {
	const {t} = useLingui();
	const handleKickMember = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <KickMemberModal guildId={guildId} targetUser={user} />));
	}, [guildId, user, onClose]);

	return (
		<MenuItem icon={<KickMemberIcon size={16} />} onClick={handleKickMember} danger>
			{t`Kick Member`}
		</MenuItem>
	);
});

interface BanMemberMenuItemProps {
	guildId: string;
	user: UserRecord;
	onClose: () => void;
}

export const BanMemberMenuItem: React.FC<BanMemberMenuItemProps> = observer(function BanMemberMenuItem({
	guildId,
	user,
	onClose,
}) {
	const {t} = useLingui();
	const handleBanMember = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <BanMemberModal guildId={guildId} targetUser={user} />));
	}, [guildId, user, onClose]);

	return (
		<MenuItem icon={<BanMemberIcon size={16} />} onClick={handleBanMember} danger>
			{t`Ban Member`}
		</MenuItem>
	);
});

interface ManageRolesMenuItemProps {
	guildId: string;
	member: GuildMemberRecord;
}

export const ManageRolesMenuItem: React.FC<ManageRolesMenuItemProps> = observer(function ManageRolesMenuItem({
	guildId,
	member,
}) {
	const {t} = useLingui();
	const guild = GuildStore.getGuild(guildId);
	const currentMember = GuildMemberStore.getMember(guildId, member.user.id);
	const {canManageRole} = useRoleHierarchy(guild);

	const canManageRoles = PermissionStore.can(Permissions.MANAGE_ROLES, {guildId});

	const allRoles = useMemo(() => {
		if (!guild) return [];

		return Object.values(guild.roles)
			.filter((role) => !role.isEveryone)
			.sort((a, b) => b.position - a.position)
			.map((role) => ({
				role,
				canManage: canManageRole({id: role.id, position: role.position, permissions: role.permissions}),
			}));
	}, [guild, canManageRole]);

	const visibleRoles = useMemo(() => {
		if (canManageRoles) return allRoles;
		const memberRoles = currentMember?.roles;
		if (!memberRoles) return [];
		return allRoles.filter(({role}) => memberRoles.has(role.id));
	}, [allRoles, canManageRoles, currentMember]);

	const handleToggleRole = useCallback(
		async (roleId: string, hasRole: boolean, canToggle: boolean) => {
			if (!canToggle) return;
			if (hasRole) {
				await GuildMemberActionCreators.removeRole(guildId, member.user.id, roleId);
			} else {
				await GuildMemberActionCreators.addRole(guildId, member.user.id, roleId);
			}
		},
		[guildId, member.user.id],
	);

	if (visibleRoles.length === 0) return null;

	return (
		<MenuItemSubmenu
			label={t`Roles`}
			icon={<ManageRolesIcon className={itemStyles.icon} />}
			render={() => (
				<MenuGroup>
					{canManageRoles
						? visibleRoles.map(({role, canManage}) => {
								const hasRole = currentMember?.roles.has(role.id) ?? false;
								const canToggle = canManageRoles && canManage;
								return (
									<CheckboxItem
										key={role.id}
										checked={hasRole}
										disabled={!canToggle}
										onCheckedChange={() => handleToggleRole(role.id, hasRole, canToggle)}
										closeOnChange={false}
									>
										<div className={itemStyles.roleContainer}>
											<div className={itemStyles.roleIcon} style={{backgroundColor: ColorUtils.int2rgb(role.color)}} />
											<span className={!canToggle ? itemStyles.roleDisabled : undefined}>{role.name}</span>
										</div>
									</CheckboxItem>
								);
							})
						: visibleRoles.map(({role}) => (
								<MenuItem key={role.id} closeOnSelect={false}>
									<div className={itemStyles.readonlyRoleItem}>
										<div className={itemStyles.roleContainer}>
											<div className={itemStyles.roleIcon} style={{backgroundColor: ColorUtils.int2rgb(role.color)}} />
											<span className={itemStyles.roleName}>{role.name}</span>
										</div>
										<div className={itemStyles.readonlyRoleSpacer} />
									</div>
								</MenuItem>
							))}
				</MenuGroup>
			)}
		/>
	);
});

interface ChangeNicknameMenuItemProps {
	guildId: string;
	user: UserRecord;
	member: GuildMemberRecord;
	onClose: () => void;
}

export const ChangeNicknameMenuItem: React.FC<ChangeNicknameMenuItemProps> = observer(function ChangeNicknameMenuItem({
	guildId,
	user,
	member,
	onClose,
}) {
	const {t} = useLingui();
	const currentUserId = AuthenticationStore.currentUserId;
	const isCurrentUser = user.id === currentUserId;
	const guild = GuildStore.getGuild(guildId);
	const {canManageTarget} = useRoleHierarchy(guild);

	const hasChangeNicknamePermission = PermissionStore.can(Permissions.CHANGE_NICKNAME, {guildId});
	const hasManageNicknamesPermission = PermissionStore.can(Permissions.MANAGE_NICKNAMES, {guildId});

	const canManageNicknames =
		(isCurrentUser && hasChangeNicknamePermission) || (hasManageNicknamesPermission && canManageTarget(user.id));

	const handleChangeNickname = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <ChangeNicknameModal guildId={guildId} user={user} member={member} />));
	}, [guildId, user, member, onClose]);

	if (!canManageNicknames) return null;

	return (
		<MenuItem icon={<ChangeNicknameIcon size={16} />} onClick={handleChangeNickname}>
			{isCurrentUser ? t`Change Nickname` : t`Change Nickname`}
		</MenuItem>
	);
});

interface TimeoutMemberMenuItemProps {
	guildId: string;
	user: UserRecord;
	member: GuildMemberRecord;
	onClose: () => void;
}

export const TimeoutMemberMenuItem: React.FC<TimeoutMemberMenuItemProps> = observer(function TimeoutMemberMenuItem({
	guildId,
	user,
	member,
	onClose,
}) {
	const {t} = useLingui();
	const guild = GuildStore.getGuild(guildId);
	const currentUserId = AuthenticationStore.currentUserId;
	const isCurrentUser = user.id === currentUserId;
	const {canManageTarget} = useRoleHierarchy(guild);
	const canModerateTarget = !isCurrentUser && canManageTarget(user.id);
	const guildSnapshot = guild?.toJSON();
	const targetHasModerateMembersPermission =
		guildSnapshot !== undefined && PermissionUtils.can(Permissions.MODERATE_MEMBERS, user.id, guildSnapshot);

	const handleTimeoutMember = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <TimeoutMemberModal guildId={guildId} targetUser={user} />));
	}, [guildId, user, onClose]);

	const handleRemoveTimeout = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <RemoveTimeoutModal guildId={guildId} targetUser={user} />));
	}, [guildId, user, onClose]);

	if (!canModerateTarget || targetHasModerateMembersPermission) {
		return null;
	}

	const isTimedOut = member.isTimedOut();
	const handleClick = isTimedOut ? handleRemoveTimeout : handleTimeoutMember;

	return (
		<MenuItem icon={<TimeoutIcon size={16} />} onClick={handleClick} danger={!isTimedOut}>
			{isTimedOut ? t`Remove Timeout` : t`Timeout`}
		</MenuItem>
	);
});
