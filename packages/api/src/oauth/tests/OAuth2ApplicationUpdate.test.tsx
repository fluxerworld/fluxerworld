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
	createOAuth2Application,
	createUniqueApplicationName,
	updateOAuth2Application,
} from '@fluxer/api/src/oauth/tests/OAuth2TestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {beforeEach, describe, expect, test} from 'vitest';

describe('OAuth2 Application Update', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('updates application name', async () => {
		const account = await createTestAccount(harness);
		const originalName = createUniqueApplicationName();
		const redirectURIs = ['https://example.com/callback'];

		const createResult = await createOAuth2Application(harness, account.token, {
			name: originalName,
			redirect_uris: redirectURIs,
		});

		const newName = createUniqueApplicationName();
		const updated = await updateOAuth2Application(harness, account.token, createResult.application.id, {
			name: newName,
		});

		expect(updated.name).toBe(newName);
		expect(updated.id).toBe(createResult.application.id);
		expect(updated.redirect_uris).toEqual(redirectURIs);
	});

	test('supports partial updates', async () => {
		const account = await createTestAccount(harness);
		const originalName = createUniqueApplicationName();
		const originalURIs = ['https://example.com/old'];

		const createResult = await createOAuth2Application(harness, account.token, {
			name: originalName,
			redirect_uris: originalURIs,
		});

		const newName = createUniqueApplicationName();
		const updated = await updateOAuth2Application(harness, account.token, createResult.application.id, {
			name: newName,
		});

		expect(updated.name).toBe(newName);
		expect(updated.redirect_uris).toEqual(originalURIs);
	});

	test('updates redirect URIs', async () => {
		const account = await createTestAccount(harness);
		const createResult = await createOAuth2Application(harness, account.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
		});

		const newURIs = ['https://example.com/new1', 'https://example.com/new2'];
		const updated = await updateOAuth2Application(harness, account.token, createResult.application.id, {
			redirect_uris: newURIs,
		});

		expect(updated.redirect_uris).toEqual(newURIs);
	});

	test('updates bot_public flag', async () => {
		const account = await createTestAccount(harness);
		const createResult = await createOAuth2Application(harness, account.token, {
			name: createUniqueApplicationName(),
			bot_public: false,
		});

		const updated = await updateOAuth2Application(harness, account.token, createResult.application.id, {
			bot_public: true,
		});

		expect(updated.bot_public).toBe(true);
	});

	test('updates multiple fields', async () => {
		const account = await createTestAccount(harness);
		const createResult = await createOAuth2Application(harness, account.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
			bot_public: false,
		});

		const newName = createUniqueApplicationName();
		const newURIs = ['https://example.com/updated'];
		const updated = await updateOAuth2Application(harness, account.token, createResult.application.id, {
			name: newName,
			redirect_uris: newURIs,
			bot_public: true,
		});

		expect(updated.name).toBe(newName);
		expect(updated.redirect_uris).toEqual(newURIs);
		expect(updated.bot_public).toBe(true);
	});

	test('keeps bot user after update', async () => {
		const account = await createTestAccount(harness);
		const createResult = await createOAuth2Application(harness, account.token, {
			name: createUniqueApplicationName(),
		});

		const updated = await updateOAuth2Application(harness, account.token, createResult.application.id, {
			name: createUniqueApplicationName(),
		});

		expect(updated.bot).toBeDefined();
		expect(updated.bot?.id).toBe(createResult.application.bot?.id);
	});

	test('returns 404 for non-existent application', async () => {
		const account = await createTestAccount(harness);

		await createBuilder(harness, account.token)
			.patch('/oauth2/applications/999999999999999999')
			.body({name: createUniqueApplicationName()})
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	test('enforces access control', async () => {
		const owner = await createTestAccount(harness);
		const otherUser = await createTestAccount(harness);

		const createResult = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
		});

		await createBuilder(harness, otherUser.token)
			.patch(`/oauth2/applications/${createResult.application.id}`)
			.body({name: createUniqueApplicationName()})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('requires authentication', async () => {
		await createBuilderWithoutAuth(harness)
			.patch('/oauth2/applications/123')
			.body({name: createUniqueApplicationName()})
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();
	});
});
