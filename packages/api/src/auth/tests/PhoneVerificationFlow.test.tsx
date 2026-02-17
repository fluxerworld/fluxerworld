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
	totpCodeNow,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Phone verification flow', () => {
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

	it('completes full phone verification, attachment, and removal flow', async () => {
		const account = await createTestAccount(harness);

		const totpSecret = createTotpSecret();
		const totpCode = totpCodeNow(totpSecret);

		await createBuilder(harness, account.token)
			.post('/users/@me/mfa/totp/enable')
			.body({
				secret: totpSecret,
				code: totpCode,
				password: account.password,
			})
			.execute();

		const phone = `+1555${String(Date.now()).slice(-7)}`;

		await createBuilder(harness, account.token)
			.post('/users/@me/phone/send-verification')
			.body({
				phone,
			})
			.expect(204)
			.execute();

		const verifyPhoneJson = await createBuilder<{phone_token: string}>(harness, account.token)
			.post('/users/@me/phone/verify')
			.body({
				phone,
				code: '123456',
			})
			.execute();

		expect(verifyPhoneJson.phone_token).toBeDefined();
		expect(verifyPhoneJson.phone_token.length).toBeGreaterThan(0);
		const phoneToken = verifyPhoneJson.phone_token;

		const totpCode2 = totpCodeNow(totpSecret);

		await createBuilder(harness, account.token)
			.post('/users/@me/phone')
			.body({
				phone_token: phoneToken,
				mfa_method: 'totp',
				mfa_code: totpCode2,
			})
			.expect(204)
			.execute();

		const meJson = await createBuilder<{phone: string | null}>(harness, account.token).get('/users/@me').execute();

		expect(meJson.phone).toBe(phone);

		const totpCode3 = totpCodeNow(totpSecret);

		await createBuilder(harness, account.token)
			.delete('/users/@me/phone')
			.body({
				mfa_method: 'totp',
				mfa_code: totpCode3,
			})
			.expect(204)
			.execute();

		const meAfterRemovalJson = await createBuilder<{phone: string | null}>(harness, account.token)
			.get('/users/@me')
			.execute();

		expect(meAfterRemovalJson.phone).toBeNull();
	});
});
