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

import {ChannelMessages} from '@app/lib/ChannelMessages';
import {ChannelRecord} from '@app/records/ChannelRecord';
import {MessageRecord} from '@app/records/MessageRecord';
import {ChannelStreamType, createChannelStream, isNewMessageGroup} from '@app/utils/MessageGroupingUtils';
import {ChannelTypes, MessageTypes} from '@fluxer/constants/src/ChannelConstants';
import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {describe, expect, it} from 'vitest';

interface MessageFixtureOptions {
	id: string;
	channelId: string;
	authorId: string;
	username: string;
	type: number;
	timestamp: string;
	content: string;
	system?: boolean;
}

function createRawMessage(options: MessageFixtureOptions): Message {
	return {
		id: options.id,
		channel_id: options.channelId,
		guild_id: '1471070679785500672',
		author: {
			id: options.authorId,
			username: options.username,
			discriminator: '0001',
			global_name: null,
			avatar: null,
			avatar_color: null,
			bot: false,
			system: options.system ?? false,
			flags: 0,
		},
		type: options.type,
		flags: 0,
		pinned: false,
		mention_everyone: false,
		content: options.content,
		timestamp: options.timestamp,
		mentions: [],
		mention_roles: [],
		mention_channels: [],
		embeds: [],
		attachments: [],
		stickers: [],
		reactions: [],
		state: 'SENT',
	};
}

function createMessageRecord(options: MessageFixtureOptions): MessageRecord {
	return new MessageRecord(createRawMessage(options), {skipUserCache: true});
}

function createChannelRecord(channelId: string): ChannelRecord {
	return new ChannelRecord({
		id: channelId,
		guild_id: '1471070679785500672',
		type: ChannelTypes.GUILD_TEXT,
	});
}

