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
	listOAuth2Authorizations,
} from '@fluxer/api/src/oauth/tests/OAuthTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('OAuth2 authorizations list', () => {
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

	it('verifies that a user with no authorized apps receives an empty list', async () => {
		const user = await createTestAccount(harness);

		const authorizations = await listOAuth2Authorizations(harness, user.token);

		expect(authorizations).toHaveLength(0);
	});

	it('verifies that after a user authorizes an OAuth2 application, it appears in their authorizations list', async () => {
		const appOwner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const redirectURI = 'https://example.com/authz/callback';
		const app = await createOAuth2Application(harness, appOwner, {
			name: 'Auth List Test',
			redirect_uris: [redirectURI],
		});

		const {code: authCode} = await authorizeOAuth2(harness, endUser.token, {
			client_id: app.id,
			redirect_uri: redirectURI,
			scope: 'identify email',
		});

		await exchangeOAuth2AuthorizationCode(harness, {
			client_id: app.id,
			client_secret: app.client_secret,
			code: authCode,
			redirect_uri: redirectURI,
		});

		const authorizations = await listOAuth2Authorizations(harness, endUser.token);

		expect(authorizations).toHaveLength(1);
		expect(authorizations[0].application.id).toBe(app.id);

		const scopes = authorizations[0].scopes;
		expect(scopes).toContain('identify');
		expect(scopes).toContain('email');
		expect(scopes).not.toContain('bot');

		expect(authorizations[0].authorized_at).toBeTruthy();
	});

	it('verifies that multiple authorized applications are correctly listed', async () => {
		const appOwner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const redirectURI = 'https://example.com/authz/multi';

		const app1 = await createOAuth2Application(harness, appOwner, {
			name: 'Multi Test App 1',
			redirect_uris: [redirectURI],
		});

		const {code: code1} = await authorizeOAuth2(harness, endUser.token, {
			client_id: app1.id,
			redirect_uri: redirectURI,
			scope: 'identify',
		});

		await exchangeOAuth2AuthorizationCode(harness, {
			client_id: app1.id,
			client_secret: app1.client_secret,
			code: code1,
			redirect_uri: redirectURI,
		});

		const app2 = await createOAuth2Application(harness, appOwner, {
			name: 'Multi Test App 2',
			redirect_uris: [redirectURI],
		});

		const {code: code2} = await authorizeOAuth2(harness, endUser.token, {
			client_id: app2.id,
			redirect_uri: redirectURI,
			scope: 'identify email',
		});

		await exchangeOAuth2AuthorizationCode(harness, {
			client_id: app2.id,
			client_secret: app2.client_secret,
			code: code2,
			redirect_uri: redirectURI,
		});

		const authorizations = await listOAuth2Authorizations(harness, endUser.token);

		expect(authorizations).toHaveLength(2);

		const appIds = authorizations.map((a) => a.application.id);
		expect(appIds).toContain(app1.id);
		expect(appIds).toContain(app2.id);
	});

	it('verifies that bot-only authorizations (scope = "bot" only) do not appear in the authorizations list', async () => {
		const appOwner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const redirectURI = 'https://example.com/authz/bot';
		const app = await createOAuth2Application(harness, appOwner, {
			name: 'Bot Only Test',
			redirect_uris: [redirectURI],
		});

		const {code: authCode} = await authorizeOAuth2(harness, endUser.token, {
			client_id: app.id,
			redirect_uri: redirectURI,
			scope: 'identify',
		});

		await exchangeOAuth2AuthorizationCode(harness, {
			client_id: app.id,
			client_secret: app.client_secret,
			code: authCode,
			redirect_uri: redirectURI,
		});

		const authorizations = await listOAuth2Authorizations(harness, endUser.token);

		expect(authorizations).toHaveLength(1);
		expect(authorizations[0].scopes).not.toContain('bot');
	});
});
