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
import {useChannelMenuData} from '@app/components/uikit/context_menu/items/ChannelMenuData';
import {MuteChannelMenuItem} from '@app/components/uikit/context_menu/items/ChannelMenuItems';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import GuildStore from '@app/stores/GuildStore';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

interface ChannelContextMenuProps {
	channel: ChannelRecord;
	onClose: () => void;
}

export const ChannelContextMenu: React.FC<ChannelContextMenuProps> = observer(({channel, onClose}) => {
	const {t} = useLingui();
	const guild = channel.guildId ? GuildStore.getGuild(channel.guildId) : undefined;

	const {groups} = useChannelMenuData(channel, guild, {
		onClose,
	});

	const excludeLabels = useMemo(() => [t`Mute Channel`, t`Unmute Channel`], [t]);
	const showMuteMenuItem = channel.type === ChannelTypes.GUILD_TEXT || channel.type === ChannelTypes.GUILD_VOICE;

	return (
		<>
			<DataMenuRenderer groups={groups} excludeLabels={excludeLabels} />

			{showMuteMenuItem && (
				<MenuGroup>
					<MuteChannelMenuItem channel={channel} onClose={onClose} />
				</MenuGroup>
			)}
		</>
	);
});
