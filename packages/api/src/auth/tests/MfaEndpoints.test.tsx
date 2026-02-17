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
	type BackupCodesResponse,
	createAuthHarness,
	createTestAccount,
	createTotpSecret,
	type PhoneVerifyResponse,
	totpCodeNext,
	totpCodeNow,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Auth MFA endpoints', () => {
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

	it('handles TOTP enable, backup codes, login, and disable', async () => {
		const account = await createTestAccount(harness);
		const secret = createTotpSecret();

		const enableData = await createBuilder<BackupCodesResponse>(harness, account.token)
			.post('/users/@me/mfa/totp/enable')
			.body({secret, code: totpCodeNow(secret), password: account.password})
			.execute();
		expect(enableData.backup_codes.length).toBeGreaterThan(0);

		const fetched = await createBuilder<BackupCodesResponse>(harness, account.token)
			.post('/users/@me/mfa/backup-codes')
			.body({
				mfa_method: 'totp',
				mfa_code: totpCodeNow(secret),
				regenerate: false,
			})
			.execute();
		expect(fetched.backup_codes.length).toBe(enableData.backup_codes.length);

		const login = await createBuilderWithoutAuth<{mfa: boolean; ticket: string; totp: boolean}>(harness)
			.post('/auth/login')
			.body({email: account.email, password: account.password})
			.execute();
		expect(login.mfa).toBe(true);
		expect(login.ticket).toBeDefined();
		expect(login.totp).toBe(true);

		const backupResp = await createBuilderWithoutAuth<{token: string}>(harness)
			.post('/auth/login/mfa/totp')
			.body({
				code: enableData.backup_codes[0]!.code,
				ticket: login.ticket,
			})
			.execute();
		expect(backupResp.token).toBeDefined();
		account.token = backupResp.token;

		const regenerated = await createBuilder<BackupCodesResponse>(harness, account.token)
			.post('/users/@me/mfa/backup-codes')
			.body({
				mfa_method: 'totp',
				mfa_code: totpCodeNow(secret),
				regenerate: true,
			})
			.execute();
		expect(regenerated.backup_codes.length).toBeGreaterThan(0);

		await createBuilder(harness, account.token)
			.post('/users/@me/mfa/totp/disable')
			.body({
				code: regenerated.backup_codes[0]!.code,
				mfa_method: 'totp',
				mfa_code: totpCodeNow(secret),
			})
			.expect(204)
			.execute();
	});

	it('handles SMS MFA enable, login, and disable', async () => {
		const account = await createTestAccount(harness);
		const secret = createTotpSecret();

		await createBuilder(harness, account.token)
			.post('/users/@me/mfa/totp/enable')
			.body({secret, code: totpCodeNow(secret), password: account.password})
			.execute();

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

		await createBuilderWithoutAuth(harness)
			.post('/auth/login/mfa/sms/send')
			.body({ticket: login.ticket})
			.expect(204)
			.execute();

		const smsResp = await createBuilderWithoutAuth<{token: string}>(harness)
			.post('/auth/login/mfa/sms')
			.body({ticket: login.ticket, code: '123456'})
			.execute();
		account.token = smsResp.token;

		await createBuilder(harness, account.token)
			.post('/users/@me/mfa/sms/disable')
			.body({
				mfa_method: 'totp',
				mfa_code: totpCodeNow(secret),
			})
			.expect(204)
			.execute();

		await createBuilder(harness, account.token)
			.delete('/users/@me/phone')
			.body({
				mfa_method: 'totp',
				mfa_code: totpCodeNext(secret),
			})
			.expect(204)
			.execute();
	});
});
