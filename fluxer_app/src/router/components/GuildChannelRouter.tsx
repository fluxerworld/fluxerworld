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

import {observer} from 'mobx-react-lite';
import React from 'react';
import {ME} from '~/Constants';
import {GuildLayout} from '~/components/layout/GuildLayout';
import {useLocation} from '~/lib/router';
import {Routes} from '~/Routes';
import ChannelStore from '~/stores/ChannelStore';
import MobileLayoutStore from '~/stores/MobileLayoutStore';
import SelectedChannelStore from '~/stores/SelectedChannelStore';
import {compareChannelPosition, filterViewableChannels} from '~/utils/channelShared';
import * as RouterUtils from '~/utils/RouterUtils';

export const GuildChannelRouter: React.FC<{guildId: string; children?: React.ReactNode}> = observer(
	({guildId, children}) => {
		const location = useLocation();

		React.useEffect(() => {
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
						if (channel && channel.guildId === guildId) {
							RouterUtils.replaceWith(Routes.guildChannel(guildId, selectedChannelId));
						} else {
							const channels = ChannelStore.getGuildChannels(guildId);
							const viewableChannels = filterViewableChannels(channels).sort(compareChannelPosition);

							if (viewableChannels.length > 0) {
								const firstChannel = viewableChannels[0];
								RouterUtils.replaceWith(Routes.guildChannel(guildId, firstChannel.id));
							}
						}
					} else {
						const channels = ChannelStore.getGuildChannels(guildId);
						const viewableChannels = filterViewableChannels(channels).sort(compareChannelPosition);

						if (viewableChannels.length > 0) {
							const firstChannel = viewableChannels[0];
							RouterUtils.replaceWith(Routes.guildChannel(guildId, firstChannel.id));
						}
					}
				}
			}
		}, [guildId, location.pathname, MobileLayoutStore.enabled]);

		if (guildId === ME || location.pathname === Routes.ME) {
			return null;
		}

		return <GuildLayout>{children}</GuildLayout>;
	},
);
