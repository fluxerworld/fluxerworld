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
	createTestAccount,
	findLastTestEmail,
	listTestEmails,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, test} from 'vitest';

interface LoginResponse {
	user_id: string;
	token: string;
}

async function seedAuthorizedIp(params: {
	harness: ApiTestHarness;
	email: string;
	password: string;
	ip: string;
}): Promise<void> {
	const {harness, email, password, ip} = params;

	await createBuilderWithoutAuth(harness)
		.post('/auth/login')
		.body({email, password})
		.header('x-forwarded-for', ip)
		.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.IP_AUTHORIZATION_REQUIRED)
		.execute();

	const emails = await listTestEmails(harness, {recipient: email});
	const ipEmail = findLastTestEmail(emails, 'ip_authorization');
	if (!ipEmail?.metadata?.token) {
		throw new Error('Missing IP authorization email token');
	}

	await createBuilderWithoutAuth(harness)
		.post('/auth/authorize-ip')
		.body({token: ipEmail.metadata.token})
		.expect(HTTP_STATUS.NO_CONTENT)
		.execute();
}

describe('User authorised IPs', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
		await clearTestEmails(harness);
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	test('requires sudo to forget authorised IPs', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.delete('/users/@me/authorized-ips')
			.body({})
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.SUDO_MODE_REQUIRED)
			.execute();
	});

	test('forgetting authorised IPs forces email verification on next login', async () => {
		const account = await createTestAccount(harness);
		const ip = '203.0.113.42';

		await seedAuthorizedIp({
			harness,
			email: account.email,
			password: account.password,
			ip,
		});

		const login = await createBuilderWithoutAuth<LoginResponse>(harness)
			.post('/auth/login')
			.body({email: account.email, password: account.password})
			.header('x-forwarded-for', ip)
			.expect(HTTP_STATUS.OK)
			.execute();

		await createBuilder(harness, login.token)
			.delete('/users/@me/authorized-ips')
			.body({password: account.password})
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();

		await createBuilderWithoutAuth(harness)
			.post('/auth/login')
			.body({email: account.email, password: account.password})
			.header('x-forwarded-for', ip)
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.IP_AUTHORIZATION_REQUIRED)
			.execute();
	});
});
