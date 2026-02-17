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

import {
	createAuthHarness,
	createUniqueEmail,
	createUniqueUsername,
	loginUser,
	registerUser,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

async function setUserSecurityFlags(harness: ApiTestHarness, userId: string, setFlags: Array<string>): Promise<void> {
	await createBuilderWithoutAuth(harness)
		.post(`/test/users/${userId}/security-flags`)
		.body({
			set_flags: setFlags,
		})
		.expect(200)
		.execute();
}

describe('Auth app store reviewer with other flags', () => {
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

	it('allows login with APP_STORE_REVIEWER flag combined with other flags', async () => {
		const email = createUniqueEmail('reviewer-multi-flag');
		const username = createUniqueUsername('reviewer');
		const password = 'a-strong-password';

		const reg = await registerUser(harness, {
			email,
			username,
			global_name: 'Multi Flag Reviewer',
			password,
			date_of_birth: '2000-01-01',
			consent: true,
		});

		await setUserSecurityFlags(harness, reg.user_id, ['APP_STORE_REVIEWER', 'STAFF']);

		const login = await loginUser(harness, {
			email,
			password,
		});

		expect('mfa' in login).toBe(false);
		if (!('mfa' in login)) {
			const nonMfaLogin = login as {user_id: string; token: string};
			expect(nonMfaLogin.token).toBeTruthy();
			expect(nonMfaLogin.user_id).toBe(reg.user_id);
		}
	});
});
