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
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import styles from '@app/components/guild/RoleManagement.module.css';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {GuildSettingsModal} from '@app/components/modals/GuildSettingsModal';
import profileStyles from '@app/components/popouts/UserProfilePopout.module.css';
import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import itemStyles from '@app/components/uikit/context_menu/items/MenuItems.module.css';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {MenuBottomSheet, type MenuGroupType} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useRoleHierarchy} from '@app/hooks/useRoleHierarchy';
import type {GuildRoleRecord} from '@app/records/GuildRoleRecord';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildSettingsModalStore from '@app/stores/GuildSettingsModalStore';
import GuildStore from '@app/stores/GuildStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import * as ColorUtils from '@app/utils/ColorUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {PlusIcon, XIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo, useState} from 'react';

const RoleBadge: React.FC<{
	role: GuildRoleRecord;
	canRemove: boolean;
	guildId: string;
	userId: string;
}> = observer(function RoleBadge({role, canRemove, guildId, userId}) {
	const {t} = useLingui();
	const roleColor = ColorUtils.int2rgb(role.color);
	const iconColor = ColorUtils.getBestContrastColor(role.color);

	const handleRemoveRole = () => {
		GuildMemberActionCreators.removeRole(guildId, userId, role.id);
	};

	const roleIndicator = <span className={styles.roleIndicator} style={{backgroundColor: roleColor}} />;

	return (
		<div key={role.id} className={clsx(styles.roleBadge, profileStyles.role)}>
			{canRemove ? (
				<Tooltip text={t`Remove role`} position="top">
					<FocusRing offset={-2}>
						<button type="button" className={styles.roleRemoveButton} onClick={handleRemoveRole}>
							<XIcon
								weight="bold"
								className={clsx(styles.roleRemoveIconContainer, profileStyles.roleRemoveIcon)}
								style={{color: iconColor}}
							/>
							{roleIndicator}
						</button>
					</FocusRing>
				</Tooltip>
			) : (
				<div className={styles.roleRemoveButtonContainer}>{roleIndicator}</div>
			)}

			<div aria-hidden={true} className={styles.roleName}>
				{role.name}
			</div>
		</div>
	);
});

export const RoleList: React.FC<{
	guildId: string;
	userId: string;
	roles: Array<GuildRoleRecord>;
	canManage: boolean;
}> = observer(function RoleList({guildId, userId, roles, canManage}) {
	const {canManageRole} = useRoleHierarchy(GuildStore.getGuild(guildId));

	if (roles.length === 0 && !canManage) {
		return null;
	}

	return (
		<div className={styles.roleListContainer}>
			{roles.map((role) => {
				const canRemoveRole =
					canManage &&
					canManageRole({
						id: role.id,
						position: role.position,
						permissions: role.permissions,
					});

				return <RoleBadge key={role.id} role={role} canRemove={canRemoveRole} guildId={guildId} userId={userId} />;
			})}
		</div>
	);
});

interface ManageRolesMenuContentProps {
	guildId: string;
	userId: string;
	onClose: () => void;
}

const ManageRolesMenuContent: React.FC<ManageRolesMenuContentProps> = observer(function ManageRolesMenuContent({
	guildId,
	userId,
	onClose,
}) {
	const guild = GuildStore.getGuild(guildId);
	const currentMember = GuildMemberStore.getMember(guildId, userId);
	const {canManageRole} = useRoleHierarchy(guild);

	const handleOpenGuildSettings = useCallback(() => {
		onClose();
		if (GuildSettingsModalStore.navigateToTab(guildId, 'roles')) {
			return;
		}
		ModalActionCreators.push(modal(() => <GuildSettingsModal guildId={guildId} initialTab="roles" />));
	}, [guildId, onClose]);

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

	const handleToggleRole = useCallback(
		async (roleId: string, hasRole: boolean, canManage: boolean) => {
			if (!canManage) return;
			if (hasRole) {
				await GuildMemberActionCreators.removeRole(guildId, userId, roleId);
			} else {
				await GuildMemberActionCreators.addRole(guildId, userId, roleId);
			}
		},
		[guildId, userId],
	);

	if (allRoles.length === 0) {
		return (
			<MenuGroup>
				<MenuItem onClick={handleOpenGuildSettings}>
					<Trans>No roles yet, add roles in Community Settings</Trans>
				</MenuItem>
			</MenuGroup>
		);
	}

	return (
		<MenuGroup>
			{allRoles.map(({role, canManage}) => {
				const hasRole = currentMember?.roles.has(role.id) ?? false;
				return (
					<CheckboxItem
						key={role.id}
						checked={hasRole}
						disabled={!canManage}
						onCheckedChange={() => handleToggleRole(role.id, hasRole, canManage)}
						closeOnChange={false}
					>
						<div className={itemStyles.roleContainer}>
							<div className={itemStyles.roleIcon} style={{backgroundColor: ColorUtils.int2rgb(role.color)}} />
							<span className={clsx(itemStyles.roleName, !canManage && itemStyles.roleDisabled)}>{role.name}</span>
						</div>
					</CheckboxItem>
				);
			})}
		</MenuGroup>
	);
});

