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

import type {AttachmentID, ChannelID, EmojiID, GuildID, MessageID, UserID} from '@fluxer/api/src/BrandedTypes';
import {IChannelRepositoryAggregate} from '@fluxer/api/src/channel/repositories/IChannelRepositoryAggregate';
import type {ChannelRow} from '@fluxer/api/src/database/types/ChannelTypes';
import type {AttachmentLookupRow, MessageRow} from '@fluxer/api/src/database/types/MessageTypes';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {Message} from '@fluxer/api/src/models/Message';
import type {MessageReaction} from '@fluxer/api/src/models/MessageReaction';

export abstract class IChannelRepository extends IChannelRepositoryAggregate {
	abstract findUnique(channelId: ChannelID): Promise<Channel | null>;
	abstract upsert(data: ChannelRow): Promise<Channel>;
	abstract updateLastMessageId(channelId: ChannelID, messageId: MessageID): Promise<void>;
	abstract delete(channelId: ChannelID, guildId?: GuildID): Promise<void>;
	abstract listGuildChannels(guildId: GuildID): Promise<Array<Channel>>;
	abstract countGuildChannels(guildId: GuildID): Promise<number>;

	abstract listMessages(
		channelId: ChannelID,
		beforeMessageId?: MessageID,
		limit?: number,
		afterMessageId?: MessageID,
	): Promise<Array<Message>>;
	abstract getMessage(channelId: ChannelID, messageId: MessageID): Promise<Message | null>;
	abstract upsertMessage(data: MessageRow, oldData?: MessageRow | null): Promise<Message>;
	abstract deleteMessage(
		channelId: ChannelID,
		messageId: MessageID,
		authorId: UserID,
		pinnedTimestamp?: Date,
	): Promise<void>;
	abstract bulkDeleteMessages(channelId: ChannelID, messageIds: Array<MessageID>): Promise<void>;

	abstract listChannelPins(channelId: ChannelID, beforePinnedTimestamp: Date, limit?: number): Promise<Array<Message>>;

	abstract listMessageReactions(channelId: ChannelID, messageId: MessageID): Promise<Array<MessageReaction>>;
	abstract listReactionUsers(
		channelId: ChannelID,
		messageId: MessageID,
		emojiName: string,
		limit?: number,
		after?: UserID,
		emojiId?: EmojiID,
	): Promise<Array<MessageReaction>>;
	abstract addReaction(
		channelId: ChannelID,
		messageId: MessageID,
		userId: UserID,
		emojiName: string,
		emojiId?: EmojiID,
		emojiAnimated?: boolean,
	): Promise<MessageReaction>;
	abstract removeReaction(
		channelId: ChannelID,
		messageId: MessageID,
		userId: UserID,
		emojiName: string,
		emojiId?: EmojiID,
	): Promise<void>;
	abstract removeAllReactions(channelId: ChannelID, messageId: MessageID): Promise<void>;
	abstract removeAllReactionsForEmoji(
		channelId: ChannelID,
		messageId: MessageID,
		emojiName: string,
		emojiId?: EmojiID,
	): Promise<void>;
	abstract countReactionUsers(
		channelId: ChannelID,
		messageId: MessageID,
		emojiName: string,
		emojiId?: EmojiID,
	): Promise<number>;
	abstract countUniqueReactions(channelId: ChannelID, messageId: MessageID): Promise<number>;
	abstract checkUserReactionExists(
		channelId: ChannelID,
		messageId: MessageID,
		userId: UserID,
		emojiName: string,
		emojiId?: EmojiID,
	): Promise<boolean>;
	abstract lookupAttachmentByChannelAndFilename(
		channelId: ChannelID,
		attachmentId: AttachmentID,
		filename: string,
	): Promise<MessageID | null>;
	abstract listChannelAttachments(channelId: ChannelID): Promise<Array<AttachmentLookupRow>>;
	abstract listMessagesByAuthor(
		authorId: UserID,
		limit?: number,
		lastMessageId?: MessageID,
	): Promise<Array<{channelId: ChannelID; messageId: MessageID}>>;
	abstract deleteMessagesByAuthor(
		authorId: UserID,
		channelIds?: Array<ChannelID>,
		messageIds?: Array<MessageID>,
	): Promise<void>;
	abstract backfillMessagesByAuthorIndex(authorId: UserID): Promise<void>;
	abstract anonymizeMessage(channelId: ChannelID, messageId: MessageID, newAuthorId: UserID): Promise<void>;
	abstract deleteAllChannelMessages(channelId: ChannelID): Promise<void>;
	abstract updateEmbeds(message: Message): Promise<void>;
}
