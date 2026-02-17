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

import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import {GuildLayout} from '@app/components/layout/GuildLayout';
import {useLocation} from '@app/lib/router/React';
import {Routes} from '@app/Routes';
import ChannelStore from '@app/stores/ChannelStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import {compareChannelPosition, filterViewableChannels} from '@app/utils/ChannelShared';
import {ME} from '@fluxer/constants/src/AppConstants';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect} from 'react';

export const GuildChannelRouter = observer<{guildId: string; children: React.ReactNode}>(({guildId, children}) => {
	const location = useLocation();

	useEffect(() => {
		if (guildId === ME || location.pathname === Routes.ME) {
			return;
		}

		if (MobileLayoutStore.enabled) {
			return;
		}

		if (location.pathname.startsWith('/channels/') && !location.pathname.startsWith(Routes.ME)) {
			if (location.pathname.split('/').length === 3) {
				const pathSegments = location.pathname.split('/');
				const currentGuildId = pathSegments[2];

				if (currentGuildId !== guildId) {
					return;
				}

				const selectedChannelId = SelectedChannelStore.selectedChannelIds.get(guildId);

				if (selectedChannelId) {
					const channel = ChannelStore.getChannel(selectedChannelId);
					const isViewableChannel = channel ? filterViewableChannels([channel]).length > 0 : false;
					if (channel && channel.guildId === guildId && isViewableChannel) {
						NavigationActionCreators.selectChannel(guildId, selectedChannelId, undefined, 'replace');
					} else {
						const channels = ChannelStore.getGuildChannels(guildId);
						const viewableChannels = filterViewableChannels(channels).sort(compareChannelPosition);

						if (viewableChannels.length > 0) {
							const firstChannel = viewableChannels[0];
							NavigationActionCreators.selectChannel(guildId, firstChannel.id, undefined, 'replace');
						}
					}
				} else {
					const channels = ChannelStore.getGuildChannels(guildId);
					const viewableChannels = filterViewableChannels(channels).sort(compareChannelPosition);

					if (viewableChannels.length > 0) {
						const firstChannel = viewableChannels[0];
						NavigationActionCreators.selectChannel(guildId, firstChannel.id, undefined, 'replace');
					}
				}
			}
		}
	}, [guildId, location.pathname, MobileLayoutStore.enabled]);

	if (guildId === ME || location.pathname === Routes.ME) {
		return null;
	}

	return <GuildLayout>{children}</GuildLayout>;
});
