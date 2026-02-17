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

import {
	createGuild,
	createMessageHarness,
	createTestAccount,
	ensureSessionStarted,
	sendMessage,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message forwarding in guild channels', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createMessageHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	it('forwards message within guild channels', async () => {
		const owner = await createTestAccount(harness);

		await ensureSessionStarted(harness, owner.token);

		const guild = await createGuild(harness, owner.token, 'Forward Test Guild');

		const channel1 = await createBuilder<{id: string}>(harness, owner.token)
			.post(`/guilds/${guild.id}/channels`)
			.body({
				name: 'channel-one',
				type: 0,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const channel2 = await createBuilder<{id: string}>(harness, owner.token)
			.post(`/guilds/${guild.id}/channels`)
			.body({
				name: 'channel-two',
				type: 0,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const originalMessage = await sendMessage(harness, owner.token, channel1.id, 'Guild message to forward');

		const forwardPayload = {
			message_reference: {
				message_id: originalMessage.id,
				channel_id: channel1.id,
				guild_id: guild.id,
				type: 1,
			},
		};

		const forwardedMessage = await createBuilder<{id: string; message_snapshots?: Array<unknown>}>(harness, owner.token)
			.post(`/channels/${channel2.id}/messages`)
			.body(forwardPayload)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(forwardedMessage.id).toBeDefined();

		const fetchedMessage = await createBuilder<{id: string; message_snapshots?: Array<unknown>}>(harness, owner.token)
			.get(`/channels/${channel2.id}/messages/${forwardedMessage.id}`)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(fetchedMessage.message_snapshots).toBeDefined();
		expect(fetchedMessage.message_snapshots?.length).toBeGreaterThan(0);
	});
});
