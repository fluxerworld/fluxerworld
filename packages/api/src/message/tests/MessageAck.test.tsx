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
	acceptInvite,
	ackMessage,
	createChannelInvite,
	createGuild,
	sendMessage,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, test} from 'vitest';

describe('Message Ack', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('should acknowledge message in guild channel', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'Test message');
		await ackMessage(harness, account.token, channelId, message.id);
	});

	test('should acknowledge message with mention count', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'Test message');
		await ackMessage(harness, account.token, channelId, message.id, 5);
	});

	test('should track read state after ack', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const message1 = await sendMessage(harness, owner.token, channelId, 'Message 1');
		const message2 = await sendMessage(harness, owner.token, channelId, 'Message 2');

		await ackMessage(harness, member.token, channelId, message1.id);
		await ackMessage(harness, member.token, channelId, message2.id);
	});

	test('should allow re-acking the same message', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'Test message');

		await ackMessage(harness, account.token, channelId, message.id, 3);
		await ackMessage(harness, account.token, channelId, message.id, 0);
	});

	test('should accept ack for nonexistent message (fire and forget)', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		await createBuilder(harness, account.token)
			.post(`/channels/${channelId}/messages/999999999999999999/ack`)
			.body({mention_count: 0})
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
	});

	test('should reject ack without authentication', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'Test');

		await createBuilderWithoutAuth(harness)
			.post(`/channels/${channelId}/messages/${message.id}/ack`)
			.body({mention_count: 0})
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();
	});

	test('should reject ack for channel user cannot access', async () => {
		const owner = await createTestAccount(harness);
		const nonMember = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, owner.token, channelId, 'Test');

		await createBuilder(harness, nonMember.token)
			.post(`/channels/${channelId}/messages/${message.id}/ack`)
			.body({mention_count: 0})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should ack all messages up to specified message', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		await sendMessage(harness, owner.token, channelId, 'Message 1');
		await sendMessage(harness, owner.token, channelId, 'Message 2');
		const message3 = await sendMessage(harness, owner.token, channelId, 'Message 3');

		await ackMessage(harness, member.token, channelId, message3.id);
	});

	test('should handle negative mention count gracefully', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'Test message');

		await createBuilder(harness, account.token)
			.post(`/channels/${channelId}/messages/${message.id}/ack`)
			.body({mention_count: -1})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should accept bulk ack with multiple channel entries', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, account.token, channelId, 'Test message');

		await createBuilder(harness, account.token)
			.post('/read-states/ack-bulk')
			.body({
				read_states: [
					{
						channel_id: channelId,
						message_id: message.id,
					},
				],
			})
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
	});

	test('should ack message in DM channel', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await createBuilder<unknown>(harness, user1.token)
			.post(`/users/@me/relationships/${user2.userId}`)
			.body(null)
			.execute();

		await createBuilder<unknown>(harness, user2.token)
			.put(`/users/@me/relationships/${user1.userId}`)
			.body({})
			.execute();

		const dmChannel = await createBuilder<{id: string}>(harness, user1.token)
			.post('/users/@me/channels')
			.body({recipient_id: user2.userId})
			.execute();

		const message = await sendMessage(harness, user1.token, dmChannel.id, 'DM message');
		await ackMessage(harness, user2.token, dmChannel.id, message.id);
	});
});
