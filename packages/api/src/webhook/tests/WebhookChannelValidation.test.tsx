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
import {createFriendship} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {createChannel, createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS, TEST_IDS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {createWebhook, deleteWebhook} from '@fluxer/api/src/webhook/tests/WebhookTestUtils';
import {afterEach, beforeEach, describe, it} from 'vitest';

describe('Webhook channel validation', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	describe('Create webhook channel validation', () => {
		it('rejects creating webhook in nonexistent channel', async () => {
			const owner = await createTestAccount(harness);
			await createGuild(harness, owner.token, 'Webhook Channel Validation Guild');

			await createBuilder(harness, owner.token)
				.post(`/channels/${TEST_IDS.NONEXISTENT_CHANNEL}/webhooks`)
				.body({name: 'Invalid Channel Webhook'})
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();
		});

		it('rejects creating webhook in DM channel', async () => {
			const owner = await createTestAccount(harness);
			const target = await createTestAccount(harness);

			await createFriendship(harness, owner, target);

			const dmChannel = await createBuilder<{id: string}>(harness, owner.token)
				.post('/users/@me/channels')
				.body({recipient_id: target.userId})
				.execute();

			await createBuilder(harness, owner.token)
				.post(`/channels/${dmChannel.id}/webhooks`)
				.body({name: 'DM Webhook'})
				.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_CHANNEL')
				.execute();
		});
	});

	describe('Move webhook channel validation', () => {
		it('rejects moving webhook to channel in different guild', async () => {
			const owner = await createTestAccount(harness);
			const guild1 = await createGuild(harness, owner.token, 'Guild 1');
			const guild2 = await createGuild(harness, owner.token, 'Guild 2');

			const channel1 = guild1.system_channel_id!;
			const channel2 = guild2.system_channel_id!;

			const webhook = await createWebhook(harness, channel1, owner.token, 'Cross Guild Webhook');

			await createBuilder(harness, owner.token)
				.patch(`/webhooks/${webhook.id}`)
				.body({channel_id: channel2})
				.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_CHANNEL')
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('rejects moving webhook to nonexistent channel', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Webhook Move Guild');
			const channelId = guild.system_channel_id!;

			const webhook = await createWebhook(harness, channelId, owner.token, 'Move Invalid Webhook');

			await createBuilder(harness, owner.token)
				.patch(`/webhooks/${webhook.id}`)
				.body({channel_id: TEST_IDS.NONEXISTENT_CHANNEL})
				.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_CHANNEL')
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('rejects moving webhook by token', async () => {
			const owner = await createTestAccount(harness);
			const guild1 = await createGuild(harness, owner.token, 'Token Guild 1');
			const guild2 = await createGuild(harness, owner.token, 'Token Guild 2');

			const channel1 = guild1.system_channel_id!;
			const channel2 = guild2.system_channel_id!;

			const webhook = await createWebhook(harness, channel1, owner.token, 'Token Cross Guild Webhook');

			await createBuilderWithoutAuth(harness)
				.patch(`/webhooks/${webhook.id}/${webhook.token}`)
				.body({channel_id: channel2})
				.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});

		it('allows moving webhook to valid channel in same guild', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Valid Move Guild');
			const channel1 = guild.system_channel_id!;
			const channel2 = (await createChannel(harness, owner.token, guild.id, 'target-channel')).id;

			const webhook = await createWebhook(harness, channel1, owner.token, 'Valid Move Webhook');

			await createBuilder(harness, owner.token)
				.patch(`/webhooks/${webhook.id}`)
				.body({channel_id: channel2})
				.expect(HTTP_STATUS.OK)
				.execute();

			await deleteWebhook(harness, webhook.id, owner.token);
		});
	});

	describe('List webhooks channel validation', () => {
		it('rejects listing webhooks for nonexistent channel', async () => {
			const owner = await createTestAccount(harness);
			await createGuild(harness, owner.token, 'List Validation Guild');

			await createBuilder(harness, owner.token)
				.get(`/channels/${TEST_IDS.NONEXISTENT_CHANNEL}/webhooks`)
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();
		});

		it('rejects listing webhooks for DM channel', async () => {
			const owner = await createTestAccount(harness);
			const target = await createTestAccount(harness);

			await createFriendship(harness, owner, target);

			const dmChannel = await createBuilder<{id: string}>(harness, owner.token)
				.post('/users/@me/channels')
				.body({recipient_id: target.userId})
				.execute();

			await createBuilder(harness, owner.token)
				.get(`/channels/${dmChannel.id}/webhooks`)
				.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_CHANNEL')
				.execute();
		});

		it('rejects listing webhooks for nonexistent guild', async () => {
			const owner = await createTestAccount(harness);
			await createGuild(harness, owner.token, 'Guild List Validation');

			await createBuilder(harness, owner.token)
				.get(`/guilds/${TEST_IDS.NONEXISTENT_GUILD}/webhooks`)
				.expect(HTTP_STATUS.NOT_FOUND)
				.execute();
		});
	});
});