describe('MessageGroupingUtils', () => {
	describe('isNewMessageGroup', () => {
		it('starts a new group when a normal message follows a client system message', () => {
			const prevMessage = createMessageRecord({
				id: '1471169898326523904',
				channelId: '1471070679785500675',
				authorId: '0',
				username: 'Fluxerbot',
				type: MessageTypes.CLIENT_SYSTEM,
				timestamp: '2026-02-11T15:43:56.776Z',
				content: 'You changed your nickname in this community.',
				system: true,
			});
			const currentMessage = createMessageRecord({
				id: '1471169906842796039',
				channelId: '1471070679785500675',
				authorId: '1469909056457908225',
				username: 'SuperGoldTurtle',
				type: MessageTypes.DEFAULT,
				timestamp: '2026-02-11T15:43:58.806Z',
				content: 'tset',
			});

			expect(isNewMessageGroup(undefined, prevMessage, currentMessage)).toBe(true);
		});

		it('starts a new group when a client system message follows a normal message', () => {
			const prevMessage = createMessageRecord({
				id: '1471169906842796039',
				channelId: '1471070679785500675',
				authorId: '1469909056457908225',
				username: 'SuperGoldTurtle',
				type: MessageTypes.DEFAULT,
				timestamp: '2026-02-11T15:43:58.806Z',
				content: 'tset',
			});
			const currentMessage = createMessageRecord({
				id: '1471169916842796039',
				channelId: '1471070679785500675',
				authorId: '0',
				username: 'Fluxerbot',
				type: MessageTypes.CLIENT_SYSTEM,
				timestamp: '2026-02-11T15:43:59.006Z',
				content: 'Only you can see this message.',
				system: true,
			});

			expect(isNewMessageGroup(undefined, prevMessage, currentMessage)).toBe(true);
		});

		it('keeps grouping for adjacent normal messages from the same author', () => {
			const prevMessage = createMessageRecord({
				id: '1471169906842796039',
				channelId: '1471070679785500675',
				authorId: '1469909056457908225',
				username: 'SuperGoldTurtle',
				type: MessageTypes.DEFAULT,
				timestamp: '2026-02-11T15:43:58.806Z',
				content: 'first',
			});
			const currentMessage = createMessageRecord({
				id: '1471169916842796039',
				channelId: '1471070679785500675',
				authorId: '1469909056457908225',
				username: 'SuperGoldTurtle',
				type: MessageTypes.DEFAULT,
				timestamp: '2026-02-11T15:43:59.006Z',
				content: 'second',
			});

			expect(isNewMessageGroup(undefined, prevMessage, currentMessage)).toBe(false);
		});

		it('keeps grouping for consecutive client system messages', () => {
			const prevMessage = createMessageRecord({
				id: '1471169898326523904',
				channelId: '1471070679785500675',
				authorId: '0',
				username: 'Fluxerbot',
				type: MessageTypes.CLIENT_SYSTEM,
				timestamp: '2026-02-11T15:43:56.776Z',
				content: 'You changed your nickname in this community.',
				system: true,
			});
			const currentMessage = createMessageRecord({
				id: '1471169898326523905',
				channelId: '1471070679785500675',
				authorId: '0',
				username: 'Fluxerbot',
				type: MessageTypes.CLIENT_SYSTEM,
				timestamp: '2026-02-11T15:43:57.000Z',
				content: 'Only you can see this message.',
				system: true,
			});

			expect(isNewMessageGroup(undefined, prevMessage, currentMessage)).toBe(false);
		});

		it('keeps grouping for consecutive system messages (e.g. USER_JOIN)', () => {
			const prevMessage = createMessageRecord({
				id: '1471169898326523900',
				channelId: '1471070679785500675',
				authorId: '0',
				username: 'Fluxerbot',
				type: MessageTypes.USER_JOIN,
				timestamp: '2026-02-11T15:43:55.000Z',
				content: 'Alice joined the channel.',
				system: true,
			});
			const currentMessage = createMessageRecord({
				id: '1471169898326523901',
				channelId: '1471070679785500675',
				authorId: '0',
				username: 'Fluxerbot',
				type: MessageTypes.USER_JOIN,
				timestamp: '2026-02-11T15:43:56.000Z',
				content: 'Bob joined the channel.',
				system: true,
			});

			expect(isNewMessageGroup(undefined, prevMessage, currentMessage)).toBe(false);
		});

		it('keeps grouping for mixed consecutive system types (client-system and USER_JOIN)', () => {
			const prevMessage = createMessageRecord({
				id: '1471169898326523904',
				channelId: '1471070679785500675',
				authorId: '0',
				username: 'Fluxerbot',
				type: MessageTypes.CLIENT_SYSTEM,
				timestamp: '2026-02-11T15:43:56.776Z',
				content: 'Only you can see this message.',
				system: true,
			});
			const currentMessage = createMessageRecord({
				id: '1471169898326523901',
				channelId: '1471070679785500675',
				authorId: '0',
				username: 'Fluxerbot',
				type: MessageTypes.USER_JOIN,
				timestamp: '2026-02-11T15:43:57.000Z',
				content: 'Alice joined the channel.',
				system: true,
			});

			expect(isNewMessageGroup(undefined, prevMessage, currentMessage)).toBe(false);
		});
	});

	describe('createChannelStream', () => {
		it('assigns a new group id after a client system message', () => {
			const channel = createChannelRecord('1471070679785500675');
			const clientSystemMessage = createMessageRecord({
				id: '1471169898326523904',
				channelId: channel.id,
				authorId: '0',
				username: 'Fluxerbot',
				type: MessageTypes.CLIENT_SYSTEM,
				timestamp: '2026-02-11T15:43:56.776Z',
				content: 'You changed your nickname in this community from SuperGoldTurtle to sup.',
				system: true,
			});
			const userMessage = createMessageRecord({
				id: '1471169906842796039',
				channelId: channel.id,
				authorId: '1469909056457908225',
				username: 'SuperGoldTurtle',
				type: MessageTypes.DEFAULT,
				timestamp: '2026-02-11T15:43:58.806Z',
				content: 'tset',
			});
			const messages = ChannelMessages.getOrCreate(channel.id).reset([clientSystemMessage, userMessage]);

			try {
				const stream = createChannelStream({
					channel,
					messages,
					oldestUnreadMessageId: null,
					treatSpam: false,
				});
				const messageItems = stream.filter((item) => item.type === ChannelStreamType.MESSAGE);

				expect(messageItems).toHaveLength(2);
				expect(messageItems[0]?.groupId).toBe(clientSystemMessage.id);
				expect(messageItems[1]?.groupId).toBe(userMessage.id);
			} finally {
				ChannelMessages.clear(channel.id);
			}
		});

		it('keeps client system messages isolated between normal messages', () => {
			const channel = createChannelRecord('1471070679785500676');
			const firstUserMessage = createMessageRecord({
				id: '1471169898326523910',
				channelId: channel.id,
				authorId: '1469909056457908225',
				username: 'SuperGoldTurtle',
				type: MessageTypes.DEFAULT,
				timestamp: '2026-02-11T15:43:50.000Z',
				content: 'first',
			});
			const clientSystemMessage = createMessageRecord({
				id: '1471169898326523911',
				channelId: channel.id,
				authorId: '0',
				username: 'Fluxerbot',
				type: MessageTypes.CLIENT_SYSTEM,
				timestamp: '2026-02-11T15:43:51.000Z',
				content: 'Only you can see this message.',
				system: true,
			});
			const secondUserMessage = createMessageRecord({
				id: '1471169898326523912',
				channelId: channel.id,
				authorId: '1469909056457908225',
				username: 'SuperGoldTurtle',
				type: MessageTypes.DEFAULT,
				timestamp: '2026-02-11T15:43:52.000Z',
				content: 'second',
			});
			const messages = ChannelMessages.getOrCreate(channel.id).reset([
				firstUserMessage,
				clientSystemMessage,
				secondUserMessage,
			]);

			try {
				const stream = createChannelStream({
					channel,
					messages,
					oldestUnreadMessageId: null,
					treatSpam: false,
				});
				const messageItems = stream.filter((item) => item.type === ChannelStreamType.MESSAGE);

				expect(messageItems).toHaveLength(3);
				expect(messageItems[0]?.groupId).toBe(firstUserMessage.id);
				expect(messageItems[1]?.groupId).toBe(clientSystemMessage.id);
				expect(messageItems[2]?.groupId).toBe(secondUserMessage.id);
			} finally {
				ChannelMessages.clear(channel.id);
			}
		});

		it('groups consecutive system messages (including client-system) together', () => {
			const channel = createChannelRecord('1471070679785500677');
			const firstSystem = createMessageRecord({
				id: '1471169898326523920',
				channelId: channel.id,
				authorId: '0',
				username: 'Fluxerbot',
				type: MessageTypes.CLIENT_SYSTEM,
				timestamp: '2026-02-11T15:43:56.000Z',
				content: 'You changed your nickname.',
				system: true,
			});
			const secondSystem = createMessageRecord({
				id: '1471169898326523921',
				channelId: channel.id,
				authorId: '0',
				username: 'Fluxerbot',
				type: MessageTypes.CLIENT_SYSTEM,
				timestamp: '2026-02-11T15:43:57.000Z',
				content: 'Only you can see this message.',
				system: true,
			});
			const messages = ChannelMessages.getOrCreate(channel.id).reset([firstSystem, secondSystem]);

			try {
				const stream = createChannelStream({
					channel,
					messages,
					oldestUnreadMessageId: null,
					treatSpam: false,
				});
				const messageItems = stream.filter((item) => item.type === ChannelStreamType.MESSAGE);

				expect(messageItems).toHaveLength(2);
				expect(messageItems[0]?.groupId).toBe(firstSystem.id);
				expect(messageItems[1]?.groupId).toBe(firstSystem.id);
			} finally {
				ChannelMessages.clear(channel.id);
			}
		});
	});
});
