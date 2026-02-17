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
	updateRole,
} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Role Permission Assignment Hierarchy', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('should prevent users from granting permissions they do not possess', async () => {
		const owner = await createTestAccount(harness);
		const manager = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Role Hierarchy Guild');

		const roleHigh = await createRole(harness, owner.token, guild.id, {
			name: 'High',
			permissions: String(1 << 28),
		});

		const roleMid = await createRole(harness, owner.token, guild.id, {
			name: 'Mid',
			permissions: String(1 << 11),
		});

		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);
		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);

		await acceptInvite(harness, manager.token, invite.code);

		await createBuilder(harness, owner.token)
			.put(`/guilds/${guild.id}/members/${manager.userId}/roles/${roleMid.id}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();

		await createBuilder(harness, manager.token)
			.patch(`/guilds/${guild.id}/roles/${roleHigh.id}`)
			.body({permissions: String(1 << 28)})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();

		await createBuilder(harness, manager.token)
			.patch(`/guilds/${guild.id}/roles/${roleMid.id}`)
			.body({permissions: String(1 << 28)})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();

		const updatedRole = await updateRole(harness, owner.token, guild.id, roleMid.id, {
			permissions: String((1 << 11) | (1 << 13)),
		});

		expect(updatedRole.permissions).toBe(String((1 << 11) | (1 << 13)));
	});
});
