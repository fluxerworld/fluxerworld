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
	clearChannelMessages,
	createGuild,
	getChannelBuckets,
	getChannelState,
	getMessages,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message Fetch Empty Channel', () => {
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

	it('returns empty array for channel with no messages', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Empty Channel Test Guild');
		const channelId = guild.system_channel_id;

		if (!channelId) {
			throw new Error('Guild has no system channel');
		}

		await clearChannelMessages(harness, channelId);

		const state = await getChannelState(harness, channelId);
		expect(state.has_messages).toBe(false);
		expect(state.last_message_id).toBeNull();

		const messages = await getMessages(harness, account.token, channelId, {limit: '50'});

		expect(messages).toHaveLength(0);

		const buckets = await getChannelBuckets(harness, channelId);
		expect(buckets.count).toBe(0);
	});

	it('returns empty array when fetching with before parameter in empty channel', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Empty Channel Before Test');
		const channelId = guild.system_channel_id;

		if (!channelId) {
			throw new Error('Guild has no system channel');
		}

		await clearChannelMessages(harness, channelId);

		const messages = await getMessages(harness, account.token, channelId, {
			limit: '50',
			before: '999999999999999999',
		});

		expect(messages).toHaveLength(0);
	});

	it('returns empty array when fetching with after parameter in empty channel', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Empty Channel After Test');
		const channelId = guild.system_channel_id;

		if (!channelId) {
			throw new Error('Guild has no system channel');
		}

		await clearChannelMessages(harness, channelId);

		const messages = await getMessages(harness, account.token, channelId, {
			limit: '50',
			after: '0',
		});

		expect(messages).toHaveLength(0);
	});
});
