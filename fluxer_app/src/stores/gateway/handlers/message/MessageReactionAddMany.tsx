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

import ChannelPinsStore from '@app/stores/ChannelPinsStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import type {GatewayHandlerContext} from '@app/stores/gateway/handlers';
import MessageReactionsStore from '@app/stores/MessageReactionsStore';
import MessageStore from '@app/stores/MessageStore';
import RecentMentionsStore from '@app/stores/RecentMentionsStore';
import SavedMessagesStore from '@app/stores/SavedMessagesStore';
import type {ReactionEmoji} from '@app/utils/ReactionUtils';
import type {GuildMemberData} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';

interface ReactionEmojiPayload {
	id?: string | null;
	name?: string | null;
}

interface ReactionEntry {
	user_id: string;
	emoji: ReactionEmojiPayload;
	member?: GuildMemberData;
}

interface MessageReactionAddManyPayload {
	channel_id: string;
	message_id: string;
	guild_id?: string;
	reactions: Array<ReactionEntry>;
}

export function handleMessageReactionAddMany(
	data: MessageReactionAddManyPayload,
	_context: GatewayHandlerContext,
): void {
	for (const reaction of data.reactions) {
		const emoji = reaction.emoji as ReactionEmoji;

		if (data.guild_id && reaction.member) {
			GuildMemberStore.handleMemberAdd(data.guild_id, reaction.member);
		}

		SavedMessagesStore.handleMessageReactionAdd(data.message_id, reaction.user_id, emoji);
		MessageReactionsStore.handleReactionAdd(data.message_id, reaction.user_id, emoji);
		ChannelPinsStore.handleMessageReactionAdd(data.channel_id, data.message_id, reaction.user_id, emoji);
		RecentMentionsStore.handleMessageReactionAdd(data.message_id, reaction.user_id, emoji);
		MessageStore.handleReaction({
			type: 'MESSAGE_REACTION_ADD',
			channelId: data.channel_id,
			messageId: data.message_id,
			userId: reaction.user_id,
			emoji,
		});
	}
}
