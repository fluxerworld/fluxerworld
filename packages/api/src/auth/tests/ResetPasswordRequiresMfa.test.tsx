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
	createTestAccount,
	findLastTestEmail,
	listTestEmails,
	type TestEmailRecord,
	totpCodeNow,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface MfaRequiredResponse {
	mfa: true;
	ticket: string;
	allowed_methods: Array<string>;
	sms_phone_hint: string | null;
	sms: boolean;
	totp: boolean;
	webauthn: boolean;
}

async function waitForEmail(harness: ApiTestHarness, type: string, recipient: string): Promise<TestEmailRecord> {
	const maxAttempts = 20;
	for (let i = 0; i < maxAttempts; i++) {
		await new Promise((resolve) => setTimeout(resolve, 100));
		const emails = await listTestEmails(harness, {recipient});
		const email = findLastTestEmail(emails, type);
		if (email) {
			return email;
		}
	}
	throw new Error(`Email not found: type=${type}, recipient=${recipient}`);
}

describe('Auth reset password requires MFA', () => {
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

	it('returns MFA ticket after password reset when MFA is enabled', async () => {
		const account = await createTestAccount(harness);
		await clearTestEmails(harness);

		const secret = 'JBSWY3DPEHPK3PXP';
		await createBuilder(harness, account.token)
			.post('/users/@me/mfa/totp/enable')
			.body({secret, code: totpCodeNow(secret), password: account.password})
			.execute();

		await createBuilderWithoutAuth(harness).post('/auth/forgot').body({email: account.email}).expect(204).execute();

		const email = await waitForEmail(harness, 'password_reset', account.email);
		const token = email.metadata['token'];
		expect(token).toBeDefined();

		const newPassword = 'new-strong-password-123';
		const resetResp = await createBuilderWithoutAuth<MfaRequiredResponse>(harness)
			.post('/auth/reset')
			.body({token, password: newPassword})
			.execute();
		expect(resetResp.mfa).toBe(true);
		expect(resetResp.ticket).toBeDefined();
		expect(resetResp.totp).toBe(true);
		expect(resetResp.sms).toBe(false);
		expect(resetResp.webauthn).toBe(false);
		expect(resetResp.allowed_methods).toEqual(['totp']);
		expect(resetResp.sms_phone_hint).toBeNull();

		const mfaResp = await createBuilderWithoutAuth<{token: string}>(harness)
			.post('/auth/login/mfa/totp')
			.body({
				ticket: resetResp.ticket,
				code: totpCodeNow(secret),
			})
			.execute();
		expect(mfaResp.token).toBeDefined();

		const login = await createBuilderWithoutAuth<MfaRequiredResponse>(harness)
			.post('/auth/login')
			.body({email: account.email, password: newPassword})
			.execute();
		expect(login.mfa).toBe(true);
		expect(login.ticket).toBeDefined();
		expect(login.totp).toBe(true);
		expect(login.sms).toBe(false);
		expect(login.webauthn).toBe(false);
	});
});
