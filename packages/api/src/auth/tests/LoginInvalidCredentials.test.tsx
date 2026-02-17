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

import {createAuthHarness, createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Auth login invalid credentials', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createAuthHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('wrong password returns bad request with field errors', async () => {
		const account = await createTestAccount(harness);

		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({
				email: account.email,
				password: 'WrongPassword123!',
			})
			.expect(400)
			.execute();
	});

	it('non-existent email returns bad request with field errors', async () => {
		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({
				email: 'nonexistent@example.com',
				password: 'SomePassword123!',
			})
			.expect(400)
			.execute();
	});

	it('invalid email format returns bad request', async () => {
		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({
				email: 'not-an-email',
				password: 'SomePassword123!',
			})
			.expect(400)
			.execute();
	});

	it('empty password returns bad request or unauthorized', async () => {
		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({
				email: 'test@example.com',
				password: '',
			})
			.expect(400)
			.execute();
	});

	it('empty email returns bad request or unauthorized', async () => {
		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({
				email: '',
				password: 'SomePassword123!',
			})
			.expect(400)
			.execute();
	});
});
