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
	createTestAccount,
	createTotpSecret,
	type PhoneVerifyResponse,
	type TestAccount,
	totpCodeNow,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

async function attachPhone(harness: ApiTestHarness, account: TestAccount, secret: string): Promise<void> {
	const phone = `+1555${String(Date.now() % 10000000).padStart(7, '0')}`;

	await createBuilder(harness, account.token)
		.post('/users/@me/phone/send-verification')
		.body({phone})
		.expect(204)
		.execute();

	const phoneVerify = await createBuilder<PhoneVerifyResponse>(harness, account.token)
		.post('/users/@me/phone/verify')
		.body({phone, code: '123456'})
		.execute();
	expect(phoneVerify.phone_token).toBeDefined();

	await createBuilder(harness, account.token)
		.post('/users/@me/phone')
		.body({
			phone_token: phoneVerify.phone_token,
			mfa_method: 'totp',
			mfa_code: totpCodeNow(secret),
		})
		.expect(204)
		.execute();
}

describe('Auth MFA SMS enable/disable', () => {
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

	it('enables and disables SMS MFA', async () => {
		const account = await createTestAccount(harness);
		const secret = createTotpSecret();

		await createBuilder(harness, account.token)
			.post('/users/@me/mfa/totp/enable')
			.body({secret, code: totpCodeNow(secret), password: account.password})
			.execute();

		await attachPhone(harness, account, secret);

		await createBuilder(harness, account.token)
			.post('/users/@me/mfa/sms/enable')
			.body({
				mfa_method: 'totp',
				mfa_code: totpCodeNow(secret),
			})
			.expect(204)
			.execute();

		const login = await createBuilderWithoutAuth<{mfa: boolean; sms: boolean; ticket: string}>(harness)
			.post('/auth/login')
			.body({email: account.email, password: account.password})
			.execute();
		expect(login.mfa).toBe(true);
		expect(login.sms).toBe(true);
		expect(login.ticket).toBeDefined();

		const mfaResp = await createBuilderWithoutAuth<{token: string}>(harness)
			.post('/auth/login/mfa/totp')
			.body({
				code: totpCodeNow(secret),
				ticket: login.ticket,
			})
			.execute();
		account.token = mfaResp.token;

		await createBuilder(harness, account.token)
			.post('/users/@me/mfa/sms/disable')
			.body({
				mfa_method: 'totp',
				mfa_code: totpCodeNow(secret),
			})
			.expect(204)
			.execute();

		const afterLogin = await createBuilderWithoutAuth<{sms: boolean; totp: boolean; mfa: boolean}>(harness)
			.post('/auth/login')
			.body({email: account.email, password: account.password})
			.execute();
		expect(afterLogin.sms).toBe(false);
		expect(afterLogin.totp).toBe(true);
		expect(afterLogin.mfa).toBe(true);
	});
});
