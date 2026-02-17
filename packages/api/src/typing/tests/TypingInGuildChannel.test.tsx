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
	createChannel,
	createChannelInvite,
	createGuild,
	setupTestGuildWithMembers,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {sendTypingIndicator} from '@fluxer/api/src/typing/tests/TypingTestUtils';
import {afterEach, beforeEach, describe, test} from 'vitest';

describe('Typing in guild channel', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('owner can send typing indicator in guild channel', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Typing Test Guild');
		const channelId = guild.system_channel_id!;

		await sendTypingIndicator(harness, account.token, channelId);
	});

	test('member can send typing indicator in guild channel', async () => {
		const {members, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0]!;

		await sendTypingIndicator(harness, member.token, systemChannel.id);
	});

	test('owner can send typing indicator in created channel', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Channel Typing Test');

		const channel = await createChannel(harness, account.token, guild.id, 'typing-test');

		await sendTypingIndicator(harness, account.token, channel.id);
	});

	test('member can send typing indicator in created channel', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Channel Member Typing Test');
		const channel = await createChannel(harness, owner.token, guild.id, 'test-channel');

		const invite = await createChannelInvite(harness, owner.token, channel.id);
		await acceptInvite(harness, member.token, invite.code);

		await sendTypingIndicator(harness, member.token, channel.id);
	});

	test('rejects typing indicator from non-member in guild channel', async () => {
		const account = await createTestAccount(harness);
		const nonMember = await createTestAccount(harness);

		const guild = await createGuild(harness, account.token, 'Typing Non-Member Test');
		const channelId = guild.system_channel_id!;

		await createBuilder(harness, nonMember.token)
			.post(`/channels/${channelId}/typing`)
			.body({})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('rejects typing indicator for unknown channel', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.post('/channels/999999999999999999/typing')
			.body({})
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	test('rejects typing indicator without authorization', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'No Auth Test');
		const channelId = guild.system_channel_id!;

		await createBuilderWithoutAuth(harness)
			.post(`/channels/${channelId}/typing`)
			.body({})
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();
	});
});
