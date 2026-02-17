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
import {
	createGuild,
	getChannelBuckets,
	getMessages,
	seedMessagesAtTimestamps,
	seedMessagesWithContent,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message Fetch', () => {
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

	describe('Fetch with around parameter and limit', () => {
		it('fetches messages around anchor with limit', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'Around Limit Test Guild');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 60;
			const seedResult = await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

			expect(seedResult.messages).toHaveLength(totalMessages);

			const limit = 50;
			const olderCount = Math.floor(limit / 2);
			const newerCount = limit - 1 - olderCount;

			const anchorIndex = olderCount + 5;
			const anchorMessageId = seedResult.messages[anchorIndex].message_id;

			const fetchedMessages = await getMessages(harness, account.token, channelId, {
				limit: String(limit),
				around: anchorMessageId,
			});

			expect(fetchedMessages).toHaveLength(limit);

			let anchorPos = -1;
			for (let i = 0; i < fetchedMessages.length; i++) {
				if (fetchedMessages[i].id === anchorMessageId) {
					anchorPos = i;
					break;
				}
			}

			expect(anchorPos).not.toBe(-1);
			expect(anchorPos).toBe(newerCount);

			const afterCount = fetchedMessages.length - anchorPos - 1;
			expect(afterCount).toBe(olderCount);

			const anchorSnowflake = BigInt(anchorMessageId);

			const newerMessages = fetchedMessages.slice(0, anchorPos);
			for (let i = 0; i < newerMessages.length; i++) {
				const msgSnowflake = BigInt(newerMessages[i].id);
				expect(msgSnowflake > anchorSnowflake).toBe(true);

				if (i > 0) {
					const prevSnowflake = BigInt(newerMessages[i - 1].id);
					expect(prevSnowflake > msgSnowflake).toBe(true);
				}
			}

			const olderMessages = fetchedMessages.slice(anchorPos + 1);
			for (let i = 0; i < olderMessages.length; i++) {
				const msgSnowflake = BigInt(olderMessages[i].id);
				expect(msgSnowflake < anchorSnowflake).toBe(true);

				if (i > 0) {
					const prevSnowflake = BigInt(olderMessages[i - 1].id);
					expect(prevSnowflake > msgSnowflake).toBe(true);
				}
			}
		});

		it('handles around parameter with anchor near start', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'Around Near Start Test');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 30;
			const seedResult = await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

			const anchorIndex = 3;
			const anchorMessageId = seedResult.messages[anchorIndex].message_id;

			const fetchedMessages = await getMessages(harness, account.token, channelId, {
				limit: '50',
				around: anchorMessageId,
			});

			const foundAnchor = fetchedMessages.some((msg) => msg.id === anchorMessageId);
			expect(foundAnchor).toBe(true);

			for (let i = 0; i < fetchedMessages.length - 1; i++) {
				const current = BigInt(fetchedMessages[i].id);
				const next = BigInt(fetchedMessages[i + 1].id);
				expect(current > next).toBe(true);
			}
		});

		it('handles around parameter with anchor near end', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'Around Near End Test');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 30;
			const seedResult = await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

			const anchorIndex = totalMessages - 4;
			const anchorMessageId = seedResult.messages[anchorIndex].message_id;

			const fetchedMessages = await getMessages(harness, account.token, channelId, {
				limit: '50',
				around: anchorMessageId,
			});

			const foundAnchor = fetchedMessages.some((msg) => msg.id === anchorMessageId);
			expect(foundAnchor).toBe(true);

			for (let i = 0; i < fetchedMessages.length - 1; i++) {
				const current = BigInt(fetchedMessages[i].id);
				const next = BigInt(fetchedMessages[i + 1].id);
				expect(current > next).toBe(true);
			}
		});
	});

	describe('Fetch from large dataset', () => {
		it('fetches all messages from large dataset with pagination', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'Large Dataset Test Guild');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 150;
			const seedResult = await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

			expect(seedResult.messages).toHaveLength(totalMessages);
			expect(seedResult.buckets_populated.length).toBeGreaterThan(0);

			const fetchedIds = new Set<string>();
			const allFetchedMessages: Array<{id: string; channel_id: string; content: string}> = [];
			const limit = 50;
			let beforeId: string | undefined;

			while (allFetchedMessages.length < totalMessages + 10) {
				const queryParams: Record<string, string> = {limit: String(limit)};
				if (beforeId) {
					queryParams['before'] = beforeId;
				}

				const messages = await getMessages(harness, account.token, channelId, queryParams);

				if (messages.length === 0) {
					break;
				}

				for (let i = 0; i < messages.length - 1; i++) {
					const current = BigInt(messages[i].id);
					const next = BigInt(messages[i + 1].id);
					expect(current > next).toBe(true);
				}

				for (const msg of messages) {
					expect(fetchedIds.has(msg.id)).toBe(false);
					fetchedIds.add(msg.id);
				}

				allFetchedMessages.push(...messages);
				beforeId = messages[messages.length - 1].id;
			}

			expect(allFetchedMessages).toHaveLength(totalMessages);

			const seededIds = new Set(seedResult.messages.map((m) => m.message_id));
			for (const msg of allFetchedMessages) {
				expect(seededIds.has(msg.id)).toBe(true);
			}

			for (let i = 0; i < allFetchedMessages.length - 1; i++) {
				const current = BigInt(allFetchedMessages[i].id);
				const next = BigInt(allFetchedMessages[i + 1].id);
				expect(current > next).toBe(true);
			}

			for (const msg of allFetchedMessages) {
				expect(msg.channel_id).toBe(channelId);
			}
		});

		it('handles very large dataset spanning many buckets', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'Many Buckets Test');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 200;
			const seedResult = await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

			expect(seedResult.messages).toHaveLength(totalMessages);

			const buckets = await getChannelBuckets(harness, channelId);
			expect(buckets.count).toBeGreaterThan(0);

			const messages = await getMessages(harness, account.token, channelId, {limit: '100'});
			expect(messages.length).toBeLessThanOrEqual(100);
			expect(messages.length).toBeGreaterThan(0);

			const latestSeededId = seedResult.messages[totalMessages - 1].message_id;
			expect(messages[0].id).toBe(latestSeededId);
		});
	});

	describe('Fetch before with cross bucket boundaries', () => {
		it('fetches messages before anchor crossing bucket boundaries', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'Cross Bucket Before Test');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const messagesPerBucket = 5;
			const totalMessages = messagesPerBucket * 3;
			const timestamps: Array<Date> = [];

			const bucket1Base = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
			for (let i = 0; i < messagesPerBucket; i++) {
				timestamps.push(new Date(bucket1Base.getTime() + i * 60000));
			}

			const bucket2Base = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			for (let i = 0; i < messagesPerBucket; i++) {
				timestamps.push(new Date(bucket2Base.getTime() + i * 60000));
			}

			const bucket3Base = new Date();
			for (let i = 0; i < messagesPerBucket; i++) {
				timestamps.push(new Date(bucket3Base.getTime() + i * 60000));
			}

			const seedResult = await seedMessagesAtTimestamps(harness, channelId, timestamps, account.userId);

			expect(seedResult.messages).toHaveLength(totalMessages);
			expect(seedResult.buckets_populated.length).toBeGreaterThanOrEqual(2);

			const anchorIndex = 12;
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

			const bucketsFound = new Set<number>();
			for (const seededMsg of seedResult.messages) {
				for (const fetchedMsg of fetchedMessages) {
					if (seededMsg.message_id === fetchedMsg.id) {
						bucketsFound.add(seededMsg.bucket);
					}
				}
			}

			expect(bucketsFound.size).toBeGreaterThanOrEqual(2);
		});
	});

	describe('Fetch after a specific message ID', () => {
		it('fetches messages after anchor', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'After Test Guild');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 20;
			const timestamps: Array<Date> = [];
			const baseTime = new Date(Date.now() - 3600000);
			for (let i = 0; i < totalMessages; i++) {
				timestamps.push(new Date(baseTime.getTime() + i * 60000));
			}

			const seedResult = await seedMessagesAtTimestamps(harness, channelId, timestamps, account.userId);

			expect(seedResult.messages).toHaveLength(totalMessages);

			const anchorIndex = 4;
			const anchorMessageId = seedResult.messages[anchorIndex].message_id;

			const limit = 10;
			const fetchedMessages = await getMessages(harness, account.token, channelId, {
				limit: String(limit),
				after: anchorMessageId,
			});

			expect(fetchedMessages).toHaveLength(limit);

			for (let i = 0; i < fetchedMessages.length - 1; i++) {
				const current = BigInt(fetchedMessages[i].id);
				const next = BigInt(fetchedMessages[i + 1].id);
				expect(current > next).toBe(true);
			}

			const expectedFirstIndex = totalMessages - 1;
			const expectedLastIndex = totalMessages - limit;

			const expectedIds = new Set<string>();
			for (let i = expectedLastIndex; i <= expectedFirstIndex; i++) {
				expectedIds.add(seedResult.messages[i].message_id);
			}

			for (const msg of fetchedMessages) {
				expect(expectedIds.has(msg.id)).toBe(true);
			}

			const expectedFirstMessageId = seedResult.messages[expectedFirstIndex].message_id;
			expect(fetchedMessages[0].id).toBe(expectedFirstMessageId);

			const expectedLastMessageId = seedResult.messages[expectedLastIndex].message_id;
			expect(fetchedMessages[limit - 1].id).toBe(expectedLastMessageId);

			const anchorSnowflake = BigInt(anchorMessageId);
			for (const msg of fetchedMessages) {
				const msgSnowflake = BigInt(msg.id);
				expect(msgSnowflake > anchorSnowflake).toBe(true);
			}
		});

		it('fetches all messages after oldest message', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'After Oldest Test');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 15;
			const seedResult = await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

			const oldestMessageId = seedResult.messages[0].message_id;

			const fetchedMessages = await getMessages(harness, account.token, channelId, {
				limit: '50',
				after: oldestMessageId,
			});

			expect(fetchedMessages).toHaveLength(totalMessages - 1);

			for (const msg of fetchedMessages) {
				expect(BigInt(msg.id) > BigInt(oldestMessageId)).toBe(true);
			}
		});

		it('returns empty when after newest message', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'After Newest Test');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 10;
			const seedResult = await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

			const newestMessageId = seedResult.messages[totalMessages - 1].message_id;

			const fetchedMessages = await getMessages(harness, account.token, channelId, {
				limit: '50',
				after: newestMessageId,
			});

			expect(fetchedMessages).toHaveLength(0);
		});
	});

	describe('Fetch latest messages (no parameters)', () => {
		it('fetches latest messages with bucket index', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'Latest Messages Test');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 50;
			const seedResult = await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

			expect(seedResult.messages).toHaveLength(totalMessages);
			expect(seedResult.channel_state_updated).toBe(true);
			expect(seedResult.buckets_populated.length).toBeGreaterThan(0);

			const buckets = await getChannelBuckets(harness, channelId);
			expect(buckets.count).toBeGreaterThan(0);

			const limit = 25;
			const fetchedMessages = await getMessages(harness, account.token, channelId, {
				limit: String(limit),
			});

			expect(fetchedMessages).toHaveLength(limit);

			for (let i = 0; i < fetchedMessages.length - 1; i++) {
				const current = BigInt(fetchedMessages[i].id);
				const next = BigInt(fetchedMessages[i + 1].id);
				expect(current > next).toBe(true);
			}

			for (const msg of fetchedMessages) {
				expect(msg.channel_id).toBe(channelId);
			}

			const expectedLatestIds = new Set<string>();
			for (let i = totalMessages - limit; i < totalMessages; i++) {
				expectedLatestIds.add(seedResult.messages[i].message_id);
			}

			for (const msg of fetchedMessages) {
				expect(expectedLatestIds.has(msg.id)).toBe(true);
			}

			const latestSeededMessageId = seedResult.messages[totalMessages - 1].message_id;
			expect(fetchedMessages[0].id).toBe(latestSeededMessageId);
		});

		it('fetches with default limit', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'Default Limit Test');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 100;
			await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

			const fetchedMessages = await getMessages(harness, account.token, channelId);

			expect(fetchedMessages.length).toBeGreaterThan(0);
			expect(fetchedMessages.length).toBeLessThanOrEqual(100);

			for (let i = 0; i < fetchedMessages.length - 1; i++) {
				const current = BigInt(fetchedMessages[i].id);
				const next = BigInt(fetchedMessages[i + 1].id);
				expect(current > next).toBe(true);
			}
		});

		it('fetches from sparse buckets', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'Sparse Buckets Test');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const bucketCount = 60;
			const timestamps: Array<Date> = [];
			const base = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 * (bucketCount - 1));

			for (let i = 0; i < bucketCount; i++) {
				timestamps.push(new Date(base.getTime() + 10 * 24 * 60 * 60 * 1000 * i));
			}

			const seedResult = await seedMessagesAtTimestamps(harness, channelId, timestamps, account.userId);

			expect(seedResult.messages).toHaveLength(bucketCount);

			const limit = 50;
			const fetchedMessages = await getMessages(harness, account.token, channelId, {
				limit: String(limit),
			});

			expect(fetchedMessages).toHaveLength(limit);
			expect(fetchedMessages[0].id).toBe(seedResult.messages[bucketCount - 1].message_id);
		});
	});

	describe('Message ordering verification', () => {
		it('verifies messages are always returned newest to oldest', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'Ordering Test Guild');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 50;
			const seedResult = await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

			const latestMessages = await getMessages(harness, account.token, channelId, {limit: '25'});

			for (let i = 0; i < latestMessages.length - 1; i++) {
				const current = BigInt(latestMessages[i].id);
				const next = BigInt(latestMessages[i + 1].id);
				expect(current > next).toBe(true);
			}

			const anchorIndex = 25;
			const anchorMessageId = seedResult.messages[anchorIndex].message_id;

			const beforeMessages = await getMessages(harness, account.token, channelId, {
				limit: '20',
				before: anchorMessageId,
			});

			for (let i = 0; i < beforeMessages.length - 1; i++) {
				const current = BigInt(beforeMessages[i].id);
				const next = BigInt(beforeMessages[i + 1].id);
				expect(current > next).toBe(true);
			}

			const afterMessages = await getMessages(harness, account.token, channelId, {
				limit: '20',
				after: seedResult.messages[5].message_id,
			});

			for (let i = 0; i < afterMessages.length - 1; i++) {
				const current = BigInt(afterMessages[i].id);
				const next = BigInt(afterMessages[i + 1].id);
				expect(current > next).toBe(true);
			}

			const aroundMessages = await getMessages(harness, account.token, channelId, {
				limit: '25',
				around: seedResult.messages[25].message_id,
			});

			for (let i = 0; i < aroundMessages.length - 1; i++) {
				const current = BigInt(aroundMessages[i].id);
				const next = BigInt(aroundMessages[i + 1].id);
				expect(current > next).toBe(true);
			}
		});

		it('verifies consistent ordering across paginated requests', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'Paginated Ordering Test');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 75;
			await seedMessagesWithContent(harness, channelId, totalMessages, account.userId);

			const allMessages: Array<{id: string}> = [];
			let lastId: string | undefined;

			while (allMessages.length < totalMessages) {
				const queryParams: Record<string, string> = {limit: '25'};
				if (lastId) {
					queryParams['before'] = lastId;
				}

				const messages = await getMessages(harness, account.token, channelId, queryParams);
				if (messages.length === 0) {
					break;
				}

				if (allMessages.length > 0) {
					const lastFetchedId = BigInt(allMessages[allMessages.length - 1].id);
					const firstNewId = BigInt(messages[0].id);
					expect(lastFetchedId > firstNewId).toBe(true);
				}

				allMessages.push(...messages);
				lastId = messages[messages.length - 1].id;
			}

			expect(allMessages).toHaveLength(totalMessages);

			for (let i = 0; i < allMessages.length - 1; i++) {
				const current = BigInt(allMessages[i].id);
				const next = BigInt(allMessages[i + 1].id);
				expect(current > next).toBe(true);
			}
		});

		it('verifies snowflake IDs correlate with timestamps', async () => {
			const account = await createTestAccount(harness);
			const guild = await createGuild(harness, account.token, 'Snowflake Timestamp Test');
			const channelId = guild.system_channel_id;

			if (!channelId) {
				throw new Error('Guild has no system channel');
			}

			const totalMessages = 20;
			const timestamps: Array<Date> = [];
			const baseTime = new Date(Date.now() - 3600000);

			for (let i = 0; i < totalMessages; i++) {
				timestamps.push(new Date(baseTime.getTime() + i * 60000));
			}

			const seedResult = await seedMessagesAtTimestamps(harness, channelId, timestamps, account.userId);

			const fetchedMessages = await getMessages(harness, account.token, channelId, {limit: '50'});

			expect(fetchedMessages).toHaveLength(totalMessages);

			for (let i = 0; i < fetchedMessages.length - 1; i++) {
				const currentId = BigInt(fetchedMessages[i].id);
				const nextId = BigInt(fetchedMessages[i + 1].id);
				expect(currentId > nextId).toBe(true);

				if (fetchedMessages[i].timestamp && fetchedMessages[i + 1].timestamp) {
					const currentTs = new Date(fetchedMessages[i].timestamp as string).getTime();
					const nextTs = new Date(fetchedMessages[i + 1].timestamp as string).getTime();
					expect(currentTs >= nextTs).toBe(true);
				}
			}

			const latestSeeded = seedResult.messages[totalMessages - 1].message_id;
			const oldestSeeded = seedResult.messages[0].message_id;

			expect(fetchedMessages[0].id).toBe(latestSeeded);
			expect(fetchedMessages[totalMessages - 1].id).toBe(oldestSeeded);
		});
	});
});
