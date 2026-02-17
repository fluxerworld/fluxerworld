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

import {randomUUID} from 'node:crypto';
import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {
	authorizeOAuth2,
	createOAuth2Application,
	exchangeOAuth2AuthorizationCode,
	getOAuth2UserInfo,
	introspectOAuth2Token,
} from '@fluxer/api/src/oauth/tests/OAuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('OAuth2 Authorization Flow', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	describe('localhost redirect URI', () => {
		test('localhost redirect URI is allowed for development', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const localhostURI = 'http://localhost:8080/oauth/callback';

			const application = await createOAuth2Application(harness, appOwner, {
				name: `Localhost URI ${randomUUID()}`,
				redirect_uris: [localhostURI],
			});

			const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
				client_id: application.id,
				redirect_uri: localhostURI,
				scope: 'identify',
				state: 'localhost-state',
			});

			expect(authCodeResponse.code).toBeTruthy();

			const tokens = await exchangeOAuth2AuthorizationCode(harness, {
				client_id: application.id,
				client_secret: application.client_secret,
				code: authCodeResponse.code,
				redirect_uri: localhostURI,
			});

			expect(tokens.access_token).toBeTruthy();
			expect(tokens.token_type).toBe('Bearer');
		});

		test('localhost with different port is allowed', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const localhostURI = 'http://localhost:3000/callback';

			const application = await createOAuth2Application(harness, appOwner, {
				name: `Localhost Port ${randomUUID()}`,
				redirect_uris: [localhostURI],
			});

			const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
				client_id: application.id,
				redirect_uri: localhostURI,
				scope: 'identify',
			});

			expect(authCodeResponse.code).toBeTruthy();

			const tokens = await exchangeOAuth2AuthorizationCode(harness, {
				client_id: application.id,
				client_secret: application.client_secret,
				code: authCodeResponse.code,
				redirect_uri: localhostURI,
			});

			expect(tokens.access_token).toBeTruthy();
		});
	});

	describe('multiple redirect URIs', () => {
		test('application can register multiple redirect URIs and use any of them', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const uri1 = 'https://app.example.com/callback';
			const uri2 = 'https://staging.example.com/callback';
			const uri3 = 'http://localhost:3000/callback';

			const application = await createOAuth2Application(harness, appOwner, {
				name: `Multiple URIs ${randomUUID()}`,
				redirect_uris: [uri1, uri2, uri3],
			});

			const uris = [uri1, uri2, uri3];
			for (let i = 0; i < uris.length; i++) {
				const uri = uris[i]!;

				const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
					client_id: application.id,
					redirect_uri: uri,
					scope: 'identify',
					state: `state-${i}`,
				});

				expect(authCodeResponse.code).toBeTruthy();

				const tokens = await exchangeOAuth2AuthorizationCode(harness, {
					client_id: application.id,
					client_secret: application.client_secret,
					code: authCodeResponse.code,
					redirect_uri: uri,
				});

				expect(tokens.access_token).toBeTruthy();
			}
		});
	});

	describe('state parameter preservation', () => {
		test('state parameter is preserved through the flow', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const redirectURI = 'https://example.com/state/callback';
			const application = await createOAuth2Application(harness, appOwner, {
				name: `State Test App ${randomUUID()}`,
				redirect_uris: [redirectURI],
			});

			const customState = 'my-custom-state-12345';

			const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
				client_id: application.id,
				redirect_uri: redirectURI,
				scope: 'identify',
				state: customState,
			});

			expect(authCodeResponse.code).toBeTruthy();
			expect(authCodeResponse.state).toBe(customState);

			const tokens = await exchangeOAuth2AuthorizationCode(harness, {
				client_id: application.id,
				client_secret: application.client_secret,
				code: authCodeResponse.code,
				redirect_uri: redirectURI,
			});

			expect(tokens.access_token).toBeTruthy();
		});

		test('state with special characters is preserved', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const redirectURI = 'https://example.com/state/special';
			const application = await createOAuth2Application(harness, appOwner, {
				name: `Special State ${randomUUID()}`,
				redirect_uris: [redirectURI],
			});

			const testCases = [
				{name: 'with dashes', state: 'state-with-dashes-123'},
				{name: 'with underscores', state: 'state_with_underscores_456'},
				{name: 'with periods', state: 'state.with.periods.789'},
				{name: 'with equals', state: 'state=with=equals'},
				{name: 'with encoded chars', state: 'state%20with%20spaces'},
				{name: 'base64-like', state: 'c3RhdGUtYmFzZTY0LWxpa2U='},
				{name: 'long state', state: `very-long-state-${Date.now()}-with-many-characters`},
			];

			for (const tc of testCases) {
				const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
					client_id: application.id,
					redirect_uri: redirectURI,
					scope: 'identify',
					state: tc.state,
				});

				expect(authCodeResponse.state).toBe(tc.state);
			}
		});

		test('empty state generates auto-generated state', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const redirectURI = 'https://example.com/state/empty';
			const application = await createOAuth2Application(harness, appOwner, {
				name: `Empty State ${randomUUID()}`,
				redirect_uris: [redirectURI],
			});

			const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
				client_id: application.id,
				redirect_uri: redirectURI,
				scope: 'identify',
			});

			expect(authCodeResponse.code).toBeTruthy();
			expect(authCodeResponse.state).toBeTruthy();
		});
	});

	describe('invalid redirect URI rejection', () => {
		test('redirect URI must match exactly - extra path rejected', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const registeredURI = 'https://example.com/callback';
			const application = await createOAuth2Application(harness, appOwner, {
				name: `Exact Match ${randomUUID()}`,
				redirect_uris: [registeredURI],
			});

			await createBuilder(harness, endUser.token)
				.post('/oauth2/authorize/consent')
				.body({
					response_type: 'code',
					client_id: application.id,
					redirect_uri: 'https://example.com/callback/extra',
					scope: 'identify',
					state: 'test-state',
				})
				.expect(400)
				.execute();
		});

		test('redirect URI must match exactly - query param rejected', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const registeredURI = 'https://example.com/callback';
			const application = await createOAuth2Application(harness, appOwner, {
				name: `Query Param ${randomUUID()}`,
				redirect_uris: [registeredURI],
			});

			await createBuilder(harness, endUser.token)
				.post('/oauth2/authorize/consent')
				.body({
					response_type: 'code',
					client_id: application.id,
					redirect_uri: 'https://example.com/callback?foo=bar',
					scope: 'identify',
					state: 'test-state',
				})
				.expect(400)
				.execute();
		});

		test('redirect URI must match exactly - different scheme rejected', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const registeredURI = 'https://example.com/callback';
			const application = await createOAuth2Application(harness, appOwner, {
				name: `Different Scheme ${randomUUID()}`,
				redirect_uris: [registeredURI],
			});

			await createBuilder(harness, endUser.token)
				.post('/oauth2/authorize/consent')
				.body({
					response_type: 'code',
					client_id: application.id,
					redirect_uri: 'http://example.com/callback',
					scope: 'identify',
					state: 'test-state',
				})
				.expect(400)
				.execute();
		});

		test('redirect URI must match exactly - different host rejected', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const registeredURI = 'https://example.com/callback';
			const application = await createOAuth2Application(harness, appOwner, {
				name: `Different Host ${randomUUID()}`,
				redirect_uris: [registeredURI],
			});

			await createBuilder(harness, endUser.token)
				.post('/oauth2/authorize/consent')
				.body({
					response_type: 'code',
					client_id: application.id,
					redirect_uri: 'https://other.com/callback',
					scope: 'identify',
					state: 'test-state',
				})
				.expect(400)
				.execute();
		});

		test('redirect URI must match exactly - trailing slash rejected', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const registeredURI = 'https://example.com/callback';
			const application = await createOAuth2Application(harness, appOwner, {
				name: `Trailing Slash ${randomUUID()}`,
				redirect_uris: [registeredURI],
			});

			await createBuilder(harness, endUser.token)
				.post('/oauth2/authorize/consent')
				.body({
					response_type: 'code',
					client_id: application.id,
					redirect_uri: 'https://example.com/callback/',
					scope: 'identify',
					state: 'test-state',
				})
				.expect(400)
				.execute();
		});

		test('redirect URI must match exactly - different port rejected', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const registeredURI = 'https://example.com/callback';
			const application = await createOAuth2Application(harness, appOwner, {
				name: `Different Port ${randomUUID()}`,
				redirect_uris: [registeredURI],
			});

			await createBuilder(harness, endUser.token)
				.post('/oauth2/authorize/consent')
				.body({
					response_type: 'code',
					client_id: application.id,
					redirect_uri: 'https://example.com:8080/callback',
					scope: 'identify',
					state: 'test-state',
				})
				.expect(400)
				.execute();
		});
	});

	describe('mismatched redirect URI in token exchange', () => {
		test('token exchange fails when redirect URI does not match authorization', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const redirectURI1 = 'https://example.com/callback1';
			const redirectURI2 = 'https://example.com/callback2';

			const application = await createOAuth2Application(harness, appOwner, {
				name: `Mismatch Test ${randomUUID()}`,
				redirect_uris: [redirectURI1, redirectURI2],
			});

			const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
				client_id: application.id,
				redirect_uri: redirectURI1,
				scope: 'identify',
			});

			expect(authCodeResponse.code).toBeTruthy();

			const formData = new URLSearchParams({
				grant_type: 'authorization_code',
				code: authCodeResponse.code,
				redirect_uri: redirectURI2,
				client_id: application.id,
			});

			await createBuilder(harness, '')
				.post('/oauth2/token')
				.header('Content-Type', 'application/x-www-form-urlencoded')
				.header(
					'Authorization',
					`Basic ${Buffer.from(`${application.id}:${application.client_secret}`).toString('base64')}`,
				)
				.body(formData.toString())
				.expect(400)
				.execute();
		});

		test('token exchange fails with completely different redirect URI', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const redirectURI = 'https://example.com/callback';

			const application = await createOAuth2Application(harness, appOwner, {
				name: `Complete Mismatch ${randomUUID()}`,
				redirect_uris: [redirectURI],
			});

			const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
				client_id: application.id,
				redirect_uri: redirectURI,
				scope: 'identify',
			});

			expect(authCodeResponse.code).toBeTruthy();

			const formData = new URLSearchParams({
				grant_type: 'authorization_code',
				code: authCodeResponse.code,
				redirect_uri: 'https://malicious.com/steal-token',
				client_id: application.id,
			});

			await createBuilder(harness, '')
				.post('/oauth2/token')
				.header('Content-Type', 'application/x-www-form-urlencoded')
				.header(
					'Authorization',
					`Basic ${Buffer.from(`${application.id}:${application.client_secret}`).toString('base64')}`,
				)
				.body(formData.toString())
				.expect(400)
				.execute();
		});
	});

	describe('authorization code flow end-to-end', () => {
		test('complete authorization code flow works', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const redirectURI = 'https://example.com/oauth/callback';
			const application = await createOAuth2Application(harness, appOwner, {
				name: `OAuth2 Basic Flow ${randomUUID()}`,
				redirect_uris: [redirectURI],
			});

			const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
				client_id: application.id,
				redirect_uri: redirectURI,
				scope: 'identify email',
			});

			expect(authCodeResponse.code).toBeTruthy();
			expect(authCodeResponse.state).toBeTruthy();

			const tokens = await exchangeOAuth2AuthorizationCode(harness, {
				client_id: application.id,
				client_secret: application.client_secret,
				code: authCodeResponse.code,
				redirect_uri: redirectURI,
			});

			expect(tokens.access_token).toBeTruthy();
			expect(tokens.refresh_token).toBeTruthy();
			expect(tokens.token_type).toBe('Bearer');
			expect(tokens.expires_in).toBeGreaterThan(0);

			const userInfo = await getOAuth2UserInfo(harness, tokens.access_token);
			expect(userInfo.sub).toBe(endUser.userId);

			const introspection = await introspectOAuth2Token(harness, {
				client_id: application.id,
				client_secret: application.client_secret,
				token: tokens.access_token,
			});

			expect(introspection.active).toBe(true);
			expect(introspection.client_id).toBe(application.id);
		});

		test('authorization code can only be used once', async () => {
			const appOwner = await createTestAccount(harness);
			const endUser = await createTestAccount(harness);

			const redirectURI = 'https://example.com/oauth/single-use';
			const application = await createOAuth2Application(harness, appOwner, {
				name: `Single Use Code ${randomUUID()}`,
				redirect_uris: [redirectURI],
			});

			const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
				client_id: application.id,
				redirect_uri: redirectURI,
				scope: 'identify',
			});

			expect(authCodeResponse.code).toBeTruthy();

			const tokens = await exchangeOAuth2AuthorizationCode(harness, {
				client_id: application.id,
				client_secret: application.client_secret,
				code: authCodeResponse.code,
				redirect_uri: redirectURI,
			});

			expect(tokens.access_token).toBeTruthy();

			const formData = new URLSearchParams({
				grant_type: 'authorization_code',
				code: authCodeResponse.code,
				redirect_uri: redirectURI,
				client_id: application.id,
			});

			await createBuilder(harness, '')
				.post('/oauth2/token')
				.header('Content-Type', 'application/x-www-form-urlencoded')
				.header(
					'Authorization',
					`Basic ${Buffer.from(`${application.id}:${application.client_secret}`).toString('base64')}`,
				)
				.body(formData.toString())
				.expect(400)
				.execute();
		});
	});
});
