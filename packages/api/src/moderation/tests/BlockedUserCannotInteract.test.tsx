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
import {blockUser} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Blocked user cannot interact', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('prevents blocked users from sending friend requests', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await blockUser(harness, user1, user2.userId);

		await createBuilder(harness, user2.token)
			.post(`/users/@me/relationships/${user1.userId}`)
			.body(null)
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('prevents creating DM channels with blocked users', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await blockUser(harness, user1, user2.userId);

		await createBuilder(harness, user2.token)
			.post('/users/@me/channels')
			.body({recipients: [user1.userId]})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
