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
import {createGuild, deleteInvite, getChannel} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {GuildInviteMetadataResponse} from '@fluxer/schema/src/domains/invite/InviteSchemas';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Invite Validation', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('should reject getting nonexistent invite', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token).get('/invites/invalidcode123').expect(HTTP_STATUS.NOT_FOUND).execute();
	});

	it('should reject accepting nonexistent invite', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.post('/invites/invalidcode123')
			.body(null)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('should reject deleting nonexistent invite', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.delete('/invites/invalidcode123')
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('should reject invalid max_uses value', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Invite Validation Guild');
		const channel = await getChannel(harness, account.token, guild.system_channel_id!);

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/invites`)
			.body({max_uses: -1})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('should reject invalid max_age value', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Invite Validation Guild');
		const channel = await getChannel(harness, account.token, guild.system_channel_id!);

		await createBuilder(harness, account.token)
			.post(`/channels/${channel.id}/invites`)
			.body({max_age: -1})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('should accept valid max_uses and max_age', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Invite Validation Guild');
		const channel = await getChannel(harness, account.token, guild.system_channel_id!);

		const invite = await createBuilder<GuildInviteMetadataResponse>(harness, account.token)
			.post(`/channels/${channel.id}/invites`)
			.body({max_uses: 5, max_age: 3600})
			.execute();

		expect(invite.code).toBeTruthy();

		await deleteInvite(harness, account.token, invite.code);
	});
});
