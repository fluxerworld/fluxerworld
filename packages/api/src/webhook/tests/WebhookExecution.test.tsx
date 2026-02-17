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
import {createWebhook, deleteWebhook, executeWebhook} from '@fluxer/api/src/webhook/tests/WebhookTestUtils';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Webhook execution', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('executes webhook without wait returns 204', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook Exec Guild');
		const channelId = guild.system_channel_id!;

		const webhook = await createWebhook(harness, channelId, owner.token, 'Test Webhook');

		const result = await executeWebhook(harness, webhook.id, webhook.token, {
			content: 'Hello from webhook!',
		});

		expect(result.response.status).toBe(204);
		expect(result.json).toBeNull();

		await deleteWebhook(harness, webhook.id, owner.token);
	});

	it('executes webhook with wait=true returns message', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook Exec Guild');
		const channelId = guild.system_channel_id!;

		const webhook = await createWebhook(harness, channelId, owner.token, 'Test Webhook');

		const result = await executeWebhook(
			harness,
			webhook.id,
			webhook.token,
			{
				content: 'Custom user',
				username: 'Custom Bot',
				wait: true,
			},
			200,
		);

		expect(result.response.status).toBe(200);
		expect(result.json).not.toBeNull();
		expect(result.json!.content).toBe('Custom user');

		await deleteWebhook(harness, webhook.id, owner.token);
	});

	it('rejects webhook execution without content', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook Exec Guild');
		const channelId = guild.system_channel_id!;

		const webhook = await createWebhook(harness, channelId, owner.token, 'Test Webhook');

		await createBuilderWithoutAuth(harness)
			.post(`/webhooks/${webhook.id}/${webhook.token}`)
			.body({content: ''})
			.expect(HTTP_STATUS.BAD_REQUEST, 'CANNOT_SEND_EMPTY_MESSAGE')
			.execute();

		await deleteWebhook(harness, webhook.id, owner.token);
	});

	it('rejects webhook execution with invalid token', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook Exec Guild');
		const channelId = guild.system_channel_id!;

		const webhook = await createWebhook(harness, channelId, owner.token, 'Test Webhook');

		await createBuilderWithoutAuth(harness)
			.post(`/webhooks/${webhook.id}/invalid_token`)
			.body({content: 'Test'})
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();

		await deleteWebhook(harness, webhook.id, owner.token);
	});
});
