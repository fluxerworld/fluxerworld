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
import {joinGuild} from '@fluxer/api/src/channel/tests/ScheduledMessageTestUtils';
import {createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {createChannelInvite, createWebhook, deleteWebhook} from '@fluxer/api/src/webhook/tests/WebhookTestUtils';
import {beforeAll, beforeEach, describe, it} from 'vitest';

describe('Webhook permissions', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	it('requires permissions to manage webhooks', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, `Webhook Security ${Date.now()}`);
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await joinGuild(harness, member.token, invite.code);

		const webhook = await createWebhook(harness, channelId, owner.token, 'Test Webhook');

		await createBuilder(harness, member.token)
			.post(`/channels/${channelId}/webhooks`)
			.body({name: 'Test Webhook'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();

		await createBuilder(harness, member.token)
			.get(`/channels/${channelId}/webhooks`)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();

		await createBuilder(harness, member.token)
			.patch(`/webhooks/${webhook.id}`)
			.body({name: 'Hacked'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();

		await createBuilder(harness, member.token)
			.delete(`/webhooks/${webhook.id}`)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();

		await deleteWebhook(harness, webhook.id, owner.token);
	});
});
