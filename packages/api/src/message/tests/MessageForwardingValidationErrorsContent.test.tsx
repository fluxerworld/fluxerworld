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

import {
	acceptInvite,
	createChannelInvite,
	createDMChannel,
	createGuild,
	createMessageHarness,
	createTestAccount,
	ensureSessionStarted,
	sendMessage,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Message forwarding validation errors content', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createMessageHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('rejects forward with content', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);

		const guild = await createGuild(harness, user1.token, 'Test Guild');
		const invite = await createChannelInvite(harness, user1.token, guild.system_channel_id!);
		await acceptInvite(harness, user2.token, invite.code);

		const channel = await createDMChannel(harness, user1.token, user2.userId);
		const originalMessage = await sendMessage(harness, user1.token, channel.id, 'Original message');

		const payload = {
			content: 'Cannot have content when forwarding',
			message_reference: {
				message_id: originalMessage.id,
				channel_id: channel.id,
				type: 1,
			},
		};

		await createBuilder(harness, user1.token)
			.post(`/channels/${channel.id}/messages`)
			.body(payload)
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects forward with embeds', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);

		const guild = await createGuild(harness, user1.token, 'Test Guild');
		const invite = await createChannelInvite(harness, user1.token, guild.system_channel_id!);
		await acceptInvite(harness, user2.token, invite.code);

		const channel = await createDMChannel(harness, user1.token, user2.userId);
		const originalMessage = await sendMessage(harness, user1.token, channel.id, 'Original message');

		const payload = {
			embeds: [
				{
					title: 'Test embed',
				},
			],
			message_reference: {
				message_id: originalMessage.id,
				channel_id: channel.id,
				type: 1,
			},
		};

		await createBuilder(harness, user1.token)
			.post(`/channels/${channel.id}/messages`)
			.body(payload)
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects forward with attachments', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);

		const guild = await createGuild(harness, user1.token, 'Test Guild');
		const invite = await createChannelInvite(harness, user1.token, guild.system_channel_id!);
		await acceptInvite(harness, user2.token, invite.code);

		const channel = await createDMChannel(harness, user1.token, user2.userId);
		const originalMessage = await sendMessage(harness, user1.token, channel.id, 'Original message');

		const payload = {
			attachments: [
				{
					id: 0,
					filename: 'test.png',
				},
			],
			message_reference: {
				message_id: originalMessage.id,
				channel_id: channel.id,
				type: 1,
			},
		};

		await createBuilder(harness, user1.token)
			.post(`/channels/${channel.id}/messages`)
			.body(payload)
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects forward without required fields', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);

		const guild = await createGuild(harness, user1.token, 'Test Guild');
		const invite = await createChannelInvite(harness, user1.token, guild.system_channel_id!);
		await acceptInvite(harness, user2.token, invite.code);

		const channel = await createDMChannel(harness, user1.token, user2.userId);
		const originalMessage = await sendMessage(harness, user1.token, channel.id, 'Original message');

		const payload = {
			message_reference: {
				message_id: originalMessage.id,
				type: 1,
			},
		};

		await createBuilder(harness, user1.token)
			.post(`/channels/${channel.id}/messages`)
			.body(payload)
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
