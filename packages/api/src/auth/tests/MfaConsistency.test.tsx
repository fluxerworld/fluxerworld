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
	createTestAccount,
	createTotpSecret,
	generateTotpCode,
	type TestAccount,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {
	createAuthenticationResponse,
	createRegistrationResponse,
	createWebAuthnDevice,
	type WebAuthnAuthenticationOptions,
	type WebAuthnDevice,
	type WebAuthnRegistrationOptions,
} from '@fluxer/api/src/auth/tests/WebAuthnTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import type {AuthSessionResponse} from '@fluxer/schema/src/domains/auth/AuthSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

interface BackupCodesResponse {
	backup_codes: Array<{code: string}>;
}

interface LoginMfaResponse {
	mfa: true;
	ticket: string;
	sms: boolean;
	totp: boolean;
	webauthn: boolean;
}

interface MfaMethodsResponse {
	totp: boolean;
	sms: boolean;
	webauthn: boolean;
	has_mfa: boolean;
}

async function loginWithTotp(harness: ApiTestHarness, account: TestAccount, secret: string): Promise<TestAccount> {
	const login = await createBuilderWithoutAuth<LoginMfaResponse>(harness)
		.post('/auth/login')
		.body({
			email: account.email,
			password: account.password,
		})
		.execute();
	expect(login.mfa).toBe(true);

	const mfaLogin = await createBuilderWithoutAuth<{token: string}>(harness)
		.post('/auth/login/mfa/totp')
		.body({
			code: generateTotpCode(secret),
			ticket: login.ticket,
		})
		.execute();
	return {...account, token: mfaLogin.token};
}

async function setupWebAuthnOnlyUser(
	harness: ApiTestHarness,
	account: TestAccount,
): Promise<{account: TestAccount; device: WebAuthnDevice}> {
	const device = createWebAuthnDevice();
	const secret = createTotpSecret();

	const backupCodes = await createBuilder<BackupCodesResponse>(harness, account.token)
		.post('/users/@me/mfa/totp/enable')
		.body({
			secret,
			code: generateTotpCode(secret),
			password: account.password,
		})
		.execute();

	const login = await createBuilderWithoutAuth<LoginMfaResponse>(harness)
		.post('/auth/login')
		.body({
			email: account.email,
			password: account.password,
		})
		.execute();
	expect(login.mfa).toBe(true);

	const mfaLogin = await createBuilderWithoutAuth<{token: string}>(harness)
		.post('/auth/login/mfa/totp')
		.body({
			code: backupCodes.backup_codes[0]!.code,
			ticket: login.ticket,
		})
		.execute();
	const updatedAccount = {...account, token: mfaLogin.token};

	const registrationOptions = await createBuilder<WebAuthnRegistrationOptions>(harness, updatedAccount.token)
		.post('/users/@me/mfa/webauthn/credentials/registration-options')
		.body({
			mfa_method: 'totp',
			mfa_code: backupCodes.backup_codes[1]!.code,
		})
		.execute();
	const registrationResponse = createRegistrationResponse(device, registrationOptions, 'Test Passkey');

	await createBuilder(harness, updatedAccount.token)
		.post('/users/@me/mfa/webauthn/credentials')
		.body({
			response: registrationResponse,
			challenge: registrationOptions.challenge,
			name: 'Test Passkey',
			mfa_method: 'totp',
			mfa_code: backupCodes.backup_codes[2]!.code,
		})
		.expect(204)
		.execute();

	await createBuilder(harness, updatedAccount.token)
		.post('/users/@me/mfa/totp/disable')
		.body({
			code: backupCodes.backup_codes[3]!.code,
			mfa_method: 'totp',
			mfa_code: backupCodes.backup_codes[4]!.code,
		})
		.expect(204)
		.execute();

	const discoverableOptions = await createBuilderWithoutAuth<WebAuthnAuthenticationOptions>(harness)
		.post('/auth/webauthn/authentication-options')
		.body(null)
		.execute();
	const discoverableAssertion = createAuthenticationResponse(device, discoverableOptions);

	const passkeyLogin = await createBuilderWithoutAuth<{token: string}>(harness)
		.post('/auth/webauthn/authenticate')
		.body({
			response: discoverableAssertion,
			challenge: discoverableOptions.challenge,
		})
		.execute();

	return {account: {...updatedAccount, token: passkeyLogin.token}, device};
}

