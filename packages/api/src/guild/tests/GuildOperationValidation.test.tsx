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
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS, TEST_IDS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Guild Operation Validation', () => {
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

	it('should reject getting nonexistent guild', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.get(`/guilds/${TEST_IDS.NONEXISTENT_GUILD}`)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('should reject updating nonexistent guild', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.patch(`/guilds/${TEST_IDS.NONEXISTENT_GUILD}`)
			.body({name: 'New Name'})
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('should reject leaving nonexistent guild', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.delete(`/users/@me/guilds/${TEST_IDS.NONEXISTENT_GUILD}`)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});
});
