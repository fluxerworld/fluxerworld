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
	acceptInvite,
	createChannelInvite,
	createDMChannel,
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

describe('Message forwarding between channels', () => {
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

	it('forwards message between DM channels', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);
		const user3 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);
		await ensureSessionStarted(harness, user3.token);

		const guild = await createGuild(harness, user1.token, 'Test Guild');
		const invite = await createChannelInvite(harness, user1.token, guild.system_channel_id!);
		await acceptInvite(harness, user2.token, invite.code);
		await acceptInvite(harness, user3.token, invite.code);

		const channel1 = await createDMChannel(harness, user1.token, user2.userId);
		const channel2 = await createDMChannel(harness, user1.token, user3.userId);

		const originalMessage = await sendMessage(harness, user1.token, channel1.id, 'Original message to forward');

		const forwardPayload = {
			message_reference: {
				message_id: originalMessage.id,
				channel_id: channel1.id,
				type: 1,
			},
		};

		const forwardedMessage = await createBuilder<{id: string; message_snapshots?: Array<unknown>}>(harness, user1.token)
			.post(`/channels/${channel2.id}/messages`)
			.body(forwardPayload)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(forwardedMessage.id).toBeDefined();
		expect(forwardedMessage.message_snapshots).toBeDefined();
		expect(forwardedMessage.message_snapshots?.length).toBeGreaterThan(0);
	});
});
