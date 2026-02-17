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
	addMemberRole,
	createChannelInvite,
	createGuild,
	createRole,
	getChannel,
	leaveGuild,
} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {GuildNSFWLevel} from '@fluxer/constants/src/GuildConstants';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Guild Operation Permissions', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('should reject member from updating guild without MANAGE_GUILD', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Perms Test Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);

		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);

		await createBuilder(harness, member.token)
			.patch(`/guilds/${guild.id}`)
			.body({name: 'Hacked Guild'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	it('should reject nonmember from getting guild', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const nonmember = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Perms Test Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);

		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);

		await createBuilder(harness, nonmember.token).get(`/guilds/${guild.id}`).expect(HTTP_STATUS.FORBIDDEN).execute();
	});

	it('should allow member to leave guild', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Perms Test Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);

		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);

		await leaveGuild(harness, member.token, guild.id);

		await createBuilder(harness, member.token).get(`/guilds/${guild.id}`).expect(HTTP_STATUS.FORBIDDEN).execute();
	});

	it('should reject owner from leaving guild without deleting', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Perms Test Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);

		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);

		await createBuilder(harness, owner.token)
			.delete(`/users/@me/guilds/${guild.id}`)
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('should allow member with MANAGE_GUILD to update guild nsfw_level', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'NSFW Perms Test Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);

		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, member.token, invite.code);

		const manageGuildRole = await createRole(harness, owner.token, guild.id, {
			name: 'Manage Guild',
			permissions: Permissions.MANAGE_GUILD.toString(),
		});

		await addMemberRole(harness, owner.token, guild.id, member.userId, manageGuildRole.id);

		const updated = await createBuilder<GuildResponse>(harness, member.token)
			.patch(`/guilds/${guild.id}`)
			.body({nsfw_level: GuildNSFWLevel.AGE_RESTRICTED})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(updated.nsfw_level).toBe(GuildNSFWLevel.AGE_RESTRICTED);
	});
});
