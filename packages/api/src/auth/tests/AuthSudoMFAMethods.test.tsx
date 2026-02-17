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

import {randomBytes} from 'node:crypto';
import {createAuthHarness, createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {TotpGenerator} from '@fluxer/api/src/utils/TotpGenerator';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface MfaMethodsResponse {
	totp: boolean;
	sms: boolean;
	webauthn: boolean;
	has_mfa: boolean;
}

interface BackupCodesResponse {
	backup_codes: Array<{code: string; consumed: boolean}>;
}

function generateTotpSecret(): string {
	const buffer = randomBytes(20);
	const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
	let result = '';
	for (let i = 0; i < buffer.length; i += 5) {
		const bytes = [buffer[i]!, buffer[i + 1]!, buffer[i + 2]!, buffer[i + 3]!, buffer[i + 4]!];
		const n = (bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!;

		const indices = [
			(n >> 3) & 0x1f,
			((n >> 11) | ((bytes[4]! << 4) & 0xf)) & 0x1f,
			((n >> 19) | ((bytes[4]! << 2) & 0x3c)) & 0x1f,
			(bytes[4]! >> 1) & 0x1f,
		];

		result += base32Chars[indices[0]!];
		result += base32Chars[indices[1]!];
		result += base32Chars[indices[2]!];
		result += base32Chars[indices[3]!];
	}
	return result;
}

async function generateTotpCode(secret: string): Promise<string> {
	const totp = new TotpGenerator(secret);
	const codes = await totp.generateTotp();
	return codes[0]!;
}

describe('Auth sudo MFA methods', () => {
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

	it('returns all MFA methods as false for user without MFA', async () => {
		const account = await createTestAccount(harness);

		const payload = await createBuilder<MfaMethodsResponse>(harness, account.token)
			.get('/users/@me/sudo/mfa-methods')
			.execute();

		expect(payload.has_mfa).toBe(false);
		expect(payload.totp).toBe(false);
		expect(payload.sms).toBe(false);
		expect(payload.webauthn).toBe(false);
	});

	it('returns TOTP as enabled after user enables TOTP', async () => {
		const account = await createTestAccount(harness);

		const secret = generateTotpSecret();
		const code = await generateTotpCode(secret);

		const enableResp = await createBuilder<BackupCodesResponse>(harness, account.token)
			.post('/users/@me/mfa/totp/enable')
			.body({
				secret,
				code,
				password: account.password,
			})
			.execute();

		expect(enableResp.backup_codes.length).toBeGreaterThan(0);

		const loginResp = await createBuilderWithoutAuth<{
			mfa: true;
			ticket: string;
			allowed_methods: Array<string>;
			sms_phone_hint: string | null;
		}>(harness)
			.post('/auth/login')
			.body({
				email: account.email,
				password: account.password,
			})
			.execute();

		expect(loginResp.mfa).toBe(true);
		expect(loginResp.allowed_methods).toContain('totp');

		const mfaLoginResp = await createBuilderWithoutAuth<{token: string}>(harness)
			.post('/auth/login/mfa/totp')
			.body({
				ticket: loginResp.ticket,
				code: await generateTotpCode(secret),
			})
			.execute();

		account.token = mfaLoginResp.token;

		const payload = await createBuilder<MfaMethodsResponse>(harness, account.token)
			.get('/users/@me/sudo/mfa-methods')
			.execute();

		expect(payload.has_mfa).toBe(true);
		expect(payload.totp).toBe(true);
		expect(payload.sms).toBe(false);
		expect(payload.webauthn).toBe(false);
	});
});