describe('MFA Consistency Tests', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	describe('WebAuthn sudo verification flow', () => {
		test('WebAuthn user can complete sudo verification with passkey', async () => {
			const account = await createTestAccount(harness);
			const {account: webauthnAccount, device} = await setupWebAuthnOnlyUser(harness, account);

			const sudoOptions = await createBuilder<WebAuthnAuthenticationOptions>(harness, webauthnAccount.token)
				.post('/users/@me/sudo/webauthn/authentication-options')
				.body(null)
				.execute();

			const sudoAssertion = createAuthenticationResponse(device, sudoOptions);
			await createBuilder(harness, webauthnAccount.token)
				.post('/users/@me/disable')
				.body({
					mfa_method: 'webauthn',
					webauthn_response: sudoAssertion,
					webauthn_challenge: sudoOptions.challenge,
				})
				.expect(204)
				.execute();
		});

		test('WebAuthn-only user cannot use password for sudo verification', async () => {
			const account = await createTestAccount(harness);
			const {account: webauthnAccount} = await setupWebAuthnOnlyUser(harness, account);

			const errorResp = await createBuilder<{code: string}>(harness, webauthnAccount.token)
				.post('/users/@me/disable')
				.body({
					password: account.password,
				})
				.expect(403)
				.execute();

			expect(errorResp.code).toBe('SUDO_MODE_REQUIRED');
		});

		test('WebAuthn sudo verification returns proper MFA methods', async () => {
			const account = await createTestAccount(harness);
			const {account: webauthnAccount} = await setupWebAuthnOnlyUser(harness, account);

			const mfaMethods = await createBuilder<MfaMethodsResponse>(harness, webauthnAccount.token)
				.get('/users/@me/sudo/mfa-methods')
				.execute();

			expect(mfaMethods.has_mfa).toBe(true);
			expect(mfaMethods.webauthn).toBe(true);
			expect(mfaMethods.totp).toBe(false);
		});
	});

	describe('Password-only sudo flow for non-MFA users', () => {
		test('Non-MFA user can use password for sudo verification', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post('/users/@me/disable')
				.body({
					password: account.password,
				})
				.expect(204)
				.execute();
		});

		test('Non-MFA user cannot perform sudo operation without password', async () => {
			const account = await createTestAccount(harness);

			const errorResp = await createBuilder<{code: string}>(harness, account.token)
				.post('/users/@me/disable')
				.body({})
				.expect(403)
				.execute();

			expect(errorResp.code).toBe('SUDO_MODE_REQUIRED');
		});

		test('Non-MFA user rejected with wrong password', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post('/users/@me/disable')
				.body({
					password: 'wrong-password-123!',
				})
				.expect(400)
				.execute();
		});

		test('Non-MFA user MFA methods shows has_mfa as false', async () => {
			const account = await createTestAccount(harness);

			const mfaMethods = await createBuilder<MfaMethodsResponse>(harness, account.token)
				.get('/users/@me/sudo/mfa-methods')
				.execute();

			expect(mfaMethods.has_mfa).toBe(false);
			expect(mfaMethods.totp).toBe(false);
			expect(mfaMethods.sms).toBe(false);
			expect(mfaMethods.webauthn).toBe(false);
		});
	});

	describe('TOTP sudo verification flow', () => {
		test('TOTP user can complete sudo verification with TOTP code', async () => {
			const account = await createTestAccount(harness);
			const secret = createTotpSecret();

			await createBuilder(harness, account.token)
				.post('/users/@me/mfa/totp/enable')
				.body({
					secret,
					code: generateTotpCode(secret),
					password: account.password,
				})
				.execute();

			const loggedIn = await loginWithTotp(harness, account, secret);

			await createBuilder(harness, loggedIn.token)
				.post('/users/@me/disable')
				.body({
					mfa_method: 'totp',
					mfa_code: generateTotpCode(secret),
				})
				.expect(204)
				.execute();
		});

		test('TOTP user can use backup code for sudo verification', async () => {
			const account = await createTestAccount(harness);
			const secret = createTotpSecret();

			const backupCodes = await createBuilder<BackupCodesResponse>(harness, account.token)
				.post('/users/@me/mfa/totp/enable')
				.body({
					secret,
					code: generateTotpCode(secret),
					password: account.password,
				})
				.execute();

			const loggedIn = await loginWithTotp(harness, account, secret);

			await createBuilder(harness, loggedIn.token)
				.post('/users/@me/disable')
				.body({
					mfa_method: 'totp',
					mfa_code: backupCodes.backup_codes[0]!.code,
				})
				.expect(204)
				.execute();
		});

		test('TOTP user cannot use password for sudo verification', async () => {
			const account = await createTestAccount(harness);
			const secret = createTotpSecret();

			await createBuilder(harness, account.token)
				.post('/users/@me/mfa/totp/enable')
				.body({
					secret,
					code: generateTotpCode(secret),
					password: account.password,
				})
				.execute();

			const loggedIn = await loginWithTotp(harness, account, secret);

			await createBuilder(harness, loggedIn.token)
				.post('/users/@me/disable')
				.body({
					password: account.password,
				})
				.expect(403)
				.execute();
		});

		test('TOTP user rejected with wrong TOTP code', async () => {
			const account = await createTestAccount(harness);
			const secret = createTotpSecret();

			await createBuilder(harness, account.token)
				.post('/users/@me/mfa/totp/enable')
				.body({
					secret,
					code: generateTotpCode(secret),
					password: account.password,
				})
				.execute();

			const loggedIn = await loginWithTotp(harness, account, secret);

			await createBuilder(harness, loggedIn.token)
				.post('/users/@me/disable')
				.body({
					mfa_method: 'totp',
					mfa_code: '000000',
				})
				.expect(400)
				.execute();
		});

		test('TOTP user MFA methods shows totp as enabled', async () => {
			const account = await createTestAccount(harness);
			const secret = createTotpSecret();

			await createBuilder(harness, account.token)
				.post('/users/@me/mfa/totp/enable')
				.body({
					secret,
					code: generateTotpCode(secret),
					password: account.password,
				})
				.execute();

			const loggedIn = await loginWithTotp(harness, account, secret);

			const mfaMethods = await createBuilder<MfaMethodsResponse>(harness, loggedIn.token)
				.get('/users/@me/sudo/mfa-methods')
				.execute();

			expect(mfaMethods.has_mfa).toBe(true);
			expect(mfaMethods.totp).toBe(true);
		});
	});

	describe('MFA requirement propagates to sensitive operations', () => {
		test('Account disable requires sudo for all users', async () => {
			const account = await createTestAccount(harness);

			const errorResp = await createBuilder<{code: string}>(harness, account.token)
				.post('/users/@me/disable')
				.body({})
				.expect(403)
				.execute();

			expect(errorResp.code).toBe('SUDO_MODE_REQUIRED');
		});

		test('Account delete requires sudo for all users', async () => {
			const account = await createTestAccount(harness);

			const errorResp = await createBuilder<{code: string}>(harness, account.token)
				.post('/users/@me/delete')
				.body({})
				.expect(403)
				.execute();

			expect(errorResp.code).toBe('SUDO_MODE_REQUIRED');
		});

		test('Session logout requires sudo for non-MFA user', async () => {
			const account = await createTestAccount(harness);

			const sessions = await createBuilder<Array<AuthSessionResponse>>(harness, account.token)
				.get('/auth/sessions')
				.execute();

			await createBuilder(harness, account.token)
				.post('/auth/sessions/logout')
				.body({
					session_id_hashes: [sessions[0]!.id_hash],
				})
				.expect(403)
				.execute();

			await createBuilder(harness, account.token)
				.post('/auth/sessions/logout')
				.body({
					session_id_hashes: [sessions[0]!.id_hash],
					password: account.password,
				})
				.expect(204)
				.execute();
		});

		test('Session logout requires MFA for TOTP user', async () => {
			const account = await createTestAccount(harness);
			const secret = createTotpSecret();

			await createBuilder(harness, account.token)
				.post('/users/@me/mfa/totp/enable')
				.body({
					secret,
					code: generateTotpCode(secret),
					password: account.password,
				})
				.execute();

			const loggedIn = await loginWithTotp(harness, account, secret);

			const sessions = await createBuilder<Array<AuthSessionResponse>>(harness, loggedIn.token)
				.get('/auth/sessions')
				.execute();

			await createBuilder(harness, loggedIn.token)
				.post('/auth/sessions/logout')
				.body({
					session_id_hashes: [sessions[0]!.id_hash],
					password: account.password,
				})
				.expect(403)
				.execute();

			await createBuilder(harness, loggedIn.token)
				.post('/auth/sessions/logout')
				.body({
					session_id_hashes: [sessions[0]!.id_hash],
					mfa_method: 'totp',
					mfa_code: generateTotpCode(secret),
				})
				.expect(204)
				.execute();
		});

		test('TOTP disable requires MFA for sudo verification', async () => {
			const account = await createTestAccount(harness);
			const secret = createTotpSecret();

			const backupCodes = await createBuilder<BackupCodesResponse>(harness, account.token)
				.post('/users/@me/mfa/totp/enable')
				.body({
					secret,
					code: generateTotpCode(secret),
					password: account.password,
				})
				.execute();

			const loggedIn = await loginWithTotp(harness, account, secret);

			await createBuilder(harness, loggedIn.token)
				.post('/users/@me/mfa/totp/disable')
				.body({
					code: backupCodes.backup_codes[0]!.code,
				})
				.expect(403)
				.execute();

			await createBuilder(harness, loggedIn.token)
				.post('/users/@me/mfa/totp/disable')
				.body({
					code: backupCodes.backup_codes[0]!.code,
					mfa_method: 'totp',
					mfa_code: generateTotpCode(secret),
				})
				.expect(204)
				.execute();
		});

		test('MFA method consistency between login and sudo', async () => {
			const account = await createTestAccount(harness);
			const secret = createTotpSecret();

			await createBuilder(harness, account.token)
				.post('/users/@me/mfa/totp/enable')
				.body({
					secret,
					code: generateTotpCode(secret),
					password: account.password,
				})
				.execute();

			const login = await createBuilderWithoutAuth<LoginMfaResponse>(harness)
				.post('/auth/login')
				.body({
					email: account.email,
					password: account.password,
				})
				.execute();
			expect(login.mfa).toBe(true);
			expect(login.totp).toBe(true);

			const mfaLogin = await createBuilderWithoutAuth<{token: string}>(harness)
				.post('/auth/login/mfa/totp')
				.body({
					code: generateTotpCode(secret),
					ticket: login.ticket,
				})
				.execute();

			const mfaMethods = await createBuilder<MfaMethodsResponse>(harness, mfaLogin.token)
				.get('/users/@me/sudo/mfa-methods')
				.execute();

			expect(mfaMethods.totp).toBe(login.totp);
			expect(mfaMethods.has_mfa).toBe(true);
		});
	});
});
