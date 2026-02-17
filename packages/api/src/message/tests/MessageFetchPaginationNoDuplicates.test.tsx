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

import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {createGuild, getMessages, seedMessagesWithContent} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message Fetch Pagination No Duplicates', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('paginates through messages without duplicates', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Pagination Test Guild');
		const channelId = guild.system_channel_id;

		if (!channelId) {
			throw new Error('Guild has no system channel');
		}

		const totalMessages = 100;
		const seedResult = await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

		expect(seedResult.messages).toHaveLength(totalMessages);

		const limit = 25;
		const allMessageIds = new Set<string>();
		let lastMessageId: string | undefined;
		let pageCount = 0;

		while (pageCount < 10) {
			const queryParams: Record<string, string> = {limit: String(limit)};
			if (lastMessageId) {
				queryParams['before'] = lastMessageId;
			}

			const fetchedMessages = await getMessages(harness, account.token, channelId, queryParams);

			if (fetchedMessages.length === 0) {
				break;
			}

			pageCount++;

			for (let i = 0; i < fetchedMessages.length; i++) {
				const msg = fetchedMessages[i];
				expect(allMessageIds.has(msg.id)).toBe(false);
				allMessageIds.add(msg.id);
			}

			for (let i = 0; i < fetchedMessages.length - 1; i++) {
				const current = BigInt(fetchedMessages[i].id);
				const next = BigInt(fetchedMessages[i + 1].id);
				expect(current > next).toBe(true);
			}

			lastMessageId = fetchedMessages[fetchedMessages.length - 1].id;

			if (fetchedMessages.length < limit) {
				break;
			}
		}

		expect(allMessageIds.size).toBe(totalMessages);

		for (const seededMsg of seedResult.messages) {
			expect(allMessageIds.has(seededMsg.message_id)).toBe(true);
		}

		const expectedPages = Math.ceil(totalMessages / limit);
		expect(pageCount).toBe(expectedPages);
	});

	it('handles pagination with small limit', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Small Limit Pagination Test');
		const channelId = guild.system_channel_id;

		if (!channelId) {
			throw new Error('Guild has no system channel');
		}

		const totalMessages = 15;
		const seedResult = await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

		expect(seedResult.messages).toHaveLength(totalMessages);

		const limit = 5;
		const allMessageIds = new Set<string>();
		let lastMessageId: string | undefined;
		let pageCount = 0;

		while (pageCount < 10) {
			const queryParams: Record<string, string> = {limit: String(limit)};
			if (lastMessageId) {
				queryParams['before'] = lastMessageId;
			}

			const fetchedMessages = await getMessages(harness, account.token, channelId, queryParams);

			if (fetchedMessages.length === 0) {
				break;
			}

			pageCount++;

			for (const msg of fetchedMessages) {
				expect(allMessageIds.has(msg.id)).toBe(false);
				allMessageIds.add(msg.id);
			}

			lastMessageId = fetchedMessages[fetchedMessages.length - 1].id;

			if (fetchedMessages.length < limit) {
				break;
			}
		}

		expect(allMessageIds.size).toBe(totalMessages);
		expect(pageCount).toBe(3);
	});
});
