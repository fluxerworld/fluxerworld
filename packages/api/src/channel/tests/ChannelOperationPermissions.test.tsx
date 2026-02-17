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
	deleteChannel,
	getChannel,
	updateChannel,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Channel Operation Permissions', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('should allow member to get channel', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Channel Perms Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);

		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);

		const channel = await getChannel(harness, member.token, systemChannel.id);

		expect(channel.id).toBe(systemChannel.id);
	});

	it('should reject nonmember from getting channel', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const nonmember = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Channel Perms Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);

		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);

		await createBuilder(harness, nonmember.token)
			.get(`/channels/${systemChannel.id}`)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	it('should reject member from updating channel without MANAGE_CHANNELS', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Channel Perms Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);

		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);

		await createBuilder(harness, member.token)
			.patch(`/channels/${systemChannel.id}`)
			.body({name: 'hacked'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	it('should reject member from deleting channel without MANAGE_CHANNELS', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Channel Perms Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);

		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);

		await createBuilder(harness, member.token)
			.delete(`/channels/${systemChannel.id}`)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	it('should allow owner to update channel', async () => {
		const owner = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Channel Perms Guild');

		const testChannel = await createChannel(harness, owner.token, guild.id, 'test-channel');

		const updated = await updateChannel(harness, owner.token, testChannel.id, {name: 'owner-updated'});

		expect(updated.name).toBe('owner-updated');
	});

	it('should allow owner to delete channel', async () => {
		const owner = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Channel Perms Guild');

		const testChannel = await createChannel(harness, owner.token, guild.id, 'test-channel');

		await deleteChannel(harness, owner.token, testChannel.id);

		await createBuilder(harness, owner.token)
			.get(`/channels/${testChannel.id}`)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});
});
