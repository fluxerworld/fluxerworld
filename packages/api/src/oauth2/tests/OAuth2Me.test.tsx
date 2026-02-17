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

import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {
	authorizeOAuth2,
	createOAuth2Application,
	createOAuth2TestSetup,
	exchangeOAuth2AuthorizationCode,
	revokeOAuth2Token,
} from '@fluxer/api/src/oauth/tests/OAuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

interface OAuth2MeResponse {
	application: {
		id: string;
		name: string;
		icon: null;
		description: null;
		bot_public: boolean;
		bot_require_code_grant: boolean;
		flags: number;
	};
	scopes: Array<string>;
	expires: string;
	user?: {
		id: string;
		username: string;
		email?: string | null;
	};
}

describe('OAuth2 /oauth2/@me Endpoint', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('/oauth2/@me returns application info and user info with valid token', async () => {
		const {endUser, redirectURI, application} = await createOAuth2TestSetup(harness);

		const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
			client_id: application.id,
			redirect_uri: redirectURI,
			scope: 'identify',
		});

		const tokens = await exchangeOAuth2AuthorizationCode(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			code: authCodeResponse.code,
			redirect_uri: redirectURI,
		});

		const {response, json} = await createBuilder<OAuth2MeResponse>(harness, `Bearer ${tokens.access_token}`)
			.get('/oauth2/@me')
			.expect(200)
			.executeWithResponse();

		expect(response.status).toBe(200);

		expect(json.application).toBeDefined();
		expect(json.application.id).toBe(application.id);
		expect(json.application.bot_public).toBeDefined();
		expect(json.application.bot_require_code_grant).toBe(false);
		expect(json.application.flags).toBe(0);

		expect(json.scopes).toContain('identify');
		expect(json.expires).toBeDefined();
		expect(new Date(json.expires).getTime()).toBeGreaterThan(Date.now());

		expect(json.user).toBeDefined();
		expect(json.user?.id).toBe(endUser.userId);
		expect(json.user?.username).toBeDefined();
	});

	test('/oauth2/@me omits user info when identify scope is missing', async () => {
		const appOwner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const application = await createOAuth2Application(harness, appOwner, {
			name: 'No Identify Scope App',
			redirect_uris: [],
		});

		const {response, json} = await createBuilder<{redirect_to: string}>(harness, endUser.token)
			.post('/oauth2/authorize/consent')
			.body({
				response_type: 'code',
				client_id: application.id,
				scope: 'bot',
				state: 'test-state',
			})
			.expect(200)
			.executeWithResponse();

		expect(response.status).toBe(200);
		expect(json.redirect_to).toBeTruthy();

		const redirectUrl = new URL(json.redirect_to);
		const code = redirectUrl.searchParams.get('code');

		expect(code).toBeTruthy();

		const baseRedirectUri = json.redirect_to.split('?')[0] ?? '';
		const tokens = await exchangeOAuth2AuthorizationCode(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			code: code!,
			redirect_uri: baseRedirectUri,
		});

		const meResponse = await createBuilder<OAuth2MeResponse>(harness, `Bearer ${tokens.access_token}`)
			.get('/oauth2/@me')
			.expect(200)
			.execute();

		expect(meResponse.application).toBeDefined();
		expect(meResponse.application.id).toBe(application.id);
		expect(meResponse.scopes).toContain('bot');
		expect(meResponse.scopes).not.toContain('identify');
		expect(meResponse.user).toBeUndefined();
	});

	test('/oauth2/@me rejects invalid token with 401', async () => {
		await createBuilder(harness, 'Bearer invalid_token_abc123').get('/oauth2/@me').expect(401).execute();
	});

	test('/oauth2/@me rejects revoked token with 401', async () => {
		const {endUser, redirectURI, application} = await createOAuth2TestSetup(harness);

		const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
			client_id: application.id,
			redirect_uri: redirectURI,
			scope: 'identify',
		});

		const tokens = await exchangeOAuth2AuthorizationCode(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			code: authCodeResponse.code,
			redirect_uri: redirectURI,
		});

		await createBuilder(harness, `Bearer ${tokens.access_token}`).get('/oauth2/@me').expect(200).execute();

		await revokeOAuth2Token(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			token: tokens.access_token,
			token_type_hint: 'access_token',
		});

		await createBuilder(harness, `Bearer ${tokens.access_token}`).get('/oauth2/@me').expect(401).execute();
	});

	test('/oauth2/@me rejects request without Authorization header with 401', async () => {
		await createBuilderWithoutAuth(harness).get('/oauth2/@me').expect(401).execute();
	});

	test('/oauth2/@me rejects malformed Bearer token with 401', async () => {
		await createBuilder(harness, 'NotBearer some_token').get('/oauth2/@me').expect(401).execute();
	});

	test('/oauth2/@me includes email when email scope is present', async () => {
		const {endUser, redirectURI, application} = await createOAuth2TestSetup(harness);

		const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
			client_id: application.id,
			redirect_uri: redirectURI,
			scope: 'identify email',
		});

		const tokens = await exchangeOAuth2AuthorizationCode(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			code: authCodeResponse.code,
			redirect_uri: redirectURI,
		});

		const json = await createBuilder<OAuth2MeResponse>(harness, `Bearer ${tokens.access_token}`)
			.get('/oauth2/@me')
			.expect(200)
			.execute();

		expect(json.user).toBeDefined();
		expect(json.user?.email).toBe(endUser.email);
		expect(json.scopes).toContain('email');
	});

	test('/oauth2/@me omits email when email scope is missing', async () => {
		const {endUser, redirectURI, application} = await createOAuth2TestSetup(harness);

		const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
			client_id: application.id,
			redirect_uri: redirectURI,
			scope: 'identify',
		});

		const tokens = await exchangeOAuth2AuthorizationCode(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			code: authCodeResponse.code,
			redirect_uri: redirectURI,
		});

		const json = await createBuilder<OAuth2MeResponse>(harness, `Bearer ${tokens.access_token}`)
			.get('/oauth2/@me')
			.expect(200)
			.execute();

		expect(json.user).toBeDefined();
		expect(json.user?.email).toBeNull();
		expect(json.scopes).not.toContain('email');
	});
});
