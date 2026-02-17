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
import {HTTP_STATUS, TEST_CREDENTIALS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

interface ApplicationResponse {
	id: string;
	name: string;
	bot_public: boolean;
	bot?: {
		id: string;
		username: string;
	};
}

describe('OAuth2 Bot Token', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('should authenticate with Bot prefix in authorization header', async () => {
		const owner = await createTestAccount(harness);

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
		});

		const json = await createBuilder<ApplicationResponse>(harness, `Bot ${app.botToken}`)
			.get('/applications/@me')
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(json.id).toBe(app.application.id);
	});

	test('should reject Bearer prefix for bot authentication', async () => {
		const owner = await createTestAccount(harness);

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
		});

		await createBuilder(harness, `Bearer ${app.botToken}`)
			.get('/applications/@me')
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();
	});

	test('should reject invalid bot token', async () => {
		await createBuilder(harness, 'Bot invalid_bot_token_12345')
			.get('/applications/@me')
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();
	});

	test('should reject bot token without prefix', async () => {
		const owner = await createTestAccount(harness);

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
		});

		await createBuilder(harness, app.botToken).get('/applications/@me').expect(HTTP_STATUS.UNAUTHORIZED).execute();
	});

	test('should reset bot token and invalidate old token', async () => {
		const owner = await createTestAccount(harness);

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
		});

		await createBuilder(harness, `Bot ${app.botToken}`).get('/applications/@me').expect(HTTP_STATUS.OK).execute();

		const resetJson = await createBuilder<{token: string}>(harness, owner.token)
			.post(`/oauth2/applications/${app.application.id}/bot/reset-token`)
			.body({password: TEST_CREDENTIALS.STRONG_PASSWORD})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(resetJson.token).toBeTruthy();
		expect(resetJson.token).not.toBe(app.botToken);

		await createBuilder(harness, `Bot ${app.botToken}`)
			.get('/applications/@me')
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();

		await createBuilder(harness, `Bot ${resetJson.token}`).get('/applications/@me').expect(HTTP_STATUS.OK).execute();
	});

	test('should reject bot token reset without password', async () => {
		const owner = await createTestAccount(harness);

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
		});

		await createBuilder(harness, owner.token)
			.post(`/oauth2/applications/${app.application.id}/bot/reset-token`)
			.body({})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should reject bot token reset with wrong password', async () => {
		const owner = await createTestAccount(harness);

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
		});

		await createBuilder(harness, owner.token)
			.post(`/oauth2/applications/${app.application.id}/bot/reset-token`)
			.body({password: 'wrong-password'})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should reject bot token reset by non-owner', async () => {
		const owner = await createTestAccount(harness);
		const otherUser = await createTestAccount(harness);

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
		});

		await createBuilder(harness, otherUser.token)
			.post(`/oauth2/applications/${app.application.id}/bot/reset-token`)
			.body({password: TEST_CREDENTIALS.STRONG_PASSWORD})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should return bot information in application response', async () => {
		const owner = await createTestAccount(harness);

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
		});

		const json = await createBuilder<ApplicationResponse>(harness, `Bot ${app.botToken}`)
			.get('/applications/@me')
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(json.id).toBe(app.application.id);
		expect(json.bot).toBeTruthy();
		expect(json.bot?.id).toBe(app.botUserId);
	});

	test('should create application with bot user', async () => {
		const owner = await createTestAccount(harness);

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
		});

		expect(app.application.id).toBeTruthy();
		expect(app.botUserId).toBeTruthy();
		expect(app.botToken).toBeTruthy();
		expect(app.clientSecret).toBeTruthy();

		expect(app.botToken).toMatch(/^\d+\./);
	});
});
