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

import type {ChannelSettingsTab, ChannelSettingsTabType} from '@app/components/modals/utils/ChannelSettingsConstants';
import {getChannelSettingsTabs} from '@app/components/modals/utils/ChannelSettingsConstants';
import ChannelStore from '@app/stores/ChannelStore';
import PermissionStore from '@app/stores/PermissionStore';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import type {I18n} from '@lingui/core';

export interface ChannelSettingsModalProps {
	channelId: string;
	initialMobileTab?: ChannelSettingsTabType;
}

export function getAvailableTabs(i18n: I18n, channelId: string): Array<ChannelSettingsTab> {
	const channel = ChannelStore.getChannel(channelId);
	if (!channel) return getChannelSettingsTabs(i18n);

	let filteredTabs = getChannelSettingsTabs(i18n);

	if (channel.type === ChannelTypes.GUILD_CATEGORY) {
		filteredTabs = filteredTabs.filter((tab) => tab.type === 'overview' || tab.type === 'permissions');
	}

	if (channel.type === ChannelTypes.GUILD_VOICE) {
		filteredTabs = filteredTabs.filter((tab) => tab.type !== 'webhooks');
	}

	if (channel.type === ChannelTypes.GUILD_LINK) {
		filteredTabs = filteredTabs.filter((tab) => tab.type !== 'webhooks');
	}

	return filteredTabs.filter((tab) => {
		if (tab.permission && !PermissionStore.can(tab.permission, {guildId: channel.guildId})) {
			return false;
		}
		return true;
	});
}

export function getGroupedSettingsTabs(availableTabs: Array<ChannelSettingsTab>) {
	return availableTabs.reduce(
		(acc: Record<string, Array<ChannelSettingsTab>>, tab: ChannelSettingsTab) => {
			if (!acc[tab.category]) {
				acc[tab.category] = [];
			}
			acc[tab.category].push(tab);
			return acc;
		},
		{} as Record<string, Array<ChannelSettingsTab>>,
	);
}
