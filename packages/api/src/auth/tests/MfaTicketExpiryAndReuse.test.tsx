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
	seedMfaTicket,
	totpCodeNow,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS, TEST_LIMITS, TEST_TIMEOUTS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';

describe('Auth MFA ticket expiry and reuse', () => {
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

	afterEach(() => {
		vi.useRealTimers();
	});

	it('rejects expired tickets and prevents ticket reuse', async () => {
		vi.useFakeTimers();
		const account = await createTestAccount(harness);
		const secret = createTotpSecret();

		await createBuilder(harness, account.token)
			.post('/users/@me/mfa/totp/enable')
			.body({
				secret,
				code: totpCodeNow(secret),
				password: account.password,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const expiredTicket = `expired-${Date.now()}`;
		await seedMfaTicket(harness, expiredTicket, account.userId, TEST_LIMITS.MFA_TICKET_SHORT_TTL);
		vi.advanceTimersByTime(TEST_TIMEOUTS.TICKET_EXPIRY_GRACE);

		const expiredJson = await createBuilderWithoutAuth<{
			code: string;
			errors?: {code?: {errors?: Array<{message: string}>}};
		}>(harness)
			.post('/auth/login/mfa/totp')
			.body({
				ticket: expiredTicket,
				code: totpCodeNow(secret),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		expect(expiredJson.code).toBe('INVALID_FORM_BODY');

		const validTicket = `valid-${Date.now()}`;
		await seedMfaTicket(harness, validTicket, account.userId, TEST_LIMITS.MFA_TICKET_LONG_TTL);

		await createBuilderWithoutAuth(harness)
			.post('/auth/login/mfa/totp')
			.body({
				ticket: validTicket,
				code: totpCodeNow(secret),
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const reuseJson = await createBuilderWithoutAuth<{
			code: string;
			errors?: {code?: {errors?: Array<{message: string}>}};
		}>(harness)
			.post('/auth/login/mfa/totp')
			.body({
				ticket: validTicket,
				code: totpCodeNow(secret),
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();

		expect(reuseJson.code).toBe('INVALID_FORM_BODY');
	});
});