interface ManageRolesBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	guildId: string;
	userId: string;
}

export const ManageRolesBottomSheet: React.FC<ManageRolesBottomSheetProps> = observer(function ManageRolesBottomSheet({
	isOpen,
	onClose,
	guildId,
	userId,
}) {
	const {t} = useLingui();
	const guild = GuildStore.getGuild(guildId);
	const currentMember = GuildMemberStore.getMember(guildId, userId);
	const {canManageRole} = useRoleHierarchy(guild);

	const handleOpenGuildSettings = useCallback(() => {
		onClose();
		if (GuildSettingsModalStore.navigateToTab(guildId, 'roles')) {
			return;
		}
		ModalActionCreators.push(modal(() => <GuildSettingsModal guildId={guildId} initialTab="roles" />));
	}, [guildId, onClose]);

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

	const menuGroups: Array<MenuGroupType> = useMemo(() => {
		if (allRoles.length === 0) {
			return [
				{
					items: [
						{
							icon: <PlusIcon weight="bold" className={styles.iconSize} />,
							label: t`No roles yet, add roles in Community Settings`,
							onClick: handleOpenGuildSettings,
						},
					],
				},
			];
		}

		return [
			{
				items: allRoles.map(({role, canManage}) => {
					const hasRole = currentMember?.roles.has(role.id) ?? false;
					return {
						label: role.name,
						checked: hasRole,
						disabled: !canManage,
						onChange: async () => {
							if (!canManage) return;
							if (hasRole) {
								await GuildMemberActionCreators.removeRole(guildId, userId, role.id);
							} else {
								await GuildMemberActionCreators.addRole(guildId, userId, role.id);
							}
						},
						icon: (
							<div className={styles.roleColorIndicator} style={{backgroundColor: ColorUtils.int2rgb(role.color)}} />
						),
					};
				}),
			},
		];
	}, [allRoles, currentMember, guildId, userId, handleOpenGuildSettings]);

	return <MenuBottomSheet isOpen={isOpen} onClose={onClose} title={t`Manage Roles`} groups={menuGroups} />;
});

function openNoRolesModal(guildId: string) {
	function NoRolesModalDescription() {
		const {t} = useLingui();
		const handleOpenRolesSettings = useCallback(() => {
			ModalActionCreators.pop();
			if (GuildSettingsModalStore.navigateToTab(guildId, 'roles')) {
				return;
			}
			ModalActionCreators.push(modal(() => <GuildSettingsModal guildId={guildId} initialTab="roles" />));
		}, []);

		return (
			<Trans>
				There are no roles to assign in this community at this time, but you can create a new role in{' '}
				<button type="button" className={styles.noRolesLink} onClick={handleOpenRolesSettings}>
					{t`Community Settings > Roles & Permissions`}
				</button>
				.
			</Trans>
		);
	}

	ModalActionCreators.push(
		modal(() => (
			<ConfirmModal
				title={<Trans>No Roles Available</Trans>}
				description={<NoRolesModalDescription />}
				primaryText={<Trans>OK</Trans>}
				primaryVariant="primary"
				secondaryText={false}
				onPrimary={() => {}}
			/>
		)),
	);
}

export const AddRoleButton: React.FC<{
	guildId: string;
	userId: string;
}> = observer(function AddRoleButton({guildId, userId}) {
	const {t} = useLingui();
	const guild = GuildStore.getGuild(guildId);
	const member = GuildMemberStore.getMember(guildId, userId);
	const isMobile = MobileLayoutStore.enabled;
	const [showBottomSheet, setShowBottomSheet] = useState(false);

	const hasRoles = useMemo(() => {
		if (!guild) return false;
		return Object.values(guild.roles).some((r) => !r.isEveryone);
	}, [guild]);

	const handleClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			if (!hasRoles) {
				openNoRolesModal(guildId);
				return;
			}
			if (isMobile) {
				setShowBottomSheet(true);
			} else {
				ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
					<ManageRolesMenuContent guildId={guildId} userId={userId} onClose={onClose} />
				));
			}
		},
		[guildId, userId, isMobile, hasRoles],
	);

	if (!guild || !member) return null;

	return (
		<>
			<Tooltip text={t`Add Role`}>
				<FocusRing offset={-2}>
					<button type="button" className={clsx(styles.addRoleButton, styles.addRoleButtonIcon)} onClick={handleClick}>
						<PlusIcon weight="bold" className={styles.iconSize} />
					</button>
				</FocusRing>
			</Tooltip>
			{isMobile && (
				<ManageRolesBottomSheet
					isOpen={showBottomSheet}
					onClose={() => setShowBottomSheet(false)}
					guildId={guildId}
					userId={userId}
				/>
			)}
		</>
	);
});
