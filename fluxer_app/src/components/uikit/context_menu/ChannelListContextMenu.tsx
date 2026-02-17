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
import * as UserGuildSettingsActionCreators from '@app/actions/UserGuildSettingsActionCreators';
import {CategoryCreateModal} from '@app/components/modals/CategoryCreateModal';
import {ChannelCreateModal} from '@app/components/modals/ChannelCreateModal';
import {InviteModal} from '@app/components/modals/InviteModal';
import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import {CreateCategoryIcon, CreateIcon, InviteIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import type {GuildRecord} from '@app/records/GuildRecord';
import PermissionStore from '@app/stores/PermissionStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import * as InviteUtils from '@app/utils/InviteUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

interface ChannelListContextMenuProps {
	guild: GuildRecord;
	onClose: () => void;
}

export const ChannelListContextMenu: React.FC<ChannelListContextMenuProps> = observer(({guild, onClose}) => {
	const {t} = useLingui();
	const canManageChannels = PermissionStore.can(Permissions.MANAGE_CHANNELS, {
		guildId: guild.id,
	});

	const invitableChannelId = InviteUtils.getInvitableChannelId(guild.id);
	const canInvite = InviteUtils.canInviteToChannel(invitableChannelId, guild.id);

	const hideMutedChannels = UserGuildSettingsStore.getSettings(guild.id)?.hide_muted_channels ?? false;

	const handleToggleHideMutedChannels = useCallback(() => {
		UserGuildSettingsActionCreators.toggleHideMutedChannels(guild.id);
	}, [guild.id]);

	const handleCreateChannel = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <ChannelCreateModal guildId={guild.id} />));
	}, [guild.id, onClose]);

	const handleCreateCategory = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <CategoryCreateModal guildId={guild.id} />));
	}, [guild.id, onClose]);

	const handleInvitePeople = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <InviteModal channelId={invitableChannelId ?? ''} />));
	}, [invitableChannelId, onClose]);

	return (
		<>
			<MenuGroup>
				<CheckboxItem checked={hideMutedChannels} onCheckedChange={handleToggleHideMutedChannels}>
					{t`Hide Muted Channels`}
				</CheckboxItem>
			</MenuGroup>

			{canManageChannels && (
				<MenuGroup>
					<MenuItem icon={<CreateIcon />} onClick={handleCreateChannel}>
						{t`Create Channel`}
					</MenuItem>
					<MenuItem icon={<CreateCategoryIcon />} onClick={handleCreateCategory}>
						{t`Create Category`}
					</MenuItem>
				</MenuGroup>
			)}

			{canInvite && (
				<MenuGroup>
					<MenuItem icon={<InviteIcon />} onClick={handleInvitePeople}>
						{t`Invite People`}
					</MenuItem>
				</MenuGroup>
			)}
		</>
	);
});
