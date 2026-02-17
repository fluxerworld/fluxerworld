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

import styles from '@app/components/modals/shared/AddOverridePopout.module.css';
import {DEFAULT_ROLE_COLOR_HEX, getRoleColor} from '@app/components/modals/shared/PermissionComponents';
import {Avatar} from '@app/components/uikit/Avatar';
import {
	SearchableListPopout,
	type SearchableListPopoutItem,
	type SearchableListPopoutSection,
} from '@app/components/uikit/popout/searchable_list_popout/SearchableListPopout';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

interface AddOverridePopoutProps {
	guildId: string;
	existingOverwriteIds: Set<string>;
	onSelect: (id: string, type: 0 | 1, name: string) => void;
	onClose: () => void;
}

export const AddOverridePopout: React.FC<AddOverridePopoutProps> = observer(function AddOverridePopout({
	guildId,
	existingOverwriteIds,
	onSelect,
	onClose,
}) {
	const {t} = useLingui();
	const guild = GuildStore.getGuild(guildId);

	const roles = useMemo(() => {
		if (!guild) return [];
		return Object.values(guild.roles)
			.filter((role) => !existingOverwriteIds.has(role.id))
			.sort((a, b) => b.position - a.position);
	}, [guild, existingOverwriteIds]);

	const members = useMemo(() => {
		if (!guild) return [];
		const allMembers = GuildMemberStore.getMembers(guildId);
		return Array.from(allMembers.values())
			.filter((member) => !existingOverwriteIds.has(member.user.id))
			.slice(0, 15);
	}, [guild, guildId, existingOverwriteIds]);

	const roleItems = useMemo<Array<SearchableListPopoutItem>>(() => {
		return roles.map((role) => ({
			id: `role-${role.id}`,
			ariaLabel: role.name,
			searchValues: [role.name],
			onSelect: () => {
				onSelect(role.id, 0, role.name);
				onClose();
			},
			render: () => (
				<>
					<div
						className={styles.roleIndicator}
						style={{
							backgroundColor: role.color === 0 ? DEFAULT_ROLE_COLOR_HEX : getRoleColor(role.color),
						}}
					/>
					<span className={styles.itemLabel}>{role.name}</span>
				</>
			),
		}));
	}, [onClose, onSelect, roles]);

	const memberItems = useMemo<Array<SearchableListPopoutItem>>(() => {
		return members.map((member) => ({
			id: `member-${member.user.id}`,
			ariaLabel: member.user.username,
			searchValues: [member.user.username],
			onSelect: () => {
				onSelect(member.user.id, 1, member.user.username);
				onClose();
			},
			render: () => (
				<>
					<Avatar user={member.user} size={12} className={styles.avatar} guildId={guildId} />
					<span className={styles.itemLabel}>{member.user.username}</span>
				</>
			),
		}));
	}, [guildId, members, onClose, onSelect]);

	const sections = useMemo<Array<SearchableListPopoutSection>>(() => {
		const nextSections: Array<SearchableListPopoutSection> = [];
		if (roleItems.length > 0) {
			nextSections.push({
				id: 'roles',
				heading: <Trans>Roles</Trans>,
				items: roleItems,
			});
		}
		if (memberItems.length > 0) {
			nextSections.push({
				id: 'members',
				heading: (
					<>
						<Trans>Members</Trans> {members.length >= 15 && <Trans>(max 15 shown)</Trans>}
					</>
				),
				items: memberItems,
			});
		}
		return nextSections;
	}, [memberItems, members.length, roleItems]);

	return (
		<SearchableListPopout
			className={styles.popoutContainer}
			searchClassName={styles.searchContainer}
			scrollerClassName={styles.scroller}
			sectionClassName={styles.section}
			sectionHeadingClassName={styles.sectionHeader}
			optionClassName={styles.itemButton}
			emptyStateClassName={styles.emptyState}
			placeholder={t`Search roles or members...`}
			searchInputAriaLabel={t`Search roles or members`}
			listAriaLabel={t`Roles and members`}
			noResultsLabel={<Trans>No results found</Trans>}
			sections={sections}
			onRequestClose={onClose}
		/>
	);
});
