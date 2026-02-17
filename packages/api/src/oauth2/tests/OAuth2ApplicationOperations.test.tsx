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
	deleteOAuth2Application,
	getOAuth2Application,
	listOAuth2Applications,
	updateOAuth2Application,
} from '@fluxer/api/src/oauth/tests/OAuth2TestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('OAuth2 Application Operations', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	describe('Create Application', () => {
		test('creates application with name and redirect URIs', async () => {
			const owner = await createTestAccount(harness);
			const name = createUniqueApplicationName();
			const redirectURIs = ['https://example.com/callback'];

			const result = await createOAuth2Application(harness, owner.token, {
				name,
				redirect_uris: redirectURIs,
			});

			expect(result.application.id).toBeTruthy();
			expect(result.application.name).toBe(name);
			expect(result.application.redirect_uris).toEqual(redirectURIs);
			expect(result.clientSecret).toBeTruthy();
			expect(result.botUserId).toBeTruthy();
			expect(result.botToken).toBeTruthy();
		});

		test('creates application with multiple redirect URIs', async () => {
			const owner = await createTestAccount(harness);
			const name = createUniqueApplicationName();
			const redirectURIs = [
				'https://example.com/callback1',
				'https://example.com/callback2',
				'https://example.com/callback3',
			];

			const result = await createOAuth2Application(harness, owner.token, {
				name,
				redirect_uris: redirectURIs,
			});

			expect(result.application.redirect_uris).toEqual(redirectURIs);
		});

		test('creates application with empty redirect URIs', async () => {
			const owner = await createTestAccount(harness);
			const name = createUniqueApplicationName();

			const result = await createOAuth2Application(harness, owner.token, {
				name,
				redirect_uris: [],
			});

			expect(result.application.redirect_uris).toEqual([]);
		});

		test('creates application with localhost redirect URI', async () => {
			const owner = await createTestAccount(harness);
			const name = createUniqueApplicationName();
			const redirectURIs = ['http://localhost:8080/callback'];

			const result = await createOAuth2Application(harness, owner.token, {
				name,
				redirect_uris: redirectURIs,
			});

			expect(result.application.redirect_uris).toEqual(redirectURIs);
		});

		test('bot_public defaults to true', async () => {
			const owner = await createTestAccount(harness);
			const name = createUniqueApplicationName();

			const result = await createOAuth2Application(harness, owner.token, {
				name,
				redirect_uris: ['https://example.com/callback'],
			});

			expect(result.application.bot_public).toBe(true);
		});

		test('creates application with bot_public set to false', async () => {
			const owner = await createTestAccount(harness);
			const name = createUniqueApplicationName();

			const result = await createOAuth2Application(harness, owner.token, {
				name,
				redirect_uris: ['https://example.com/callback'],
				bot_public: false,
			});

			expect(result.application.bot_public).toBe(false);
		});

		test('created application includes bot user', async () => {
			const owner = await createTestAccount(harness);

			const result = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			expect(result.application.bot).toBeTruthy();
			expect(result.application.bot?.id).toBe(result.botUserId);
			expect(result.application.bot?.username).toBeTruthy();
			expect(result.application.bot?.discriminator).toBeTruthy();
		});

		test('client_secret is returned on creation', async () => {
			const owner = await createTestAccount(harness);

			const result = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			expect(result.clientSecret).toBeTruthy();
			expect(result.clientSecret.length).toBeGreaterThan(0);
		});

		test('bot token is returned on creation', async () => {
			const owner = await createTestAccount(harness);

			const result = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			expect(result.botToken).toBeTruthy();
			expect(result.application.bot?.token).toBe(result.botToken);
		});
	});

	describe('Get Application', () => {
		test('retrieves application by ID', async () => {
			const owner = await createTestAccount(harness);
			const name = createUniqueApplicationName();
			const redirectURIs = ['https://example.com/callback'];

			const created = await createOAuth2Application(harness, owner.token, {
				name,
				redirect_uris: redirectURIs,
			});

			const app = await getOAuth2Application(harness, owner.token, created.application.id);

			expect(app.id).toBe(created.application.id);
			expect(app.name).toBe(name);
			expect(app.redirect_uris).toEqual(redirectURIs);
		});

		test('get application returns bot info', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const app = await getOAuth2Application(harness, owner.token, created.application.id);

			expect(app.bot).toBeTruthy();
			expect(app.bot?.id).toBe(created.botUserId);
			expect(app.bot?.username).toBeTruthy();
			expect(app.bot?.discriminator).toBeTruthy();
		});

		test('get application does not return client_secret', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const app = await getOAuth2Application(harness, owner.token, created.application.id);

			expect(app.client_secret).toBeFalsy();
		});

		test('get application does not return bot token', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const app = await getOAuth2Application(harness, owner.token, created.application.id);

			expect(app.bot?.token).toBeFalsy();
		});

		test('get application returns 404 for non-existent ID', async () => {
			const owner = await createTestAccount(harness);

			await createBuilder(harness, owner.token)
				.get('/oauth2/applications/999999999999999999')
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();
		});

		test('get application requires authentication', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await createBuilderWithoutAuth(harness)
				.get(`/oauth2/applications/${created.application.id}`)
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});

		test('get application enforces access control', async () => {
			const owner = await createTestAccount(harness);
			const otherUser = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await createBuilder(harness, otherUser.token)
				.get(`/oauth2/applications/${created.application.id}`)
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});
	});

	describe('List Applications', () => {
		test('lists user applications', async () => {
			const owner = await createTestAccount(harness);

			const app1 = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName('App1'),
				redirect_uris: ['https://example.com/app1'],
			});

			const app2 = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName('App2'),
				redirect_uris: ['https://example.com/app2'],
			});

			const apps = await listOAuth2Applications(harness, owner.token);

			expect(apps.length).toBeGreaterThanOrEqual(2);

			const app1Found = apps.find((a) => a.id === app1.application.id);
			const app2Found = apps.find((a) => a.id === app2.application.id);

			expect(app1Found).toBeTruthy();
			expect(app2Found).toBeTruthy();
		});

		test('list returns empty array for user with no applications', async () => {
			const owner = await createTestAccount(harness);

			const apps = await listOAuth2Applications(harness, owner.token);

			expect(apps).toEqual([]);
		});

		test('list does not return client_secret', async () => {
			const owner = await createTestAccount(harness);

			await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const apps = await listOAuth2Applications(harness, owner.token);

			for (const app of apps) {
				expect(app.client_secret).toBeFalsy();
			}
		});

		test('list does not return bot token', async () => {
			const owner = await createTestAccount(harness);

			await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const apps = await listOAuth2Applications(harness, owner.token);

			for (const app of apps) {
				expect(app.bot?.token).toBeFalsy();
			}
		});

		test('list applications shows bot info', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const apps = await listOAuth2Applications(harness, owner.token);
			const app = apps.find((a) => a.id === created.application.id);

			expect(app?.bot).toBeTruthy();
			expect(app?.bot?.id).toBe(created.botUserId);
		});

		test('list applications isolates user data', async () => {
			const user1 = await createTestAccount(harness);
			const user2 = await createTestAccount(harness);

			const user1App = await createOAuth2Application(harness, user1.token, {
				name: createUniqueApplicationName('User1App'),
				redirect_uris: ['https://example.com/user1'],
			});

			const user2App = await createOAuth2Application(harness, user2.token, {
				name: createUniqueApplicationName('User2App'),
				redirect_uris: ['https://example.com/user2'],
			});

			const user1Apps = await listOAuth2Applications(harness, user1.token);
			const user2Apps = await listOAuth2Applications(harness, user2.token);

			expect(user1Apps.find((a) => a.id === user1App.application.id)).toBeTruthy();
			expect(user1Apps.find((a) => a.id === user2App.application.id)).toBeFalsy();

			expect(user2Apps.find((a) => a.id === user2App.application.id)).toBeTruthy();
			expect(user2Apps.find((a) => a.id === user1App.application.id)).toBeFalsy();
		});

		test('list applications requires authentication', async () => {
			await createBuilderWithoutAuth(harness)
				.get('/oauth2/applications/@me')
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});
	});

	describe('Update Application', () => {
		test('updates application name', async () => {
			const owner = await createTestAccount(harness);
			const originalName = createUniqueApplicationName('Original');

			const created = await createOAuth2Application(harness, owner.token, {
				name: originalName,
				redirect_uris: ['https://example.com/callback'],
			});

			const newName = createUniqueApplicationName('Updated');
			const updated = await updateOAuth2Application(harness, owner.token, created.application.id, {
				name: newName,
			});

			expect(updated.name).toBe(newName);
			expect(updated.id).toBe(created.application.id);
		});

		test('updates redirect URIs', async () => {
			const owner = await createTestAccount(harness);
			const originalURIs = ['https://example.com/old'];

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: originalURIs,
			});

			const newURIs = ['https://example.com/new1', 'https://example.com/new2'];
			const updated = await updateOAuth2Application(harness, owner.token, created.application.id, {
				redirect_uris: newURIs,
			});

			expect(updated.redirect_uris).toEqual(newURIs);
		});

		test('partial update preserves other fields', async () => {
			const owner = await createTestAccount(harness);
			const originalName = createUniqueApplicationName('Original');
			const originalURIs = ['https://example.com/original'];

			const created = await createOAuth2Application(harness, owner.token, {
				name: originalName,
				redirect_uris: originalURIs,
			});

			const newName = createUniqueApplicationName('Updated');
			const updated = await updateOAuth2Application(harness, owner.token, created.application.id, {
				name: newName,
			});

			expect(updated.name).toBe(newName);
			expect(updated.redirect_uris).toEqual(originalURIs);
		});

		test('updates multiple fields at once', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName('Original'),
				redirect_uris: ['https://example.com/old'],
			});

			const newName = createUniqueApplicationName('Updated');
			const newURIs = ['https://example.com/new1', 'https://example.com/new2'];

			const updated = await updateOAuth2Application(harness, owner.token, created.application.id, {
				name: newName,
				redirect_uris: newURIs,
			});

			expect(updated.name).toBe(newName);
			expect(updated.redirect_uris).toEqual(newURIs);
		});

		test('update preserves bot info', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const updated = await updateOAuth2Application(harness, owner.token, created.application.id, {
				name: createUniqueApplicationName('Updated'),
			});

			expect(updated.bot?.id).toBe(created.botUserId);
		});

		test('update requires authentication', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await createBuilderWithoutAuth(harness)
				.patch(`/oauth2/applications/${created.application.id}`)
				.body({name: 'New Name'})
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});

		test('update enforces access control', async () => {
			const owner = await createTestAccount(harness);
			const otherUser = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await createBuilder(harness, otherUser.token)
				.patch(`/oauth2/applications/${created.application.id}`)
				.body({name: 'Stolen App'})
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});

		test('update returns 404 for non-existent application', async () => {
			const owner = await createTestAccount(harness);

			await createBuilder(harness, owner.token)
				.patch('/oauth2/applications/999999999999999999')
				.body({name: 'New Name'})
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();
		});
	});

	describe('Delete Application', () => {
		test('deletes application with password verification', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await deleteOAuth2Application(harness, owner.token, created.application.id, owner.password);

			await createBuilder(harness, owner.token)
				.get(`/oauth2/applications/${created.application.id}`)
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();
		});

		test('deleted application no longer appears in list', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await deleteOAuth2Application(harness, owner.token, created.application.id, owner.password);

			const apps = await listOAuth2Applications(harness, owner.token);
			const found = apps.find((a) => a.id === created.application.id);

			expect(found).toBeFalsy();
		});

		test('delete requires password verification', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await createBuilder(harness, owner.token)
				.delete(`/oauth2/applications/${created.application.id}`)
				.body({})
				.expect(HTTP_STATUS.FORBIDDEN, 'SUDO_MODE_REQUIRED')
				.execute();

			const {response: getResponse} = await createBuilder(harness, owner.token)
				.get(`/oauth2/applications/${created.application.id}`)
				.executeWithResponse();

			expect(getResponse.status).toBe(HTTP_STATUS.OK);
		});

		test('delete fails with wrong password', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await createBuilder(harness, owner.token)
				.delete(`/oauth2/applications/${created.application.id}`)
				.body({password: 'wrong-password'})
				.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
				.execute();
		});

		test('delete is idempotent', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await deleteOAuth2Application(harness, owner.token, created.application.id, owner.password);

			await createBuilder(harness, owner.token)
				.delete(`/oauth2/applications/${created.application.id}`)
				.body({password: owner.password})
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();
		});

		test('delete requires authentication', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await createBuilderWithoutAuth(harness)
				.delete(`/oauth2/applications/${created.application.id}`)
				.body({password: owner.password})
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});

		test('delete enforces access control', async () => {
			const owner = await createTestAccount(harness);
			const otherUser = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await createBuilder(harness, otherUser.token)
				.delete(`/oauth2/applications/${created.application.id}`)
				.body({password: otherUser.password})
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});

		test('delete invalidates bot token', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await createBuilder(harness, `Bot ${created.botToken}`).get('/users/@me').expect(HTTP_STATUS.OK).execute();

			await deleteOAuth2Application(harness, owner.token, created.application.id, owner.password);

			await createBuilder(harness, `Bot ${created.botToken}`)
				.get('/users/@me')
				.expect(HTTP_STATUS.UNAUTHORIZED)
				.execute();
		});
	});

	describe('Bot Public Toggle', () => {
		test('bot_public defaults to true', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const app = await getOAuth2Application(harness, owner.token, created.application.id);

			expect(app.bot_public).toBe(true);
		});

		test('updates bot_public to false', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const updated = await updateOAuth2Application(harness, owner.token, created.application.id, {
				bot_public: false,
			});

			expect(updated.bot_public).toBe(false);
		});

		test('updates bot_public to true', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
				bot_public: false,
			});

			const updated = await updateOAuth2Application(harness, owner.token, created.application.id, {
				bot_public: true,
			});

			expect(updated.bot_public).toBe(true);
		});

		test('private bot blocks non-owner authorization', async () => {
			const owner = await createTestAccount(harness);
			const otherUser = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await updateOAuth2Application(harness, owner.token, created.application.id, {
				bot_public: false,
			});

			await createBuilder(harness, otherUser.token)
				.post('/oauth2/authorize/consent')
				.body({
					response_type: 'code',
					client_id: created.application.id,
					scope: 'bot',
				})
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});

		test('private bot allows owner authorization', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await updateOAuth2Application(harness, owner.token, created.application.id, {
				bot_public: false,
			});

			await createBuilder(harness, owner.token)
				.post('/oauth2/authorize/consent')
				.body({
					response_type: 'code',
					client_id: created.application.id,
					scope: 'bot',
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('public bot allows any user authorization', async () => {
			const owner = await createTestAccount(harness);
			const otherUser = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
				bot_public: true,
			});

			await createBuilder(harness, otherUser.token)
				.post('/oauth2/authorize/consent')
				.body({
					response_type: 'code',
					client_id: created.application.id,
					scope: 'bot',
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});
	});

	describe('Bot Require Code Grant Toggle', () => {
		test('bot_require_code_grant defaults to false', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const app = await getOAuth2Application(harness, owner.token, created.application.id);
			expect(app.bot_require_code_grant).toBe(false);
		});

		test('updates bot_require_code_grant to true', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const updated = await updateOAuth2Application(harness, owner.token, created.application.id, {
				bot_require_code_grant: true,
			});
			expect(updated.bot_require_code_grant).toBe(true);

			const fetched = await getOAuth2Application(harness, owner.token, created.application.id);
			expect(fetched.bot_require_code_grant).toBe(true);
		});

		test('requires redirect_uri for bot-only authorization when enabled', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await updateOAuth2Application(harness, owner.token, created.application.id, {
				bot_require_code_grant: true,
			});

			await createBuilder(harness, owner.token)
				.post('/oauth2/authorize/consent')
				.body({
					client_id: created.application.id,
					scope: 'bot',
				})
				.expect(HTTP_STATUS.BAD_REQUEST)
				.execute();
		});

		test('allows bot-only authorization with redirect_uri when enabled', async () => {
			const owner = await createTestAccount(harness);

			const redirectUri = 'https://example.com/callback';
			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: [redirectUri],
			});

			await updateOAuth2Application(harness, owner.token, created.application.id, {
				bot_require_code_grant: true,
			});

			const res = await createBuilder<{redirect_to: string}>(harness, owner.token)
				.post('/oauth2/authorize/consent')
				.body({
					client_id: created.application.id,
					redirect_uri: redirectUri,
					scope: 'bot',
					state: 'test-state',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const url = new URL(res.redirect_to);
			expect(url.origin).toBe('https://example.com');
			expect(url.pathname).toBe('/callback');
			expect(url.searchParams.get('code')).toBeTruthy();
			expect(url.searchParams.get('state')).toBe('test-state');
		});
	});

	describe('Application Icon', () => {
		test('application icon is null by default', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const app = await getOAuth2Application(harness, owner.token, created.application.id);

			expect(app.bot?.avatar).toBeNull();
		});

		test('updates bot avatar via bot endpoint', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await createBuilder(harness, owner.token)
				.patch(`/oauth2/applications/${created.application.id}/bot`)
				.body({
					avatar:
						'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const updatedApp = await getOAuth2Application(harness, owner.token, created.application.id);
			expect(updatedApp.bot?.avatar).toBeTruthy();
		});

		test('clears bot avatar by setting to null', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await createBuilder(harness, owner.token)
				.patch(`/oauth2/applications/${created.application.id}/bot`)
				.body({
					avatar:
						'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			await createBuilder(harness, owner.token)
				.patch(`/oauth2/applications/${created.application.id}/bot`)
				.body({
					avatar: null,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const app = await getOAuth2Application(harness, owner.token, created.application.id);
			expect(app.bot?.avatar).toBeNull();
		});

		test('bot avatar update requires ownership', async () => {
			const owner = await createTestAccount(harness);
			const otherUser = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			await createBuilder(harness, otherUser.token)
				.patch(`/oauth2/applications/${created.application.id}/bot`)
				.body({
					avatar:
						'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
				})
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});
	});

	describe('Response Shape Validation', () => {
		test('create response includes required fields', async () => {
			const owner = await createTestAccount(harness);

			const result = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			expect(result.application.id).toBeTruthy();
			expect(result.application.name).toBeTruthy();
			expect(result.application.redirect_uris).toBeDefined();
			expect(result.clientSecret).toBeTruthy();
			expect(result.application.bot).toBeTruthy();
			expect(result.application.bot?.id).toBeTruthy();
			expect(result.application.bot?.username).toBeTruthy();
			expect(result.application.bot?.discriminator).toBeTruthy();
		});

		test('get response includes required fields', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const app = await getOAuth2Application(harness, owner.token, created.application.id);

			expect(app.id).toBeTruthy();
			expect(app.name).toBeTruthy();
			expect(app.redirect_uris).toBeDefined();
			expect(app.bot).toBeTruthy();
			expect(app.bot?.id).toBeTruthy();
			expect(app.bot?.username).toBeTruthy();
			expect(app.bot?.discriminator).toBeTruthy();
		});

		test('list response includes required fields', async () => {
			const owner = await createTestAccount(harness);

			await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const apps = await listOAuth2Applications(harness, owner.token);
			expect(apps.length).toBeGreaterThan(0);

			const app = apps[0]!;
			expect(app.id).toBeTruthy();
			expect(app.name).toBeTruthy();
			expect(app.redirect_uris).toBeDefined();
		});

		test('update response includes required fields', async () => {
			const owner = await createTestAccount(harness);

			const created = await createOAuth2Application(harness, owner.token, {
				name: createUniqueApplicationName(),
				redirect_uris: ['https://example.com/callback'],
			});

			const updated = await updateOAuth2Application(harness, owner.token, created.application.id, {
				name: createUniqueApplicationName('Updated'),
			});

			expect(updated.id).toBeTruthy();
			expect(updated.name).toBeTruthy();
			expect(updated.redirect_uris).toBeDefined();
		});
	});
});
