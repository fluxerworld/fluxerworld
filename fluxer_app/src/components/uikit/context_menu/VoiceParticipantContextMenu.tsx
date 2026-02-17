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

import {DataMenuRenderer} from '@app/components/uikit/context_menu/DataMenuRenderer';
import {ManageRolesMenuItem} from '@app/components/uikit/context_menu/items/GuildMemberMenuItems';
import {MoveToChannelSubmenu} from '@app/components/uikit/context_menu/items/MoveToChannelSubmenu';
import {useVoiceParticipantMenuData} from '@app/components/uikit/context_menu/items/VoiceParticipantMenuData';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import type {UserRecord} from '@app/records/UserRecord';
import GuildStore from '@app/stores/GuildStore';
import PermissionStore from '@app/stores/PermissionStore';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

interface VoiceParticipantContextMenuProps {
	user: UserRecord;
	participantName: string;
	onClose: () => void;
	guildId?: string;
	connectionId?: string;
	isGroupedItem?: boolean;
	isParentGroupedItem?: boolean;
	streamKey?: string;
	isScreenShare?: boolean;
	isWatching?: boolean;
	hasScreenShareAudio?: boolean;
	isOwnScreenShare?: boolean;
	onStopWatching?: () => void;
}

export const VoiceParticipantContextMenu: React.FC<VoiceParticipantContextMenuProps> = observer(
	({
		user,
		onClose,
		guildId,
		connectionId,
		isGroupedItem = false,
		isParentGroupedItem = false,
		streamKey,
		isScreenShare = false,
		isWatching = false,
		hasScreenShareAudio = false,
		isOwnScreenShare = false,
		onStopWatching,
	}) => {
		const {t} = useLingui();

		const {groups, member, canMoveMembers, userVoiceStates, hasMultipleConnections, hasVoiceChannels} =
			useVoiceParticipantMenuData({
				user,
				guildId,
				connectionId,
				isGroupedItem,
				isParentGroupedItem,
				streamKey,
				isScreenShare,
				isWatching,
				hasScreenShareAudio,
				isOwnScreenShare,
				onStopWatching,
				onClose,
			});

		const connectionIds = useMemo(() => userVoiceStates.map((u) => u.connectionId), [userVoiceStates]);
		const guild = guildId ? GuildStore.getGuild(guildId) : null;
		const hasRoles = guild && Object.values(guild.roles).some((r) => !r.isEveryone);
		const canManageRoles = guildId ? PermissionStore.can(Permissions.MANAGE_ROLES, {guildId}) : false;
		const memberHasVisibleRoles = useMemo(() => {
			if (!guild || !member) {
				return false;
			}

			return Object.values(guild.roles).some((role) => !role.isEveryone && member.roles.has(role.id));
		}, [guild, member]);
		const shouldShowManageRoles = hasRoles && (canManageRoles || memberHasVisibleRoles);

		return (
			<>
				<DataMenuRenderer groups={groups} />

				{isGroupedItem && connectionId && guildId && hasVoiceChannels && (
					<MenuGroup>
						<MoveToChannelSubmenu
							userId={user.id}
							guildId={guildId}
							connectionId={connectionId}
							onClose={onClose}
							label={t`Move Device To...`}
						/>
					</MenuGroup>
				)}

				{isParentGroupedItem && hasMultipleConnections && guildId && hasVoiceChannels && (
					<MenuGroup>
						<MoveToChannelSubmenu
							userId={user.id}
							guildId={guildId}
							connectionIds={connectionIds}
							onClose={onClose}
							label={t`Move All Devices To...`}
						/>
					</MenuGroup>
				)}

				{guildId && canMoveMembers && !isParentGroupedItem && !isGroupedItem && hasVoiceChannels && (
					<MenuGroup>
						<MoveToChannelSubmenu
							userId={user.id}
							guildId={guildId}
							connectionId={connectionId}
							onClose={onClose}
							label={t`Move To...`}
						/>
					</MenuGroup>
				)}

				{guildId && member && shouldShowManageRoles && (
					<MenuGroup>
						<ManageRolesMenuItem guildId={guildId} member={member} />
					</MenuGroup>
				)}
			</>
		);
	},
);
