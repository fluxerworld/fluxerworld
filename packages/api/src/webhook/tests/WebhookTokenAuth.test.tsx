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
import {createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS, TEST_IDS} from '@fluxer/api/src/test/TestConstants';
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {createWebhook, deleteWebhook} from '@fluxer/api/src/webhook/tests/WebhookTestUtils';
import type {WebhookTokenResponse} from '@fluxer/schema/src/domains/webhook/WebhookSchemas';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('Webhook token authentication', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	describe('GET /webhooks/:webhook_id/:token', () => {
		it('returns webhook with valid token', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Token Auth Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Token Auth Webhook');

			const response = await createBuilderWithoutAuth<WebhookTokenResponse>(harness)
				.get(`/webhooks/${webhook.id}/${webhook.token}`)
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(response).not.toHaveProperty('user');

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('rejects invalid token', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Token Auth Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Token Auth Webhook');

			await createBuilderWithoutAuth(harness)
				.get(`/webhooks/${webhook.id}/invalid_token_12345`)
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('rejects nonexistent webhook id', async () => {
			await createBuilderWithoutAuth(harness)
				.get(`/webhooks/${TEST_IDS.NONEXISTENT_WEBHOOK}/any_token`)
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();
		});

		it('rejects valid id with wrong token', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Token Auth Guild');
			const channelId = guild.system_channel_id!;

			const webhook1 = await createWebhook(harness, channelId, owner.token, 'First Webhook');
			const webhook2 = await createWebhook(harness, channelId, owner.token, 'Second Webhook');

			await createBuilderWithoutAuth(harness)
				.get(`/webhooks/${webhook1.id}/${webhook2.token}`)
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();

			await deleteWebhook(harness, webhook1.id, owner.token);
			await deleteWebhook(harness, webhook2.id, owner.token);
		});
	});

	describe('PATCH /webhooks/:webhook_id/:token', () => {
		it('updates webhook with valid token', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Token Auth Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Original Name');

			const response = await createBuilderWithoutAuth<WebhookTokenResponse>(harness)
				.patch(`/webhooks/${webhook.id}/${webhook.token}`)
				.body({name: 'Updated Name'})
				.expect(HTTP_STATUS.OK)
				.execute();
			expect(response).not.toHaveProperty('user');

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('rejects channel_id updates with token', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Token Auth Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Token Patch Webhook');

			await createBuilderWithoutAuth(harness)
				.patch(`/webhooks/${webhook.id}/${webhook.token}`)
				.body({channel_id: channelId})
				.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('rejects update with invalid token', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Token Auth Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Token Patch Webhook');

			await createBuilderWithoutAuth(harness)
				.patch(`/webhooks/${webhook.id}/wrong_token`)
				.body({name: 'Hacked Name'})
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});
	});

	describe('DELETE /webhooks/:webhook_id/:token', () => {
		it('deletes webhook with valid token', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Token Auth Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Delete With Token');

			await createBuilderWithoutAuth(harness)
				.delete(`/webhooks/${webhook.id}/${webhook.token}`)
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();

			await createBuilderWithoutAuth(harness)
				.get(`/webhooks/${webhook.id}/${webhook.token}`)
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();
		});

		it('rejects delete with invalid token', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Token Auth Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Protected Webhook');

			await createBuilderWithoutAuth(harness)
				.delete(`/webhooks/${webhook.id}/bad_token`)
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();

			await createBuilderWithoutAuth(harness)
				.get(`/webhooks/${webhook.id}/${webhook.token}`)
				.expect(HTTP_STATUS.OK)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});
	});

	describe('POST /webhooks/:webhook_id/:token (execute)', () => {
		it('executes webhook with valid token', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Token Auth Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Execute Webhook');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}`)
				.body({content: 'Hello from webhook'})
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('rejects execution with invalid token', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Token Auth Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Execute Webhook');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/invalid_token`)
				.body({content: 'Should fail'})
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});
	});
});
