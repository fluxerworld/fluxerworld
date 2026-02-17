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
	createChannelInvite,
	createGuild,
	createRole,
	getChannel,
	getMember,
	updateMember,
	updateRole,
	updateRolePositions,
} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Role Hierarchy Enforcement', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('should allow moderator to modify lower role but not equal/higher roles', async () => {
		const owner = await createTestAccount(harness);
		const moderator = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Role Hierarchy Guild');

		const modRole = await createRole(harness, owner.token, guild.id, {
			name: 'Moderator',
			color: 65280,
			permissions: '268435456',
			hoist: true,
		});

		const memberRole = await createRole(harness, owner.token, guild.id, {
			name: 'Member',
			color: 16711680,
			permissions: '0',
			hoist: false,
		});

		await updateRolePositions(harness, owner.token, guild.id, [
			{id: modRole.id, position: 2},
			{id: memberRole.id, position: 1},
		]);

		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);
		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);

		await acceptInvite(harness, moderator.token, invite.code);
		await acceptInvite(harness, member.token, invite.code);

		await updateMember(harness, owner.token, guild.id, moderator.userId, {
			roles: [modRole.id],
		});

		await updateMember(harness, owner.token, guild.id, member.userId, {
			roles: [memberRole.id],
		});

		const updatedMemberRole = await updateRole(harness, moderator.token, guild.id, memberRole.id, {
			color: 255,
		});

		expect(updatedMemberRole.color).toBe(255);

		await createBuilder(harness, moderator.token)
			.patch(`/guilds/${guild.id}/roles/${modRole.id}`)
			.body({permissions: '8'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	it('should prevent member from assigning higher role to themselves via @me endpoint', async () => {
		const owner = await createTestAccount(harness);
		const moderator = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Role Hierarchy Guild');

		const modRole = await createRole(harness, owner.token, guild.id, {
			name: 'Moderator',
			color: 65280,
			permissions: '268435456',
			hoist: true,
		});

		const memberRole = await createRole(harness, owner.token, guild.id, {
			name: 'Member',
			color: 16711680,
			permissions: '0',
			hoist: false,
		});

		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);
		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);

		await acceptInvite(harness, moderator.token, invite.code);
		await acceptInvite(harness, member.token, invite.code);

		await updateMember(harness, owner.token, guild.id, moderator.userId, {
			roles: [modRole.id],
		});

		await updateMember(harness, owner.token, guild.id, member.userId, {
			roles: [memberRole.id],
		});

		await createBuilder(harness, member.token)
			.patch(`/guilds/${guild.id}/members/@me`)
			.body({roles: [modRole.id]})
			.expect(HTTP_STATUS.OK)
			.execute();

		const fetchedMember = await getMember(harness, owner.token, guild.id, member.userId);
		expect(fetchedMember.roles).not.toContain(modRole.id);
		expect(fetchedMember.roles).toContain(memberRole.id);
	});
});
