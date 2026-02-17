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
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {MessageFlags, MessageReferenceTypes} from '@fluxer/constants/src/ChannelConstants';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

interface ForwardedSnapshot {
	readonly embeds?: Array<unknown>;
	readonly flags: number;
}

interface ForwardedMessageResponse {
	readonly id: string;
	readonly message_snapshots?: Array<ForwardedSnapshot>;
}

describe('Message forwarding with suppressed embeds', () => {
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

	it('does not reveal suppressed embeds in forwarded snapshots', async () => {
		const owner = await createTestAccount(harness);

		await ensureSessionStarted(harness, owner.token);

		const guild = await createGuild(harness, owner.token, 'Forwarded suppress embed test guild');

		const sourceChannel = await createBuilder<{id: string}>(harness, owner.token)
			.post(`/guilds/${guild.id}/channels`)
			.body({
				name: 'source-channel',
				type: 0,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const destinationChannel = await createBuilder<{id: string}>(harness, owner.token)
			.post(`/guilds/${guild.id}/channels`)
			.body({
				name: 'destination-channel',
				type: 0,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const originalMessage = await createBuilder<{id: string; embeds?: Array<unknown>}>(harness, owner.token)
			.post(`/channels/${sourceChannel.id}/messages`)
			.body({
				embeds: [{title: 'This embed should stay suppressed'}],
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(originalMessage.embeds?.length ?? 0).toBeGreaterThan(0);

		const suppressedMessage = await createBuilder<{flags: number; embeds?: Array<unknown>}>(harness, owner.token)
			.patch(`/channels/${sourceChannel.id}/messages/${originalMessage.id}`)
			.body({
				flags: MessageFlags.SUPPRESS_EMBEDS,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect((suppressedMessage.flags & MessageFlags.SUPPRESS_EMBEDS) !== 0).toBe(true);
		expect(suppressedMessage.embeds?.length ?? 0).toBeGreaterThan(0);

		const forwardedMessage = await createBuilder<ForwardedMessageResponse>(harness, owner.token)
			.post(`/channels/${destinationChannel.id}/messages`)
			.body({
				message_reference: {
					message_id: originalMessage.id,
					channel_id: sourceChannel.id,
					guild_id: guild.id,
					type: MessageReferenceTypes.FORWARD,
				},
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const createdSnapshot = forwardedMessage.message_snapshots?.[0];
		expect(createdSnapshot).toBeDefined();
		expect((createdSnapshot!.flags & MessageFlags.SUPPRESS_EMBEDS) !== 0).toBe(true);
		expect(createdSnapshot?.embeds?.length ?? 0).toBe(0);

		const fetchedForward = await createBuilder<ForwardedMessageResponse>(harness, owner.token)
			.get(`/channels/${destinationChannel.id}/messages/${forwardedMessage.id}`)
			.expect(HTTP_STATUS.OK)
			.execute();

		const fetchedSnapshot = fetchedForward.message_snapshots?.[0];
		expect(fetchedSnapshot).toBeDefined();
		expect((fetchedSnapshot!.flags & MessageFlags.SUPPRESS_EMBEDS) !== 0).toBe(true);
		expect(fetchedSnapshot?.embeds?.length ?? 0).toBe(0);
	});
});
