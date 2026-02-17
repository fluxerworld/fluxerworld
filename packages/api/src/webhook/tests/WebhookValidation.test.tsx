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
import {createChannel, createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS, TEST_IDS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterEach, beforeEach, describe, it} from 'vitest';

describe('Webhook validation', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	it('rejects webhook creation without name', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook Validation Guild');
		const channelId = guild.system_channel_id ?? (await createChannel(harness, owner.token, guild.id, 'general')).id;

		await createBuilder(harness, owner.token)
			.post(`/channels/${channelId}/webhooks`)
			.body({})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects webhook creation with invalid avatar', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Webhook Validation Guild');
		const channelId = guild.system_channel_id ?? (await createChannel(harness, owner.token, guild.id, 'general')).id;

		await createBuilder(harness, owner.token)
			.post(`/channels/${channelId}/webhooks`)
			.body({
				name: 'Test',
				avatar: 'invalid-base64',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	it('rejects getting nonexistent webhook', async () => {
		const owner = await createTestAccount(harness);
		await createGuild(harness, owner.token, 'Webhook Validation Guild');

		await createBuilder(harness, owner.token)
			.get(`/webhooks/${TEST_IDS.NONEXISTENT_WEBHOOK}`)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('rejects updating nonexistent webhook', async () => {
		const owner = await createTestAccount(harness);
		await createGuild(harness, owner.token, 'Webhook Validation Guild');

		await createBuilder(harness, owner.token)
			.patch(`/webhooks/${TEST_IDS.NONEXISTENT_WEBHOOK}`)
			.body({name: 'Updated'})
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	it('rejects deleting nonexistent webhook', async () => {
		const owner = await createTestAccount(harness);
		await createGuild(harness, owner.token, 'Webhook Validation Guild');

		await createBuilder(harness, owner.token)
			.delete(`/webhooks/${TEST_IDS.NONEXISTENT_WEBHOOK}`)
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});
});
