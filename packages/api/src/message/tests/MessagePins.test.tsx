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
	getMessage,
	getPins,
	pinMessage,
	sendMessage,
	unpinMessage,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('Message Pins', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('should pin a message in guild channel', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'Pin this message');
		await pinMessage(harness, account.token, channelId, message.id);

		const pins = await getPins(harness, account.token, channelId);
		expect(pins.length).toBe(1);
		expect(pins[0].id).toBe(message.id);
	});

	test('should unpin a message in guild channel', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'Pin then unpin');
		await pinMessage(harness, account.token, channelId, message.id);

		let pins = await getPins(harness, account.token, channelId);
		expect(pins.length).toBe(1);

		await unpinMessage(harness, account.token, channelId, message.id);

		pins = await getPins(harness, account.token, channelId);
		expect(pins.length).toBe(0);
	});

	test('should return empty array when no pins exist', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const pins = await getPins(harness, account.token, channelId);
		expect(pins).toEqual([]);
	});

	test('should pin multiple messages', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message1 = await sendMessage(harness, account.token, channelId, 'First pinned');
		const message2 = await sendMessage(harness, account.token, channelId, 'Second pinned');
		const message3 = await sendMessage(harness, account.token, channelId, 'Third pinned');

		await pinMessage(harness, account.token, channelId, message1.id);
		await pinMessage(harness, account.token, channelId, message2.id);
		await pinMessage(harness, account.token, channelId, message3.id);

		const pins = await getPins(harness, account.token, channelId);
		expect(pins.length).toBe(3);

		const pinnedIds = pins.map((p) => p.id);
		expect(pinnedIds).toContain(message1.id);
		expect(pinnedIds).toContain(message2.id);
		expect(pinnedIds).toContain(message3.id);
	});

	test('should mark message as pinned in message response', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'Pin me');
		expect(message.pinned).toBe(false);

		await pinMessage(harness, account.token, channelId, message.id);

		const updatedMessage = await getMessage(harness, account.token, channelId, message.id);
		expect(updatedMessage.pinned).toBe(true);
	});

	test('pinning already pinned message should be idempotent', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'Pin me once');
		await pinMessage(harness, account.token, channelId, message.id);

		await createBuilder(harness, account.token)
			.put(`/channels/${channelId}/pins/${message.id}`)
			.body(null)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();

		const pins = await getPins(harness, account.token, channelId);
		expect(pins.length).toBe(1);
	});

	test('unpinning non-pinned message should be idempotent', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'Not pinned');

		await createBuilder(harness, account.token)
			.delete(`/channels/${channelId}/pins/${message.id}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
	});

	test('should reject pinning message from another channel', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'In channel 1');

		const guild2 = await createGuild(harness, account.token, 'Test Guild 2');
		const channel2Id = guild2.system_channel_id!;

		await createBuilder(harness, account.token)
			.put(`/channels/${channel2Id}/pins/${message.id}`)
			.body(null)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	test('should reject pinning nonexistent message', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		await createBuilder(harness, account.token)
			.put(`/channels/${channelId}/pins/999999999999999999`)
			.body(null)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	test('should require authentication to pin messages', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'Test');

		await createBuilderWithoutAuth(harness)
			.put(`/channels/${channelId}/pins/${message.id}`)
			.body(null)
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();
	});

	test('should require authentication to get pins', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		await createBuilderWithoutAuth(harness)
			.get(`/channels/${channelId}/messages/pins`)
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();
	});

	test('should preserve pin order when adding new pins', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message1 = await sendMessage(harness, account.token, channelId, 'First');
		const message2 = await sendMessage(harness, account.token, channelId, 'Second');

		await pinMessage(harness, account.token, channelId, message1.id);
		await pinMessage(harness, account.token, channelId, message2.id);

		const pins = await getPins(harness, account.token, channelId);
		expect(pins.length).toBe(2);
	});
});
