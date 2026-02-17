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
	listTestEmails,
	registerUser,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Auth IP Authorization Multiple IPs', () => {
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

	it('validates that a user can authorize multiple different IPs independently', async () => {
		const email = createUniqueEmail('ip-multi');
		const password = 'a-strong-password';

		await registerUser(harness, {
			email,
			username: createUniqueUsername('multiip'),
			global_name: 'Multi IP User',
			password,
			date_of_birth: '2000-01-01',
			consent: true,
		});

		await clearTestEmails(harness);

		const firstNewIP = '10.11.12.13';

		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({email, password})
			.header('x-forwarded-for', firstNewIP)
			.expect(403)
			.execute();

		const emails1 = await listTestEmails(harness);
		const ipAuthEmail1 = emails1.find((e) => e.type === 'ip_authorization' && e.to === email);
		expect(ipAuthEmail1).toBeDefined();

		const token1 = ipAuthEmail1!.metadata['token'];
		expect(token1).toBeTruthy();

		await createBuilderWithoutAuth(harness)
			.post('/auth/authorize-ip')
			.body({token: token1})
			.header('x-forwarded-for', firstNewIP)
			.expect(204)
			.execute();

		await clearTestEmails(harness);

		const secondNewIP = '10.22.33.44';

		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({email, password})
			.header('x-forwarded-for', secondNewIP)
			.expect(403)
			.execute();

		const emails2 = await listTestEmails(harness);
		const ipAuthEmail2 = emails2.find((e) => e.type === 'ip_authorization' && e.to === email);
		expect(ipAuthEmail2).toBeDefined();

		const token2 = ipAuthEmail2!.metadata['token'];
		expect(token2).toBeTruthy();

		await createBuilderWithoutAuth(harness)
			.post('/auth/authorize-ip')
			.body({token: token2})
			.header('x-forwarded-for', secondNewIP)
			.expect(204)
			.execute();

		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({email, password})
			.header('x-forwarded-for', firstNewIP)
			.execute();

		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({email, password})
			.header('x-forwarded-for', secondNewIP)
			.execute();
	});
});
