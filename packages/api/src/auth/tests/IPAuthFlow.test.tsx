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
	clearTestEmails,
	createAuthHarness,
	createUniqueEmail,
	createUniqueUsername,
	findLastTestEmail,
	listTestEmails,
	registerUser,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Auth IP Authorization Flow', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createAuthHarness();
	});

	beforeEach(async () => {
		await harness.reset();
		await clearTestEmails(harness);
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('validates the complete IP authorization flow', async () => {
		const email = createUniqueEmail('ip-auth-flow');
		const password = 'a-strong-password';

		const reg = await registerUser(harness, {
			email,
			username: createUniqueUsername('ipflow'),
			global_name: 'IP Auth Flow User',
			password,
			date_of_birth: '2000-01-01',
			consent: true,
		});

		await clearTestEmails(harness);

		const newIP = '10.20.30.40';
		const ipAuthResp = await createBuilderWithoutAuth<{
			code?: string;
			ticket?: string;
			ip_authorization_required?: boolean;
			email?: string;
			resend_available_in?: number;
			message?: string;
		}>(harness)
			.post('/auth/login')
			.body({email, password})
			.header('x-forwarded-for', newIP)
			.expect(403)
			.execute();

		expect(ipAuthResp.ip_authorization_required).toBe(true);
		expect(ipAuthResp.ticket).toBeTruthy();
		expect(ipAuthResp.email).toBe(email);

		const emails = await listTestEmails(harness, {recipient: email});
		const ipAuthEmail = findLastTestEmail(emails, 'ip_authorization');
		expect(ipAuthEmail).not.toBeNull();

		const authToken = ipAuthEmail?.metadata['token'];
		expect(authToken).toBeTruthy();

		await createBuilderWithoutAuth(harness)
			.post('/auth/authorize-ip')
			.body({token: authToken})
			.header('x-forwarded-for', newIP)
			.expect(204)
			.execute();

		const loginResp = await createBuilderWithoutAuth<{
			token?: string;
			user_id?: string;
		}>(harness)
			.post('/auth/login')
			.body({email, password})
			.header('x-forwarded-for', newIP)
			.execute();

		expect(loginResp.token).toBeTruthy();
		expect(loginResp.user_id).toBe(reg.user_id);
	});

	it('validates that login from a known IP does not trigger IP authorization', async () => {
		const email = createUniqueEmail('ip-known');
		const password = 'a-strong-password';

		const reg = await registerUser(harness, {
			email,
			username: createUniqueUsername('ipknown'),
			global_name: 'IP Known User',
			password,
			date_of_birth: '2000-01-01',
			consent: true,
		});

		const loginResp = await createBuilderWithoutAuth<{
			token?: string;
			user_id?: string;
		}>(harness)
			.post('/auth/login')
			.body({email, password})
			.execute();

		expect(loginResp.token).toBeTruthy();
		expect(loginResp.user_id).toBe(reg.user_id);
	});
});
