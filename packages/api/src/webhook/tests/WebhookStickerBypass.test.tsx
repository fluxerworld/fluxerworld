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
import {createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {createWebhook, deleteWebhook} from '@fluxer/api/src/webhook/tests/WebhookTestUtils';
import {beforeAll, beforeEach, describe, it} from 'vitest';

describe('Webhook sticker bypass', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('webhook messages ignore sticker_ids', async () => {
		const user = await createTestAccount(harness);
		const guild = await createGuild(harness, user.token, 'Webhook Sticker Test Guild');
		const channelId = guild.system_channel_id!;

		const webhook = await createWebhook(harness, channelId, user.token, 'Sticker Test Webhook');

		await createBuilderWithoutAuth(harness)
			.post(`/webhooks/${webhook.id}/${webhook.token}`)
			.body({
				content: 'Webhook sticker test',
				sticker_ids: ['999999999999999999'],
			})
			.expect(204)
			.execute();

		await deleteWebhook(harness, webhook.id, user.token);
	});
});
