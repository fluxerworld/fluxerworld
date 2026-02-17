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
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Message forwarding validation errors guild mismatch', () => {
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

	it('rejects forwarding with mismatched guild ID', async () => {
		const user = await createTestAccount(harness);

		await ensureSessionStarted(harness, user.token);

		const guildA = await createGuild(harness, user.token, 'Guild A');
		const guildB = await createGuild(harness, user.token, 'Guild B');

		const targetChannel = await createBuilder<{id: string}>(harness, user.token)
			.post(`/guilds/${guildA.id}/channels`)
			.body({
				name: 'forward-target',
				type: 0,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const originalMessage = await sendMessage(harness, user.token, guildA.system_channel_id!, 'Source message');

		const payload = {
			message_reference: {
				channel_id: guildA.system_channel_id!,
				message_id: originalMessage.id,
				guild_id: guildB.id,
				type: 1,
			},
		};

		await createBuilder(harness, user.token)
			.post(`/channels/${targetChannel.id}/messages`)
			.body(payload)
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});
});
