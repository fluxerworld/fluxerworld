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

import {createAuthHarness, createTestAccount, loginUser} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Auth login with invalid invite code', () => {
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

	it('login with invalid invite code succeeds but does not add guilds', async () => {
		const member = await createTestAccount(harness);

		const login = await loginUser(harness, {
			email: member.email,
			password: member.password,
			invite_code: 'invalidcode123',
		});

		expect('mfa' in login).toBe(false);
		if (!('mfa' in login)) {
			const nonMfaLogin = login as {user_id: string; token: string};
			expect(nonMfaLogin.token).toBeTruthy();
		}

		if (!('mfa' in login)) {
			const nonMfaLogin = login as {user_id: string; token: string};
			const guilds = await createBuilder<Array<GuildResponse>>(harness, nonMfaLogin.token)
				.get('/users/@me/guilds')
				.execute();

			expect(guilds.length).toBe(0);
		}
	});
});
