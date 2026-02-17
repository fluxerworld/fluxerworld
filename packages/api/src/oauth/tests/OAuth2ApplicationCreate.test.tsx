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
import {createOAuth2Application, createUniqueApplicationName} from '@fluxer/api/src/oauth/tests/OAuth2TestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('OAuth2 Application Create', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('creates OAuth2 application with bot user', async () => {
		const account = await createTestAccount(harness);
		const appName = createUniqueApplicationName();
		const redirectURIs = ['https://example.com/callback'];

		const result = await createOAuth2Application(harness, account.token, {
			name: appName,
			redirect_uris: redirectURIs,
			bot_public: true,
		});

		expect(result.application.id).toBeTruthy();
		expect(result.application.name).toBe(appName);
		expect(result.application.redirect_uris).toEqual(redirectURIs);
		expect(result.application.bot).toBeDefined();
		expect(result.application.bot?.id).toBeTruthy();
		expect(result.application.bot?.username).toBeTruthy();
		expect(result.application.bot?.discriminator).toBeTruthy();
		expect(result.application.bot?.token).toBeTruthy();
		expect(result.clientSecret).toBeTruthy();
		expect(result.botUserId).toBe(result.application.bot?.id);
		expect(result.botToken).toBe(result.application.bot?.token);

		const botUser = await createBuilder<{id: string; bot: boolean}>(harness, `Bot ${result.botToken}`)
			.get('/users/@me')
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(botUser.id).toBe(result.botUserId);
		expect(botUser.bot).toBe(true);
	});

	test('creates application without optional fields', async () => {
		const account = await createTestAccount(harness);
		const appName = createUniqueApplicationName();

		const result = await createOAuth2Application(harness, account.token, {
			name: appName,
		});

		expect(result.application.id).toBeTruthy();
		expect(result.application.name).toBe(appName);
		expect(result.application.redirect_uris).toEqual([]);
		expect(result.application.bot).toBeDefined();
		expect(result.application.bot?.id).toBeTruthy();
	});

	test('rejects missing name', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.post('/oauth2/applications')
			.body({})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('rejects non-localhost http redirect URIs', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.post('/oauth2/applications')
			.body({
				name: createUniqueApplicationName(),
				redirect_uris: ['http://example.com/callback'],
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('accepts https redirect URIs', async () => {
		const account = await createTestAccount(harness);
		const appName = createUniqueApplicationName();

		const result = await createOAuth2Application(harness, account.token, {
			name: appName,
			redirect_uris: ['https://example.com/callback'],
		});

		expect(result.application.redirect_uris).toEqual(['https://example.com/callback']);
	});

	test('accepts localhost redirect URIs with http', async () => {
		const account = await createTestAccount(harness);
		const appName = createUniqueApplicationName();

		const result = await createOAuth2Application(harness, account.token, {
			name: appName,
			redirect_uris: ['http://localhost:3000/callback'],
		});

		expect(result.application.redirect_uris).toEqual(['http://localhost:3000/callback']);
	});
});
