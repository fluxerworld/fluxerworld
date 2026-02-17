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
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('OAuth2 authorize state parameter', () => {
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

	it('verifies that the state parameter is correctly echoed back in the authorization redirect', async () => {
		const appOwner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const redirectURI = 'https://example.com/state/callback';
		const app = await createOAuth2Application(harness, appOwner, {
			name: 'State Test App',
			redirect_uris: [redirectURI],
		});

		const customState = 'my-custom-state-12345';

		const {code: authCode, state: returnedState} = await authorizeOAuth2(harness, endUser.token, {
			client_id: app.id,
			redirect_uri: redirectURI,
			scope: 'identify',
			state: customState,
		});

		expect(authCode).toBeTruthy();
		expect(returnedState).toBe(customState);

		const tokenResp = await exchangeOAuth2AuthorizationCode(harness, {
			client_id: app.id,
			client_secret: app.client_secret,
			code: authCode,
			redirect_uri: redirectURI,
		});

		expect(tokenResp.access_token).toBeTruthy();
	});

	it('verifies behavior when state is omitted', async () => {
		const appOwner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const redirectURI = 'https://example.com/state/empty';
		const app = await createOAuth2Application(harness, appOwner, {
			name: 'Empty State',
			redirect_uris: [redirectURI],
		});

		const {code: authCode, state: returnedState} = await authorizeOAuth2(harness, endUser.token, {
			client_id: app.id,
			redirect_uri: redirectURI,
			scope: 'identify',
		});

		expect(authCode).toBeTruthy();
		expect(returnedState).toBeTruthy();

		const tokenResp = await exchangeOAuth2AuthorizationCode(harness, {
			client_id: app.id,
			client_secret: app.client_secret,
			code: authCode,
			redirect_uri: redirectURI,
		});

		expect(tokenResp.access_token).toBeTruthy();
	});

	it('verifies that state parameters with special characters are preserved correctly', async () => {
		const appOwner = await createTestAccount(harness);
		const endUser = await createTestAccount(harness);

		const redirectURI = 'https://example.com/state/special';
		const app = await createOAuth2Application(harness, appOwner, {
			name: 'Special State',
			redirect_uris: [redirectURI],
		});

		const testCases = [
			{state: 'state-with-dashes-123', name: 'with dashes'},
			{state: 'state_with_underscores_456', name: 'with underscores'},
			{state: 'state.with.periods.789', name: 'with periods'},
			{state: 'state=with=equals', name: 'with equals'},
			{state: 'state%20with%20spaces', name: 'with encoded chars'},
			{state: 'c3RhdGUtYmFzZTY0LWxpa2U=', name: 'base64-like'},
		];

		for (const tc of testCases) {
			const {state: returnedState} = await authorizeOAuth2(harness, endUser.token, {
				client_id: app.id,
				redirect_uri: redirectURI,
				scope: 'identify',
				state: tc.state,
			});

			expect(returnedState).toBe(tc.state);
		}
	});
});
