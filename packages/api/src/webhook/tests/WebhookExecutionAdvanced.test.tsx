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
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {createWebhook, deleteWebhook} from '@fluxer/api/src/webhook/tests/WebhookTestUtils';
import type {MessageResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

describe('Webhook execution advanced', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	describe('Message content', () => {
		it('executes webhook with embeds', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Webhook Embed Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Embed Webhook');

			const embed = {
				title: 'Test Embed',
				description: 'This is a test embed from webhook',
				color: 0x00ff00,
			};

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}`)
				.body({embeds: [embed]})
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('executes webhook with content and embeds', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Webhook Content Embed Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Content Embed Webhook');

			const result = await createBuilderWithoutAuth<MessageResponse>(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}?wait=true`)
				.body({
					content: 'Message with embed',
					embeds: [{title: 'Accompanying Embed'}],
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.content).toBe('Message with embed');

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('executes webhook with custom username', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Webhook Username Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Username Webhook');

			const result = await createBuilderWithoutAuth<MessageResponse>(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}?wait=true`)
				.body({
					content: 'Custom username message',
					username: 'Custom Bot Name',
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.content).toBe('Custom username message');

			await deleteWebhook(harness, webhook.id, owner.token);
		});
	});

	describe('Validation', () => {
		it('rejects empty message', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Webhook Validation Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Empty Message Webhook');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}`)
				.body({})
				.expect(HTTP_STATUS.BAD_REQUEST, 'CANNOT_SEND_EMPTY_MESSAGE')
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('rejects empty content string', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Webhook Validation Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Empty Content Webhook');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}`)
				.body({content: ''})
				.expect(HTTP_STATUS.BAD_REQUEST, 'CANNOT_SEND_EMPTY_MESSAGE')
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('rejects whitespace only content', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Webhook Validation Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Whitespace Webhook');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}`)
				.body({content: '   '})
				.expect(HTTP_STATUS.BAD_REQUEST, 'CANNOT_SEND_EMPTY_MESSAGE')
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('allows empty content with valid embed', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Webhook Validation Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Embed Only Webhook');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}`)
				.body({
					embeds: [{title: 'Embed only message'}],
				})
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});
	});

	describe('Wait parameter', () => {
		it('returns 204 without wait parameter', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Webhook Wait Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'No Wait Webhook');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}`)
				.body({content: 'No wait message'})
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('returns message with wait=true', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Webhook Wait Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Wait True Webhook');

			const result = await createBuilderWithoutAuth<MessageResponse>(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}?wait=true`)
				.body({content: 'Wait message'})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(result.id).toBeTruthy();
			expect(result.content).toBe('Wait message');
			expect(result.webhook_id).toBe(webhook.id);

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('returns 204 with wait=false', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Webhook Wait Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Wait False Webhook');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}?wait=false`)
				.body({content: 'Wait false message'})
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});
	});

	describe('Slack compatible endpoint', () => {
		it('executes slack compatible webhook', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Slack Webhook Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Slack Compatible Webhook');

			const {response, text} = await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/${webhook.token}/slack`)
				.body({text: 'Hello from Slack format'})
				.expect(HTTP_STATUS.OK)
				.executeRaw();

			expect(response.status).toBe(HTTP_STATUS.OK);
			expect(text).toBe('ok');

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('rejects slack webhook with invalid token', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Slack Webhook Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Slack Invalid Token');

			await createBuilderWithoutAuth(harness)
				.post(`/webhooks/${webhook.id}/invalid_token/slack`)
				.body({text: 'Should fail'})
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});
	});
});
