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
	exchangeOAuth2AuthorizationCode,
} from '@fluxer/api/src/oauth/tests/OAuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('OAuth2 authorize redirect URI validation', () => {
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

	it('verifies that localhost URIs work correctly for development purposes', async () => {
		const appOwner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const localhostURI = 'http://localhost:8080/oauth/callback';

		const app = await createOAuth2Application(harness, appOwner, {
			name: 'Localhost URI',
			redirect_uris: [localhostURI],
		});

		const {code: authCode} = await authorizeOAuth2(harness, endUser.token, {
			client_id: app.id,
			redirect_uri: localhostURI,
			scope: 'identify',
			state: 'localhost-state',
		});

		const tokenResp = await exchangeOAuth2AuthorizationCode(harness, {
			client_id: app.id,
			client_secret: app.client_secret,
			code: authCode,
			redirect_uri: localhostURI,
		});

		expect(tokenResp.access_token).toBeTruthy();
	});

	it('verifies that an application can have multiple registered redirect URIs and use any of them', async () => {
		const appOwner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const uri1 = 'https://app.example.com/callback';
		const uri2 = 'https://staging.example.com/callback';
		const uri3 = 'https://localhost:3000/callback';

		const app = await createOAuth2Application(harness, appOwner, {
			name: 'Multiple URIs',
			redirect_uris: [uri1, uri2, uri3],
		});

		const uris = [uri1, uri2, uri3];
		for (const uri of uris) {
			const {code: authCode} = await authorizeOAuth2(harness, endUser.token, {
				client_id: app.id,
				redirect_uri: uri,
				scope: 'identify',
			});

			const tokenResp = await exchangeOAuth2AuthorizationCode(harness, {
				client_id: app.id,
				client_secret: app.client_secret,
				code: authCode,
				redirect_uri: uri,
			});

			expect(tokenResp.access_token).toBeTruthy();
		}
	});

	it('verifies that redirect URIs must match exactly (no partial matches)', async () => {
		const appOwner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const registeredURI = 'https://example.com/callback';

		const app = await createOAuth2Application(harness, appOwner, {
			name: 'Exact Match',
			redirect_uris: [registeredURI],
		});

		const testCases = [
			'https://example.com/callback/extra',
			'https://example.com/callback?foo=bar',
			'https://example.com/callback#fragment',
			'http://example.com/callback',
			'https://other.com/callback',
			'https://example.com:8080/callback',
			'https://example.com/callback/',
		];

		for (const invalidURI of testCases) {
			await createBuilder(harness, endUser.token)
				.post('/oauth2/authorize/consent')
				.body({
					response_type: 'code',
					client_id: app.id,
					redirect_uri: invalidURI,
					scope: 'identify',
					state: 'test-state',
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		}
	});
});
