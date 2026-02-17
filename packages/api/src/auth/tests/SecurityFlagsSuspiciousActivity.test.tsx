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
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Auth security flags - suspicious activity flag blocks login required routes', () => {
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

	it('blocks access to login-required routes when suspicious activity flag is set', async () => {
		const account = await createTestAccount(harness);

		await createBuilderWithoutAuth(harness)
			.post(`/test/users/${account.userId}/security-flags`)
			.body({
				suspicious_activity_flag_names: ['REQUIRE_VERIFIED_EMAIL'],
			})
			.execute();

		await createBuilder(harness, account.token).get('/users/@me').expect(403).execute();
	});

	it('allows /auth/verify/resend even with suspicious activity flag', async () => {
		const account = await createTestAccount(harness);

		await createBuilderWithoutAuth(harness)
			.post(`/test/users/${account.userId}/security-flags`)
			.body({
				suspicious_activity_flag_names: ['REQUIRE_VERIFIED_EMAIL'],
			})
			.execute();

		await createBuilder(harness, account.token).post('/auth/verify/resend').body({}).expect(204).execute();
	});

	it('allows access after clearing suspicious activity flag', async () => {
		const account = await createTestAccount(harness);

		await createBuilderWithoutAuth(harness)
			.post(`/test/users/${account.userId}/security-flags`)
			.body({
				suspicious_activity_flag_names: ['REQUIRE_VERIFIED_EMAIL'],
			})
			.execute();

		await createBuilder(harness, account.token).get('/users/@me').expect(403).execute();

		await createBuilderWithoutAuth(harness)
			.post(`/test/users/${account.userId}/security-flags`)
			.body({
				suspicious_activity_flags: 0,
			})
			.execute();

		await createBuilder(harness, account.token).get('/users/@me').execute();
	});
});
