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
import {createGuild} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Invite Validation', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('should reject getting nonexistent invite', async () => {
		await createBuilder(harness, '').get('/invites/nonexistent_code').expect(HTTP_STATUS.NOT_FOUND).execute();
	});

	it('should reject accepting nonexistent invite', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.post('/invites/nonexistent_code')
			.body(null)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('should reject deleting nonexistent invite', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.delete('/invites/nonexistent_code')
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('should reject invalid max_uses value when creating invite', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Invite Validation Guild');

		await createBuilder(harness, account.token)
			.post(`/channels/${guild.system_channel_id}/invites`)
			.body({max_uses: -1})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('should reject invalid max_age value when creating invite', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Invite Validation Guild');

		await createBuilder(harness, account.token)
			.post(`/channels/${guild.system_channel_id}/invites`)
			.body({max_age: -1})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('should accept valid max_uses and max_age values', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Invite Validation Guild');

		await createBuilder(harness, account.token)
			.post(`/channels/${guild.system_channel_id}/invites`)
			.body({max_uses: 10, max_age: 3600})
			.expect(HTTP_STATUS.OK)
			.execute();
	});
});
