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

import * as MessageActionCreators from '@app/actions/MessageActionCreators';
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import ChannelStore from '@app/stores/ChannelStore';
import {FAVORITES_GUILD_ID, ME} from '@fluxer/constants/src/AppConstants';
import type {JumpType} from '@fluxer/constants/src/JumpConstants';

interface MessageJumpOptions {
	flash?: boolean;
	offset?: number;
	returnTargetId?: string;
	jumpType?: JumpType;
	viewContext?: 'favorites';
}

export function goToMessage(channelId: string, messageId: string, options?: MessageJumpOptions): void {
	const channel = ChannelStore.getChannel(channelId);
	let guildId: string | null | undefined;

	if (options?.viewContext === 'favorites') {
		guildId = FAVORITES_GUILD_ID;
	} else {
		guildId = channel?.guildId;
		if (!guildId || guildId === ME) {
			guildId = ME;
		}
	}

	NavigationActionCreators.navigateToMessage(guildId, channelId, messageId);
	MessageActionCreators.jumpToMessage(
		channelId,
		messageId,
		options?.flash ?? true,
		options?.offset,
		options?.returnTargetId,
		options?.jumpType,
	);
}

export function parseMessagePath(path: string): {channelId: string; messageId: string} | null {
	const parts = path.split('/').filter(Boolean);
	if (parts.length < 4) return null;
	if (parts[0] !== 'channels') return null;

	const channelId = parts[2];
	const messageId = parts[3];

	if (!channelId || !messageId) return null;
	return {channelId, messageId};
}
