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
import {createApplicationID} from '@fluxer/api/src/BrandedTypes';
import {OAuth2TokenRepository} from '@fluxer/api/src/oauth/repositories/OAuth2TokenRepository';
import {
	authorizeOAuth2,
	createOAuth2TestSetup,
	exchangeOAuth2AuthorizationCode,
	getOAuth2UserInfo,
	introspectOAuth2Token,
	revokeOAuth2Token,
} from '@fluxer/api/src/oauth/tests/OAuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {beforeEach, describe, expect, test} from 'vitest';

describe('OAuth2 Token Revocation', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('should revoke access token', async () => {
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

		const userInfo = await getOAuth2UserInfo(harness, tokens.access_token);
		expect(userInfo.sub).toBeTruthy();

		await revokeOAuth2Token(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			token: tokens.access_token,
			token_type_hint: 'access_token',
		});

		await createBuilder(harness, `Bearer ${tokens.access_token}`).get('/oauth2/userinfo').expect(401).execute();

		const refreshGrant = new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: tokens.refresh_token!,
			client_id: application.id,
		});

		await createBuilder(harness, '')
			.post('/oauth2/token')
			.header('Content-Type', 'application/x-www-form-urlencoded')
			.header(
				'Authorization',
				`Basic ${Buffer.from(`${application.id}:${application.client_secret}`).toString('base64')}`,
			)
			.body(refreshGrant.toString())
			.expect(400)
			.execute();

		const introspection = await introspectOAuth2Token(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			token: tokens.access_token,
		});

		expect(introspection.active).toBe(false);
	});

	test('should revoke refresh token', async () => {
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

		await revokeOAuth2Token(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			token: tokens.refresh_token!,
			token_type_hint: 'refresh_token',
		});

		const formData = new URLSearchParams({
			grant_type: 'refresh_token',
			refresh_token: tokens.refresh_token!,
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

	test('should cascade revocation from refresh token to access token', async () => {
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

		const userInfoBefore = await getOAuth2UserInfo(harness, tokens.access_token);
		expect(userInfoBefore.sub).toBeTruthy();

		await revokeOAuth2Token(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			token: tokens.refresh_token!,
			token_type_hint: 'refresh_token',
		});

		await createBuilder(harness, `Bearer ${tokens.access_token}`).get('/oauth2/userinfo').expect(401).execute();
	});

	test('should handle revocation of already revoked token', async () => {
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

		await revokeOAuth2Token(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			token: tokens.refresh_token!,
			token_type_hint: 'refresh_token',
		});

		await revokeOAuth2Token(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			token: tokens.refresh_token!,
			token_type_hint: 'refresh_token',
		});
	});

	test('should handle revocation with invalid token gracefully', async () => {
		const {application} = await createOAuth2TestSetup(harness);

		await createBuilder(harness, '')
			.post('/oauth2/token/revoke')
			.header('Content-Type', 'application/x-www-form-urlencoded')
			.header(
				'Authorization',
				`Basic ${Buffer.from(`${application.id}:${application.client_secret}`).toString('base64')}`,
			)
			.body(
				new URLSearchParams({
					token: 'invalid_token_12345',
				}).toString(),
			)
			.expect(200)
			.execute();
	});

	test('should not cascade app-only access token revocation to user authorization tokens', async () => {
		const {endUser, redirectURI, application} = await createOAuth2TestSetup(harness);

		const authCodeResponse = await authorizeOAuth2(harness, endUser.token, {
			client_id: application.id,
			redirect_uri: redirectURI,
			scope: 'identify',
		});

		const userTokens = await exchangeOAuth2AuthorizationCode(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			code: authCodeResponse.code,
			redirect_uri: redirectURI,
		});

		const tokenRepository = new OAuth2TokenRepository();
		const appOnlyToken = randomBytes(32).toString('base64url');
		await tokenRepository.createAccessToken({
			token_: appOnlyToken,
			application_id: createApplicationID(BigInt(application.id)),
			user_id: null,
			scope: new Set(['identify']),
			created_at: new Date(),
		});

		const appOnlyBefore = await introspectOAuth2Token(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			token: appOnlyToken,
		});
		expect(appOnlyBefore.active).toBe(true);

		await revokeOAuth2Token(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			token: appOnlyToken,
			token_type_hint: 'access_token',
		});

		const appOnlyAfter = await introspectOAuth2Token(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			token: appOnlyToken,
		});
		expect(appOnlyAfter.active).toBe(false);

		const userTokenStillActive = await introspectOAuth2Token(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			token: userTokens.access_token,
		});
		expect(userTokenStillActive.active).toBe(true);
	});

	test('should fail revocation with wrong client_id', async () => {
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

		await createBuilder(harness, '')
			.post('/oauth2/token/revoke')
			.header('Content-Type', 'application/x-www-form-urlencoded')
			.header(
				'Authorization',
				`Basic ${Buffer.from(`999999999999999999:${application.client_secret}`).toString('base64')}`,
			)
			.body(
				new URLSearchParams({
					token: tokens.access_token,
					token_type_hint: 'access_token',
				}).toString(),
			)
			.expect(400)
			.execute();
	});

	test('should revoke token without type hint', async () => {
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

		await revokeOAuth2Token(harness, {
			client_id: application.id,
			client_secret: application.client_secret,
			token: tokens.access_token,
		});

		await createBuilder(harness, `Bearer ${tokens.access_token}`).get('/oauth2/userinfo').expect(401).execute();
	});
});
