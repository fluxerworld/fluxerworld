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

import CallStateStore from '@app/stores/CallStateStore';
import ChannelPinsStore from '@app/stores/ChannelPinsStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import MessageReferenceStore from '@app/stores/MessageReferenceStore';
import MessageStore from '@app/stores/MessageStore';
import RecentMentionsStore from '@app/stores/RecentMentionsStore';
import SavedMessagesStore from '@app/stores/SavedMessagesStore';
import type {GuildMemberData} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';

interface MessageUpdatePayload {
	id: string;
	channel_id?: string;
}

export function handleMessageUpdate(data: MessageUpdatePayload, _context: GatewayHandlerContext): void {
	const message = data as Message;

	if (message.guild_id && message.member) {
		GuildMemberStore.handleMemberAdd(message.guild_id, {
			...message.member,
			user: message.author,
		} as GuildMemberData);
	}

	if (message.mentions && message.guild_id) {
		for (const mention of message.mentions) {
			if (mention.member) {
				GuildMemberStore.handleMemberAdd(message.guild_id, {
					...mention.member,
					user: mention,
				} as GuildMemberData);
			}
		}
	}

	SavedMessagesStore.handleMessageUpdate(message);
	ChannelPinsStore.handleMessageUpdate(message);
	MessageStore.handleMessageUpdate({message});
	MessageReferenceStore.handleMessageUpdate(message);
	RecentMentionsStore.handleMessageUpdate(message);
	if (message.channel_id && message.call) {
		CallStateStore.handleCallParticipants(message.channel_id, [...message.call.participants]);
	}
}
