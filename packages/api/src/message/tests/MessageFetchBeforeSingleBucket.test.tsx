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
import {createGuild, getMessages, seedMessagesAtTimestamps} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message Fetch Before Single Bucket', () => {
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

	it('fetches messages before anchor within single bucket', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Before Single Bucket Test Guild');
		const channelId = guild.system_channel_id;

		if (!channelId) {
			throw new Error('Guild has no system channel');
		}

		const totalMessages = 20;
		const timestamps: Array<Date> = [];
		const baseTime = new Date(Date.now() - 3600000);

		for (let i = 0; i < totalMessages; i++) {
			timestamps.push(new Date(baseTime.getTime() + i * 10000));
		}

		const seedResult = await seedMessagesAtTimestamps(harness, channelId, timestamps, account.userId);

		expect(seedResult.messages).toHaveLength(totalMessages);

		const anchorIndex = 14;
		const anchorMessageId = seedResult.messages[anchorIndex].message_id;

		const limit = 10;
		const fetchedMessages = await getMessages(harness, account.token, channelId, {
			limit: String(limit),
			before: anchorMessageId,
		});

		expect(fetchedMessages).toHaveLength(limit);

		for (let i = 0; i < fetchedMessages.length - 1; i++) {
			const current = BigInt(fetchedMessages[i].id);
			const next = BigInt(fetchedMessages[i + 1].id);
			expect(current > next).toBe(true);
		}

		const expectedIds = new Set<string>();
		for (let i = anchorIndex - limit; i < anchorIndex; i++) {
			expectedIds.add(seedResult.messages[i].message_id);
		}

		for (const msg of fetchedMessages) {
			expect(expectedIds.has(msg.id)).toBe(true);
		}

		const expectedFirstMessageId = seedResult.messages[anchorIndex - 1].message_id;
		expect(fetchedMessages[0].id).toBe(expectedFirstMessageId);

		const expectedLastMessageId = seedResult.messages[anchorIndex - limit].message_id;
		expect(fetchedMessages[limit - 1].id).toBe(expectedLastMessageId);

		const anchorSnowflake = BigInt(anchorMessageId);
		for (const msg of fetchedMessages) {
			const msgSnowflake = BigInt(msg.id);
			expect(msgSnowflake < anchorSnowflake).toBe(true);
		}
	});

	it('fetches messages before anchor at beginning of channel', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Before Beginning Test Guild');
		const channelId = guild.system_channel_id;

		if (!channelId) {
			throw new Error('Guild has no system channel');
		}

		const totalMessages = 10;
		const timestamps: Array<Date> = [];
		const baseTime = new Date(Date.now() - 3600000);

		for (let i = 0; i < totalMessages; i++) {
			timestamps.push(new Date(baseTime.getTime() + i * 10000));
		}

		const seedResult = await seedMessagesAtTimestamps(harness, channelId, timestamps, account.userId);

		const anchorIndex = 3;
		const anchorMessageId = seedResult.messages[anchorIndex].message_id;

		const fetchedMessages = await getMessages(harness, account.token, channelId, {
			limit: '50',
			before: anchorMessageId,
		});

		expect(fetchedMessages).toHaveLength(anchorIndex);

		for (const msg of fetchedMessages) {
			const msgSnowflake = BigInt(msg.id);
			const anchorSnowflake = BigInt(anchorMessageId);
			expect(msgSnowflake < anchorSnowflake).toBe(true);
		}
	});

	it('returns empty when before first message', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Before First Message Test');
		const channelId = guild.system_channel_id;

		if (!channelId) {
			throw new Error('Guild has no system channel');
		}

		const totalMessages = 10;
		const timestamps: Array<Date> = [];
		const baseTime = new Date(Date.now() - 3600000);

		for (let i = 0; i < totalMessages; i++) {
			timestamps.push(new Date(baseTime.getTime() + i * 10000));
		}

		const seedResult = await seedMessagesAtTimestamps(harness, channelId, timestamps, account.userId);

		const firstMessageId = seedResult.messages[0].message_id;

		const fetchedMessages = await getMessages(harness, account.token, channelId, {
			limit: '50',
			before: firstMessageId,
		});

		expect(fetchedMessages).toHaveLength(0);
	});
});
