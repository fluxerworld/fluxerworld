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

import {createAuthHarness, createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {
	createRegistrationResponse,
	createTotpSecret,
	createWebAuthnDevice,
	generateTotpCode,
	type WebAuthnCredentialMetadata,
	type WebAuthnRegistrationOptions,
} from '@fluxer/api/src/auth/tests/WebAuthnTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('WebAuthn credential registration', () => {
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

	it('validates the WebAuthn credential registration flow', async () => {
		const account = await createTestAccount(harness);
		const device = createWebAuthnDevice();
		const secret = createTotpSecret();

		await createBuilder(harness, account.token)
			.post('/users/@me/mfa/totp/enable')
			.body({secret, code: generateTotpCode(secret), password: account.password})
			.execute();

		const regOptions = await createBuilder<WebAuthnRegistrationOptions>(harness, account.token)
			.post('/users/@me/mfa/webauthn/credentials/registration-options')
			.body({mfa_method: 'totp', mfa_code: generateTotpCode(secret)})
			.execute();

		expect(regOptions.challenge).toBeTruthy();
		expect(regOptions.rp.id).toBeTruthy();
		expect(regOptions.user.id).toBeTruthy();

		if (regOptions.rp.id) {
			device.rpId = regOptions.rp.id;
		}

		const registrationResponse = createRegistrationResponse(device, regOptions, 'Test Passkey');

		await createBuilder(harness, account.token)
			.post('/users/@me/mfa/webauthn/credentials')
			.body({
				response: registrationResponse,
				challenge: regOptions.challenge,
				name: 'Test Passkey',
				mfa_method: 'totp',
				mfa_code: generateTotpCode(secret),
			})
			.expect(204)
			.execute();

		const credentials = await createBuilder<Array<WebAuthnCredentialMetadata>>(harness, account.token)
			.get('/users/@me/mfa/webauthn/credentials')
			.execute();

		expect(credentials).toHaveLength(1);
		expect(credentials[0].name).toBe('Test Passkey');
		expect(credentials[0].id).toBe(device.credentialId.toString('base64url'));
	});
});
