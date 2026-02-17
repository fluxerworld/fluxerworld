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

import {createAdminApiKey} from '@fluxer/api/src/admin/tests/AdminTestUtils';
import {createTestAccount, setUserACLs} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {
	authorizeOAuth2,
	createOAuth2Application,
	createOAuth2TestSetup,
	exchangeOAuth2AuthorizationCode,
} from '@fluxer/api/src/oauth/tests/OAuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {beforeEach, describe, expect, test} from 'vitest';

interface OAuth2TokenResponse {
	token: string;
	user_id: string;
	scopes: Array<string>;
	application_id: string;
}

interface UserMeResponse {
	id: string;
	username: string;
	email?: string | null;
}

interface UserGuildResponse {
	id: string;
	name: string;
}

async function createOAuth2Token(
	harness: ApiTestHarness,
	userId: string,
	scopes: Array<string>,
): Promise<OAuth2TokenResponse> {
	return createBuilder<OAuth2TokenResponse>(harness, '')
		.post('/test/oauth2/access-token')
		.body({
			user_id: userId,
			scopes,
		})
		.execute();
}

describe('OAuth2 Scope Enforcement', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	describe('Scope enforcement for user endpoints (/users/@me)', () => {
		test('GET /users/@me with bearer token succeeds when user is authenticated', async () => {
			const account = await createTestAccount(harness);
			const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify']);

			const json = await createBuilder<UserMeResponse>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(json.id).toBe(account.userId);
			expect(json.username).toBe(account.username);
		});

		test('GET /users/@me with bearer token returns user without email when only identify scope', async () => {
			const account = await createTestAccount(harness);
			const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify']);

			const json = await createBuilder<UserMeResponse>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(json.id).toBe(account.userId);
			expect(json.email).toBeNull();
		});

		test('GET /users/@me with bearer token returns email when email scope is present', async () => {
			const account = await createTestAccount(harness);
			const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify', 'email']);

			const json = await createBuilder<UserMeResponse>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(json.id).toBe(account.userId);
			expect(json.email).toBe(account.email);
		});

		test('GET /users/@me with session token (no scope check) succeeds', async () => {
			const account = await createTestAccount(harness);

			const json = await createBuilder<UserMeResponse>(harness, account.token)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(json.id).toBe(account.userId);
			expect(json.email).toBe(account.email);
		});

		test('GET /users/@me with bot token (no scope check) succeeds', async () => {
			const appOwner = await createTestAccount(harness);
			const application = await createOAuth2Application(harness, appOwner, {
				name: 'Bot Token Test',
				redirect_uris: [],
			});

			const json = await createBuilder<UserMeResponse>(harness, `Bot ${application.bot.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(json.id).toBe(application.bot.id);
		});

		test('GET /users/@me with bearer token fails when identify scope is missing', async () => {
			const account = await createTestAccount(harness);
			const oauth2Token = await createOAuth2Token(harness, account.userId, ['guilds']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_SCOPE')
				.execute();
		});

		test('GET /users/@me/settings rejects OAuth2 bearer tokens on unsupported endpoints', async () => {
			const account = await createTestAccount(harness);
			const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify', 'email']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me/settings')
				.expect(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED')
				.execute();
		});
	});

	describe('Scope enforcement for guild endpoints (/users/@me/guilds)', () => {
		test('GET /users/@me/guilds with guilds scope succeeds', async () => {
			const account = await createTestAccount(harness);
			await createGuild(harness, account.token, 'Test Guild');

			const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify', 'guilds']);

			const json = await createBuilder<Array<UserGuildResponse>>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(Array.isArray(json)).toBe(true);
			expect(json.length).toBeGreaterThan(0);
			expect(json[0]?.name).toBe('Test Guild');
		});

		test('GET /users/@me/guilds without guilds scope fails with MISSING_OAUTH_SCOPE', async () => {
			const account = await createTestAccount(harness);
			await createGuild(harness, account.token, 'Test Guild');

			const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_SCOPE')
				.execute();
		});

		test('GET /users/@me/guilds with session token (no scope check) succeeds', async () => {
			const account = await createTestAccount(harness);
			await createGuild(harness, account.token, 'Test Guild');

			const json = await createBuilder<Array<UserGuildResponse>>(harness, account.token)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(Array.isArray(json)).toBe(true);
			expect(json.length).toBeGreaterThan(0);
		});

		test('GET /users/@me/guilds with bot token (no scope check) succeeds', async () => {
			const appOwner = await createTestAccount(harness);
			const application = await createOAuth2Application(harness, appOwner, {
				name: 'Bot Guilds Test',
				redirect_uris: [],
			});

			const json = await createBuilder<Array<UserGuildResponse>>(harness, `Bot ${application.bot.token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(Array.isArray(json)).toBe(true);
		});
	});

	describe('Scope enforcement for connections endpoint (/users/@me/connections)', () => {
		test('GET /users/@me/connections with connections scope succeeds', async () => {
			const account = await createTestAccount(harness);
			const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify', 'connections']);

			const json = await createBuilder<Array<unknown>>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me/connections')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(Array.isArray(json)).toBe(true);
		});

		test('GET /users/@me/connections without connections scope fails with MISSING_OAUTH_SCOPE', async () => {
			const account = await createTestAccount(harness);
			const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me/connections')
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_SCOPE')
				.execute();
		});

		test('GET /users/@me/connections with session token succeeds', async () => {
			const account = await createTestAccount(harness);

			const json = await createBuilder<Array<unknown>>(harness, account.token)
				.get('/users/@me/connections')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(Array.isArray(json)).toBe(true);
		});
	});

	describe('Scope enforcement for userinfo endpoint (/oauth2/userinfo)', () => {
		test('GET /oauth2/userinfo with identify scope succeeds', async () => {
			const {endUser, redirectURI, application} = await createOAuth2TestSetup(harness);
			const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
				client_id: application.id,
				redirect_uri: redirectURI,
				scope: 'identify',
			});
			const tokenResponse = await exchangeOAuth2AuthorizationCode(harness, {
				client_id: application.id,
				client_secret: application.client_secret,
				code: authCodeResponse.code,
				redirect_uri: redirectURI,
			});

			await createBuilder(harness, `Bearer ${tokenResponse.access_token}`)
				.get('/oauth2/userinfo')
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('GET /oauth2/userinfo without identify scope fails with MISSING_OAUTH_SCOPE', async () => {
			const account = await createTestAccount(harness);
			const oauth2Token = await createOAuth2Token(harness, account.userId, ['guilds']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.get('/oauth2/userinfo')
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_SCOPE')
				.execute();
		});

		test('GET /oauth2/userinfo with session token is unauthorized', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.get('/oauth2/userinfo')
				.expect(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED')
				.execute();
		});
	});

	describe('Multiple scope scenarios', () => {
		test('Token with identify but not email cannot access email in response', async () => {
			const account = await createTestAccount(harness);
			const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify']);

			const json = await createBuilder<UserMeResponse>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(json.email).toBeNull();
		});

		test('Token with identify and email can access both user info and email', async () => {
			const account = await createTestAccount(harness);
			const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify', 'email']);

			const json = await createBuilder<UserMeResponse>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(json.id).toBe(account.userId);
			expect(json.email).toBe(account.email);
		});

		test('Token with guilds but not identify cannot access /users/@me/guilds without auth context', async () => {
			const account = await createTestAccount(harness);
			await createGuild(harness, account.token, 'Test Guild');

			const oauth2Token = await createOAuth2Token(harness, account.userId, ['guilds']);

			const json = await createBuilder<Array<UserGuildResponse>>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(Array.isArray(json)).toBe(true);
			expect(json.length).toBeGreaterThan(0);
		});

		test('Token with all common scopes can access all corresponding endpoints', async () => {
			const account = await createTestAccount(harness);
			await createGuild(harness, account.token, 'Test Guild');

			const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify', 'email', 'guilds']);

			const userJson = await createBuilder<UserMeResponse>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(userJson.id).toBe(account.userId);
			expect(userJson.email).toBe(account.email);

			const guildsJson = await createBuilder<Array<UserGuildResponse>>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(Array.isArray(guildsJson)).toBe(true);
			expect(guildsJson.length).toBeGreaterThan(0);
		});
	});

	describe('Edge cases', () => {
		test('Empty scopes set cannot access /users/@me', async () => {
			const account = await createTestAccount(harness);
			const oauth2Token = await createOAuth2Token(harness, account.userId, []);

			await createBuilder<UserMeResponse>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_SCOPE')
				.execute();
		});

		test('Token with empty scopes cannot access guilds endpoint', async () => {
			const account = await createTestAccount(harness);
			await createGuild(harness, account.token, 'Test Guild');

			const oauth2Token = await createOAuth2Token(harness, account.userId, []);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_SCOPE')
				.execute();
		});

		test('Scope checking does not affect session tokens', async () => {
			const account = await createTestAccount(harness);
			await createGuild(harness, account.token, 'Test Guild');

			const userJson = await createBuilder<UserMeResponse>(harness, account.token)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(userJson.id).toBe(account.userId);
			expect(userJson.email).toBe(account.email);

			const guildsJson = await createBuilder<Array<UserGuildResponse>>(harness, account.token)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(Array.isArray(guildsJson)).toBe(true);
		});

		test('Scope checking does not affect bot tokens', async () => {
			const appOwner = await createTestAccount(harness);
			const application = await createOAuth2Application(harness, appOwner, {
				name: 'Bot Scope Check Test',
				redirect_uris: [],
			});

			const userJson = await createBuilder<UserMeResponse>(harness, `Bot ${application.bot.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(userJson.id).toBe(application.bot.id);

			const guildsJson = await createBuilder<Array<UserGuildResponse>>(harness, `Bot ${application.bot.token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(Array.isArray(guildsJson)).toBe(true);
		});
	});

	describe('Admin scope integration', () => {
		test('OAuth2 token with admin scope can access admin endpoints when user has proper ACL', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'user:lookup']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email', 'admin']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('OAuth2 token without admin scope cannot access admin endpoints even with proper user ACL', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'user:lookup']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_ADMIN_SCOPE')
				.execute();
		});

		test('Session token can access admin endpoints with proper ACLs (no admin scope needed)', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'user:lookup']);

			await createBuilder(harness, `Bearer ${admin.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('Admin API key can access admin endpoints with granted ACLs (no scope check)', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'admin_api_key:manage', 'user:lookup']);

			const apiKey = await createAdminApiKey(harness, admin, 'Test Key', ['user:lookup'], null);

			await createBuilder(harness, apiKey.token)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('OAuth2 token with admin scope still requires proper user ACLs', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email', 'admin']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [admin.userId],
				})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_ACL')
				.execute();
		});

		test('OAuth2 token with admin scope without admin:authenticate ACL cannot access admin endpoints', async () => {
			const user = await createTestAccount(harness);

			const oauth2Token = await createOAuth2Token(harness, user.userId, ['identify', 'email', 'admin']);

			await createBuilder(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/users/lookup')
				.body({
					user_ids: [user.userId],
				})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_PERMISSIONS')
				.execute();
		});
	});

	describe('Negative tests - Error response verification', () => {
		test('Endpoint without proper guilds scope returns 403 with MISSING_OAUTH_SCOPE code', async () => {
			const account = await createTestAccount(harness);
			await createGuild(harness, account.token, 'Test Guild');

			const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify']);

			const json = await createBuilder<{code: string; message: string}>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_SCOPE')
				.execute();

			expect(json.code).toBe('MISSING_OAUTH_SCOPE');
		});

		test('Admin endpoint without admin scope returns 403 with MISSING_OAUTH_ADMIN_SCOPE code', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate', 'user:lookup']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['identify', 'email']);

			const json = await createBuilder<{code: string; message: string}>(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/users/lookup')
				.body({user_ids: [admin.userId]})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_ADMIN_SCOPE')
				.execute();

			expect(json.code).toBe('MISSING_OAUTH_ADMIN_SCOPE');
		});

		test('Admin endpoint with admin scope but missing ACL returns MISSING_ACL code', async () => {
			const admin = await createTestAccount(harness);
			await setUserACLs(harness, admin, ['admin:authenticate']);

			const oauth2Token = await createOAuth2Token(harness, admin.userId, ['admin']);

			const json = await createBuilder<{code: string; message: string}>(harness, `Bearer ${oauth2Token.token}`)
				.post('/admin/users/lookup')
				.body({user_ids: [admin.userId]})
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_ACL')
				.execute();

			expect(json.code).toBe('MISSING_ACL');
		});

		test('Unauthenticated request returns 401 UNAUTHORIZED', async () => {
			await createBuilder(harness, '').get('/users/@me').expect(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED').execute();
		});

		test('Invalid bearer token returns 401', async () => {
			await createBuilder(harness, 'Bearer invalid_token_12345')
				.get('/users/@me')
				.expect(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED')
				.execute();
		});
	});

	describe('Scope combinations and boundaries', () => {
		test('Token with only email scope (no identify) cannot access user info', async () => {
			const account = await createTestAccount(harness);
			const oauth2Token = await createOAuth2Token(harness, account.userId, ['email']);

			await createBuilder<UserMeResponse>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_SCOPE')
				.execute();
		});

		test('Multiple OAuth2 tokens with different scopes work independently', async () => {
			const account = await createTestAccount(harness);
			await createGuild(harness, account.token, 'Test Guild');

			const identifyToken = await createOAuth2Token(harness, account.userId, ['identify']);
			const guildsToken = await createOAuth2Token(harness, account.userId, ['identify', 'guilds']);
			const fullToken = await createOAuth2Token(harness, account.userId, ['identify', 'email', 'guilds']);

			const userJson1 = await createBuilder<UserMeResponse>(harness, `Bearer ${identifyToken.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(userJson1.email).toBeNull();

			await createBuilder(harness, `Bearer ${identifyToken.token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_SCOPE')
				.execute();

			const guildsJson = await createBuilder<Array<UserGuildResponse>>(harness, `Bearer ${guildsToken.token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(guildsJson.length).toBeGreaterThan(0);

			const userJson2 = await createBuilder<UserMeResponse>(harness, `Bearer ${guildsToken.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(userJson2.email).toBeNull();

			const userJson3 = await createBuilder<UserMeResponse>(harness, `Bearer ${fullToken.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(userJson3.email).toBe(account.email);

			const guildsJson2 = await createBuilder<Array<UserGuildResponse>>(harness, `Bearer ${fullToken.token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(guildsJson2.length).toBeGreaterThan(0);
		});

		test('Token created for one user cannot access another users data', async () => {
			const account1 = await createTestAccount(harness);
			const account2 = await createTestAccount(harness);

			const oauth2Token = await createOAuth2Token(harness, account1.userId, ['identify', 'email']);

			const json = await createBuilder<UserMeResponse>(harness, `Bearer ${oauth2Token.token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(json.id).toBe(account1.userId);
			expect(json.id).not.toBe(account2.userId);
		});
	});

	describe('Real OAuth2 flow scope enforcement', () => {
		test('OAuth2 token from real authorization flow respects scope restrictions', async () => {
			const {endUser, redirectURI, application} = await createOAuth2TestSetup(harness);
			await createGuild(harness, endUser.token, 'Test Guild');

			const {authorizeOAuth2, exchangeOAuth2AuthorizationCode} = await import(
				'@fluxer/api/src/oauth/tests/OAuthTestUtils'
			);

			const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
				client_id: application.id,
				redirect_uri: redirectURI,
				scope: 'identify',
			});

			const tokenResponse = await exchangeOAuth2AuthorizationCode(harness, {
				client_id: application.id,
				client_secret: application.client_secret,
				code: authCodeResponse.code,
				redirect_uri: redirectURI,
			});

			const userJson = await createBuilder<UserMeResponse>(harness, `Bearer ${tokenResponse.access_token}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(userJson.id).toBe(endUser.userId);
			expect(userJson.email).toBeNull();

			await createBuilder(harness, `Bearer ${tokenResponse.access_token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_SCOPE')
				.execute();
		});

		test('OAuth2 token with guilds scope from real flow can access guilds', async () => {
			const {endUser, redirectURI, application} = await createOAuth2TestSetup(harness);
			await createGuild(harness, endUser.token, 'Real Flow Guild');

			const {authorizeOAuth2, exchangeOAuth2AuthorizationCode} = await import(
				'@fluxer/api/src/oauth/tests/OAuthTestUtils'
			);

			const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
				client_id: application.id,
				redirect_uri: redirectURI,
				scope: 'identify guilds',
			});

			const tokenResponse = await exchangeOAuth2AuthorizationCode(harness, {
				client_id: application.id,
				client_secret: application.client_secret,
				code: authCodeResponse.code,
				redirect_uri: redirectURI,
			});

			const guildsJson = await createBuilder<Array<UserGuildResponse>>(harness, `Bearer ${tokenResponse.access_token}`)
				.get('/users/@me/guilds')
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(Array.isArray(guildsJson)).toBe(true);
			expect(guildsJson.length).toBeGreaterThan(0);
			expect(guildsJson.some((g) => g.name === 'Real Flow Guild')).toBe(true);
		});
	});
});
