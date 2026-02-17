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
	deauthorizeOAuth2Application,
	exchangeOAuth2AuthorizationCode,
	getOAuth2UserInfo,
	listOAuth2Authorizations,
} from '@fluxer/api/src/oauth/tests/OAuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('OAuth2 authorizations deauthorize', () => {
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

	it('verifies that a user can deauthorize an application, which revokes all associated tokens', async () => {
		const appOwner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const redirectURI = 'https://example.com/authz/deauth';
		const app = await createOAuth2Application(harness, appOwner, {
			name: 'Deauth Test',
			redirect_uris: [redirectURI],
		});

		const {code: authCode} = await authorizeOAuth2(harness, endUser.token, {
			client_id: app.id,
			redirect_uri: redirectURI,
			scope: 'identify',
		});

		const tokens = await exchangeOAuth2AuthorizationCode(harness, {
			client_id: app.id,
			client_secret: app.client_secret,
			code: authCode,
			redirect_uri: redirectURI,
		});

		const userInfo = await getOAuth2UserInfo(harness, tokens.access_token);
		expect(userInfo.sub).toBe(endUser.userId);

		const beforeAuthz = await listOAuth2Authorizations(harness, endUser.token);
		expect(beforeAuthz).toHaveLength(1);

		await deauthorizeOAuth2Application(harness, endUser.token, app.id);

		await createBuilder(harness, `Bearer ${tokens.access_token}`)
			.get('/oauth2/userinfo')
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();

		const afterAuthz = await listOAuth2Authorizations(harness, endUser.token);
		expect(afterAuthz).toHaveLength(0);
	});

	it('verifies that deauthorizing one application does not affect other authorized applications', async () => {
		const appOwner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const redirectURI = 'https://example.com/authz/partial';

		const app1 = await createOAuth2Application(harness, appOwner, {
			name: 'Partial Deauth 1',
			redirect_uris: [redirectURI],
		});

		const {code: code1} = await authorizeOAuth2(harness, endUser.token, {
			client_id: app1.id,
			redirect_uri: redirectURI,
			scope: 'identify',
		});

		const tokens1 = await exchangeOAuth2AuthorizationCode(harness, {
			client_id: app1.id,
			client_secret: app1.client_secret,
			code: code1,
			redirect_uri: redirectURI,
		});

		const app2 = await createOAuth2Application(harness, appOwner, {
			name: 'Partial Deauth 2',
			redirect_uris: [redirectURI],
		});

		const {code: code2} = await authorizeOAuth2(harness, endUser.token, {
			client_id: app2.id,
			redirect_uri: redirectURI,
			scope: 'identify',
		});

		const tokens2 = await exchangeOAuth2AuthorizationCode(harness, {
			client_id: app2.id,
			client_secret: app2.client_secret,
			code: code2,
			redirect_uri: redirectURI,
		});

		await deauthorizeOAuth2Application(harness, endUser.token, app1.id);

		await createBuilder(harness, `Bearer ${tokens1.access_token}`)
			.get('/oauth2/userinfo')
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();

		const userInfo2 = await getOAuth2UserInfo(harness, tokens2.access_token);
		expect(userInfo2.sub).toBe(endUser.userId);

		const authorizations = await listOAuth2Authorizations(harness, endUser.token);
		expect(authorizations).toHaveLength(1);
		expect(authorizations[0].application.id).toBe(app2.id);
	});

	it('verifies that deauthorizing a non-existent application returns an appropriate error', async () => {
		const user = await createTestAccount(harness);

		await createBuilder(harness, user.token)
			.delete('/oauth2/@me/authorizations/123456789012345678')
			.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_APPLICATION')
			.execute();
	});
});
