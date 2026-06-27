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

import type {MessagePlaintextEntry} from '@app/lib/e2ee/E2EEKeyStore';
import {filterAndSortEncryptedMessages} from '@app/utils/EncryptedMessageSearch';
import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {describe, expect, test} from 'vitest';

const createEntry = (
	messageId: string,
	plaintext: string,
	overrides: Partial<Message> = {},
): MessagePlaintextEntry => ({
	message_id: messageId,
	channel_id: '100',
	plaintext,
	message: {
		id: messageId,
		channel_id: '100',
		author: {id: '200', username: 'alice', discriminator: '0001', bot: false},
		type: 0,
		flags: 1 << 15,
		pinned: false,
		mention_everyone: false,
		content: plaintext,
		timestamp: new Date(Number(messageId)).toISOString(),
		mentions: [],
		mention_roles: [],
		mention_channels: [],
		embeds: [],
		attachments: [],
		stickers: [],
		reactions: [],
		...overrides,
	} as Message,
	created_at: Date.now(),
});

describe('filterAndSortEncryptedMessages', () => {
	test('matches plaintext locally without considering ciphertext', () => {
		const entries = [createEntry('1000', 'The launch code is Cobalt'), createEntry('2000', 'Nothing relevant here')];

		const results = filterAndSortEncryptedMessages(entries, {content: 'launch COBALT'});

		expect(results.map((entry) => entry.message_id)).toEqual(['1000']);
	});

	test('supports exact phrases and metadata filters', () => {
		const entries = [
			createEntry('1000', 'deploy after night shift', {pinned: true}),
			createEntry('2000', 'deploy during night shift', {pinned: false}),
		];

		const results = filterAndSortEncryptedMessages(entries, {
			exactPhrases: ['night shift'],
			pinned: true,
		});

		expect(results.map((entry) => entry.message_id)).toEqual(['1000']);
	});

	test('sorts newest first by default and honors ascending order', () => {
		const entries = [createEntry('1000', 'match'), createEntry('3000', 'match'), createEntry('2000', 'match')];

		expect(filterAndSortEncryptedMessages(entries, {content: 'match'}).map((entry) => entry.message_id)).toEqual([
			'3000',
			'2000',
			'1000',
		]);
		expect(
			filterAndSortEncryptedMessages(entries, {
				content: 'match',
				sortBy: 'timestamp',
				sortOrder: 'asc',
			}).map((entry) => entry.message_id),
		).toEqual(['1000', '2000', '3000']);
	});

	test('ignores legacy cache rows without a channel and message snapshot', () => {
		const legacyEntry: MessagePlaintextEntry = {
			message_id: '1000',
			plaintext: 'match',
			created_at: Date.now(),
		};

		expect(filterAndSortEncryptedMessages([legacyEntry], {content: 'match'})).toEqual([]);
	});
});
