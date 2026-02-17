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

import * as ReadStateActionCreators from '@app/actions/ReadStateActionCreators';
import {openGuildFolderSettingsModal} from '@app/components/modals/GuildFolderSettingsModal';
import {MarkAsReadIcon, SettingsIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import type {GuildRecord} from '@app/records/GuildRecord';
import ChannelStore from '@app/stores/ChannelStore';
import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo} from 'react';

interface GuildFolder {
	id: number | null;
	name: string | null;
	color: number | null;
	guildIds: Array<string>;
}

interface GuildFolderContextMenuProps {
	folder: GuildFolder;
	guilds: Array<GuildRecord>;
	onClose: () => void;
}

export const GuildFolderContextMenu: React.FC<GuildFolderContextMenuProps> = observer(({folder, guilds, onClose}) => {
	const {t} = useLingui();

	const hasUnreads = useMemo(() => {
		return guilds.some((guild) => GuildReadStateStore.hasUnread(guild.id));
	}, [guilds]);

	const handleMarkFolderAsRead = useCallback(() => {
		const channelIds: Array<string> = [];

		for (const guild of guilds) {
			const channels = ChannelStore.getGuildChannels(guild.id);
			for (const channel of channels) {
				if (GuildReadStateStore.hasUnread(guild.id)) {
					channelIds.push(channel.id);
				}
			}
		}

		if (channelIds.length > 0) {
			void ReadStateActionCreators.bulkAckChannels(channelIds);
		}

		onClose();
	}, [guilds, onClose]);

	const handleFolderSettings = useCallback(() => {
		if (folder.id != null) {
			openGuildFolderSettingsModal(folder.id);
		}
		onClose();
	}, [folder.id, onClose]);

	return (
		<>
			<MenuGroup>
				<MenuItem icon={<MarkAsReadIcon />} onClick={handleMarkFolderAsRead} disabled={!hasUnreads}>
					{t`Mark Folder as Read`}
				</MenuItem>
			</MenuGroup>

			<MenuGroup>
				<MenuItem icon={<SettingsIcon />} onClick={handleFolderSettings}>
					{t`Folder Settings`}
				</MenuItem>
			</MenuGroup>
		</>
	);
});
