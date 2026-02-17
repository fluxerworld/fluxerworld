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
	updateChannelPermissions,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {MessageReferenceTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Message forwarding permissions', () => {
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

	it('rejects forwarding message from inaccessible DM channel', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);
		const user3 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);
		await ensureSessionStarted(harness, user3.token);

		await createBuilder(harness, user1.token).post(`/users/@me/relationships/${user2.userId}`).body({}).execute();

		await createBuilder(harness, user2.token).put(`/users/@me/relationships/${user1.userId}`).body({}).execute();

		const guild = await createGuild(harness, user1.token, 'Test Guild');
		const invite = await createChannelInvite(harness, user1.token, guild.system_channel_id!);
		await acceptInvite(harness, user2.token, invite.code);
		await acceptInvite(harness, user3.token, invite.code);

		const channel = await createDMChannel(harness, user1.token, user2.userId);
		const originalMessage = await sendMessage(harness, user1.token, channel.id, 'Private message');

		const user3Channel = await createDMChannel(harness, user3.token, user1.userId);

		const forwardPayload = {
			message_reference: {
				message_id: originalMessage.id,
				channel_id: channel.id,
				type: MessageReferenceTypes.FORWARD,
			},
		};

		await createBuilder(harness, user3.token)
			.post(`/channels/${user3Channel.id}/messages`)
			.body(forwardPayload)
			.expect(HTTP_STATUS.NOT_FOUND, APIErrorCodes.UNKNOWN_CHANNEL)
			.execute();
	});

	it('rejects forwarding message from hidden guild channel', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		await ensureSessionStarted(harness, owner.token);
		await ensureSessionStarted(harness, member.token);

		const guild = await createGuild(harness, owner.token, 'Forwarding visibility test guild');
		const invite = await createChannelInvite(harness, owner.token, guild.system_channel_id!);
		await acceptInvite(harness, member.token, invite.code);

		const sourceChannel = await createBuilder<{id: string}>(harness, owner.token)
			.post(`/guilds/${guild.id}/channels`)
			.body({
				name: 'forward-source',
				type: 0,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const destinationChannel = await createBuilder<{id: string}>(harness, owner.token)
			.post(`/guilds/${guild.id}/channels`)
			.body({
				name: 'forward-destination',
				type: 0,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const originalMessage = await sendMessage(harness, owner.token, sourceChannel.id, 'Top secret source message');

		await updateChannelPermissions(harness, owner.token, sourceChannel.id, member.userId, {
			type: 1,
			deny: Permissions.VIEW_CHANNEL.toString(),
		});

		await createBuilder(harness, member.token)
			.post(`/channels/${destinationChannel.id}/messages`)
			.body({
				message_reference: {
					message_id: originalMessage.id,
					channel_id: sourceChannel.id,
					guild_id: guild.id,
					type: MessageReferenceTypes.FORWARD,
				},
			})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});
});
