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
	disableSso,
	enableSso,
	setUserACLs,
	type TestAccount,
} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface SsoStartResponse {
	authorization_url: string;
	state: string;
	redirect_uri: string;
}

interface SsoCompleteResponse {
	token: string;
	user_id: string;
	redirect_to: string;
}

interface SsoStatusResponse {
	enabled: boolean;
	display_name?: string;
}

describe('Auth SSO flow', () => {
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

	describe('local auth blocking', () => {
		let admin: TestAccount;

		beforeEach(async () => {
			admin = await createTestAccount(harness);
			admin = await setUserACLs(harness, admin, [
				'admin:authenticate',
				'instance:config:update',
				'instance:config:view',
			]);
			await enableSso(harness, admin.token);
		});

		afterEach(async () => {
			await disableSso(harness, admin.token);
		});

		it('blocks local auth when SSO is enforced', async () => {
			await createBuilderWithoutAuth(harness)
				.post('/auth/login')
				.body({
					email: 'someone@example.com',
					password: 'password123',
				})
				.expect(403)
				.execute();
		});
	});

	describe('complete SSO flow', () => {
		let admin: TestAccount;

		beforeEach(async () => {
			admin = await createTestAccount(harness);
			admin = await setUserACLs(harness, admin, [
				'admin:authenticate',
				'instance:config:update',
				'instance:config:view',
			]);
			await enableSso(harness, admin.token);
		});

		afterEach(async () => {
			await disableSso(harness, admin.token);
		});

		it('creates session through full SSO flow', async () => {
			const startData = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({redirect_to: '/me'})
				.execute();

			expect(startData.state).toBeTruthy();
			expect(startData.authorization_url).toBeTruthy();

			const authUrlString = startData.authorization_url;
			expect(authUrlString).toContain(`state=${startData.state}`);
			expect(authUrlString).toContain('code_challenge_method=S256');
			expect(authUrlString).toContain('code_challenge=');
			expect(authUrlString).toContain('nonce=');

			if (authUrlString.startsWith('http://') || authUrlString.startsWith('https://')) {
				const authUrl = new URL(authUrlString);
				const stateParam = authUrl.searchParams.get('state');
				expect(stateParam).toBe(startData.state);

				const codeChallengeMethod = authUrl.searchParams.get('code_challenge_method');
				expect(codeChallengeMethod).toBe('S256');

				const codeChallenge = authUrl.searchParams.get('code_challenge');
				expect(codeChallenge).toBeTruthy();

				const nonce = authUrl.searchParams.get('nonce');
				expect(nonce).toBeTruthy();
			}

			const email = `sso-user-${Date.now()}@example.com`;
			const completeData = await createBuilderWithoutAuth<SsoCompleteResponse>(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
					state: startData.state,
				})
				.execute();

			expect(completeData.token).toBeTruthy();
			expect(completeData.user_id).toBeTruthy();

			const meData = await createBuilder<{email: string | null}>(harness, `Bearer ${completeData.token}`)
				.get('/users/@me')
				.execute();
			expect(meData.email).toBe(email);
		});
	});

	describe('redirect validation', () => {
		let admin: TestAccount;

		beforeEach(async () => {
			admin = await createTestAccount(harness);
			admin = await setUserACLs(harness, admin, [
				'admin:authenticate',
				'instance:config:update',
				'instance:config:view',
			]);
			await enableSso(harness, admin.token);
		});

		afterEach(async () => {
			await disableSso(harness, admin.token);
		});

		it('rejects open redirect URLs', async () => {
			const startData = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({redirect_to: 'https://evil.example/phish'})
				.execute();

			const email = `sso-open-redirect-${Date.now()}@example.com`;
			const completeData = await createBuilderWithoutAuth<SsoCompleteResponse>(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
					state: startData.state,
				})
				.execute();
			expect(completeData.redirect_to).toBe('');
		});

		it('rejects protocol-relative redirects', async () => {
			const startData = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({redirect_to: '//evil.example/phish'})
				.execute();

			const email = `sso-protocol-relative-${Date.now()}@example.com`;
			const completeData = await createBuilderWithoutAuth<SsoCompleteResponse>(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
					state: startData.state,
				})
				.execute();
			expect(completeData.redirect_to).toBe('');
		});

		it('rejects redirects with newlines', async () => {
			const startData = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({redirect_to: '/dashboard\r\nSet-Cookie: evil=true'})
				.execute();

			const email = `sso-newline-redirect-${Date.now()}@example.com`;
			const completeData = await createBuilderWithoutAuth<SsoCompleteResponse>(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
					state: startData.state,
				})
				.execute();
			expect(completeData.redirect_to).toBe('');
		});

		it('rejects too long redirects', async () => {
			const longRedirect = `/${'a'.repeat(2100)}`;
			await createBuilderWithoutAuth(harness)
				.post('/auth/sso/start')
				.body({redirect_to: longRedirect})
				.expect(400, 'INVALID_FORM_BODY')
				.execute();
		});

		it('uses default redirect when missing', async () => {
			const startData = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({})
				.execute();

			const email = `sso-default-redirect-${Date.now()}@example.com`;
			const completeData = await createBuilderWithoutAuth<SsoCompleteResponse>(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
					state: startData.state,
				})
				.execute();
			expect(completeData.redirect_to.trim()).toBe('');
		});
	});

	describe('state validation', () => {
		let admin: TestAccount;

		beforeEach(async () => {
			admin = await createTestAccount(harness);
			admin = await setUserACLs(harness, admin, [
				'admin:authenticate',
				'instance:config:update',
				'instance:config:view',
			]);
			await enableSso(harness, admin.token);
		});

		afterEach(async () => {
			await disableSso(harness, admin.token);
		});

		it('ensures state is single-use', async () => {
			const startData = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({redirect_to: '/me'})
				.execute();

			const email1 = `sso-singleuse-${Date.now()}@example.com`;
			await createBuilderWithoutAuth<SsoCompleteResponse>(harness)
				.post('/auth/sso/complete')
				.body({
					code: email1,
					state: startData.state,
				})
				.execute();

			const email2 = `sso-singleuse-2-${Date.now()}@example.com`;
			await createBuilderWithoutAuth(harness)
				.post('/auth/sso/complete')
				.body({
					code: email2,
					state: startData.state,
				})
				.expect(400)
				.execute();
		});

		it('rejects invalid state', async () => {
			const email = `sso-invalid-state-${Date.now()}@example.com`;
			await createBuilderWithoutAuth(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
					state: 'invalid-state-value-12345',
				})
				.expect(400)
				.execute();
		});

		it('rejects missing state', async () => {
			const email = `sso-missing-state-${Date.now()}@example.com`;
			await createBuilderWithoutAuth(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
				})
				.expect(400)
				.execute();
		});

		it('rejects empty code', async () => {
			const startData = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({})
				.execute();

			await createBuilderWithoutAuth(harness)
				.post('/auth/sso/complete')
				.body({
					code: '',
					state: startData.state,
				})
				.expect(400)
				.execute();
		});

		it('generates unique states', async () => {
			const states = new Set<string>();

			for (let i = 0; i < 10; i++) {
				const startData = await createBuilderWithoutAuth<SsoStartResponse>(harness)
					.post('/auth/sso/start')
					.body({})
					.execute();

				expect(states.has(startData.state)).toBe(false);
				states.add(startData.state);
			}

			expect(states.size).toBe(10);
		});
	});

	describe('domain validation', () => {
		let admin: TestAccount;

		beforeEach(async () => {
			admin = await createTestAccount(harness);
			admin = await setUserACLs(harness, admin, [
				'admin:authenticate',
				'instance:config:update',
				'instance:config:view',
			]);
		});

		afterEach(async () => {
			await disableSso(harness, admin.token);
		});

		it('enforces allowed domains', async () => {
			await enableSso(harness, admin.token, {
				allowed_domains: ['example.com'],
			});

			const startData = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({redirect_to: '/me'})
				.execute();

			const email = `sso-bad-domain-${Date.now()}@notexample.com`;
			await createBuilderWithoutAuth(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
					state: startData.state,
				})
				.expect(400)
				.execute();
		});

		it('handles allowed domains case-insensitively', async () => {
			await enableSso(harness, admin.token, {
				allowed_domains: ['EXAMPLE.COM'],
			});

			const startData = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({})
				.execute();

			const email = `sso-case-insensitive-${Date.now()}@example.com`;
			await createBuilderWithoutAuth<SsoCompleteResponse>(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
					state: startData.state,
				})
				.execute();
		});

		it('allows any domain when allowed_domains is empty', async () => {
			await enableSso(harness, admin.token, {
				allowed_domains: [],
			});

			const startData = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({})
				.execute();

			const email = `sso-any-domain-${Date.now()}@anydomain.org`;
			await createBuilderWithoutAuth<SsoCompleteResponse>(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
					state: startData.state,
				})
				.execute();
		});
	});

	describe('auto-provision', () => {
		let admin: TestAccount;

		beforeEach(async () => {
			admin = await createTestAccount(harness);
			admin = await setUserACLs(harness, admin, [
				'admin:authenticate',
				'instance:config:update',
				'instance:config:view',
			]);
		});

		afterEach(async () => {
			await disableSso(harness, admin.token);
		});

		it('respects auto_provision flag', async () => {
			await enableSso(harness, admin.token, {
				auto_provision: false,
			});

			const startData = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({redirect_to: '/me'})
				.execute();

			const email = `sso-noprovision-${Date.now()}@example.com`;
			await createBuilderWithoutAuth(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
					state: startData.state,
				})
				.expect(403)
				.execute();
		});
	});

	describe('existing user login', () => {
		let admin: TestAccount;

		beforeEach(async () => {
			admin = await createTestAccount(harness);
			admin = await setUserACLs(harness, admin, [
				'admin:authenticate',
				'instance:config:update',
				'instance:config:view',
			]);
			await enableSso(harness, admin.token);
		});

		afterEach(async () => {
			await disableSso(harness, admin.token);
		});

		it('logs in existing user via SSO', async () => {
			const email = `sso-existing-user-${Date.now()}@example.com`;

			const startData1 = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({})
				.execute();

			const firstLogin = await createBuilderWithoutAuth<SsoCompleteResponse>(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
					state: startData1.state,
				})
				.execute();

			const startData2 = await createBuilderWithoutAuth<SsoStartResponse>(harness)
				.post('/auth/sso/start')
				.body({})
				.execute();

			const secondLogin = await createBuilderWithoutAuth<SsoCompleteResponse>(harness)
				.post('/auth/sso/complete')
				.body({
					code: email,
					state: startData2.state,
				})
				.execute();
			expect(secondLogin.user_id).toBe(firstLogin.user_id);
		});
	});

	describe('status endpoint', () => {
		let admin: TestAccount;

		beforeEach(async () => {
			admin = await createTestAccount(harness);
			admin = await setUserACLs(harness, admin, [
				'admin:authenticate',
				'instance:config:update',
				'instance:config:view',
			]);
		});

		it('returns SSO status', async () => {
			const status1 = await createBuilderWithoutAuth<SsoStatusResponse>(harness).get('/auth/sso/status').execute();
			expect(status1.enabled).toBe(false);

			await enableSso(harness, admin.token, {
				display_name: 'Test SSO Provider',
			});

			const status2 = await createBuilderWithoutAuth<SsoStatusResponse>(harness).get('/auth/sso/status').execute();
			expect(status2.enabled).toBe(true);
			expect(status2.display_name).toBe('Test SSO Provider');

			await disableSso(harness, admin.token);
		});
	});
});
