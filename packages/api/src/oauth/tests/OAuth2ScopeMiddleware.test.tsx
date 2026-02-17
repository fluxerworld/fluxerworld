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
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, test} from 'vitest';

interface OAuth2TokenResponse {
	token: string;
	user_id: string;
	scopes: Array<string>;
	application_id: string;
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

describe('OAuth2 scope middleware', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('rejects session tokens for OAuth2-only routes', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.get('/test/oauth2/require-identify')
			.expect(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED')
			.execute();
	});

	test('rejects unauthenticated requests for OAuth2-only routes', async () => {
		await createBuilder(harness, '')
			.get('/test/oauth2/require-identify')
			.expect(HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED')
			.execute();
	});

	test('rejects bearer tokens missing required scope', async () => {
		const account = await createTestAccount(harness);
		const oauth2Token = await createOAuth2Token(harness, account.userId, ['email']);

		await createBuilder(harness, `Bearer ${oauth2Token.token}`)
			.get('/test/oauth2/require-identify')
			.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_OAUTH_SCOPE')
			.execute();
	});

	test('allows bearer tokens with required scope', async () => {
		const account = await createTestAccount(harness);
		const oauth2Token = await createOAuth2Token(harness, account.userId, ['identify']);

		await createBuilder(harness, `Bearer ${oauth2Token.token}`)
			.get('/test/oauth2/require-identify')
			.expect(HTTP_STATUS.OK)
			.execute();
	});
});
