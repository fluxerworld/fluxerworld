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
	addReaction,
	createChannelInvite,
	createGuild,
	createMessageHarness,
	createTestAccount,
	ensureSessionStarted,
	removeAllReactions,
	removeAllReactionsForEmoji,
	removeReaction,
	sendMessage,
	updateChannelPermissions,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message reaction permissions', () => {
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

	it('allows member to remove own reaction', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		await ensureSessionStarted(harness, owner.token);
		await ensureSessionStarted(harness, member.token);

		const guild = await createGuild(harness, owner.token, 'Reaction Perms Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const msg = await sendMessage(harness, owner.token, channelId, 'reaction test');

		await addReaction(harness, member.token, channelId, msg.id, '👍');

		await removeReaction(harness, member.token, channelId, msg.id, '👍');
	});

	it('allows owner to remove other user reaction', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		await ensureSessionStarted(harness, owner.token);
		await ensureSessionStarted(harness, member.token);

		const guild = await createGuild(harness, owner.token, 'Reaction Perms Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const msg = await sendMessage(harness, owner.token, channelId, 'reaction test');

		await addReaction(harness, member.token, channelId, msg.id, '❤️');

		await removeReaction(harness, owner.token, channelId, msg.id, '❤️', member.userId);
	});

	it('allows member without ADD_REACTIONS to stack existing reaction but not add new', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		await ensureSessionStarted(harness, owner.token);
		await ensureSessionStarted(harness, member.token);

		const guild = await createGuild(harness, owner.token, 'Reaction Perms Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const msg = await sendMessage(harness, owner.token, channelId, 'reaction test');

		const denyAddReactions = BigInt(1) << BigInt(6);
		await updateChannelPermissions(harness, owner.token, channelId, member.userId, {
			type: 1,
			deny: denyAddReactions.toString(),
		});

		await addReaction(harness, owner.token, channelId, msg.id, '🔥');

		await addReaction(harness, member.token, channelId, msg.id, '🔥');

		let errorOccurred = false;
		try {
			await addReaction(harness, member.token, channelId, msg.id, '😎');
		} catch (error: unknown) {
			errorOccurred = true;
			if (error instanceof Error) {
				const match = /Expected 204, got (\d+)/.exec(error.message);
				if (match) {
					const status = parseInt(match[1], 10);
					expect(status).toBe(403);
				}
			}
		}
		expect(errorOccurred).toBe(true);

		await updateChannelPermissions(harness, owner.token, channelId, member.userId, {
			type: 1,
		});
	});

	it('allows owner to remove all reactions for emoji', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		await ensureSessionStarted(harness, owner.token);
		await ensureSessionStarted(harness, member.token);

		const guild = await createGuild(harness, owner.token, 'Reaction Perms Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const msg = await sendMessage(harness, owner.token, channelId, 'reaction test');

		await addReaction(harness, member.token, channelId, msg.id, '🎉');
		await addReaction(harness, owner.token, channelId, msg.id, '🎉');

		await removeAllReactionsForEmoji(harness, owner.token, channelId, msg.id, '🎉');
	});

	it('allows owner to remove all reactions', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		await ensureSessionStarted(harness, owner.token);
		await ensureSessionStarted(harness, member.token);

		const guild = await createGuild(harness, owner.token, 'Reaction Perms Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const msg = await sendMessage(harness, owner.token, channelId, 'reaction test');

		await addReaction(harness, member.token, channelId, msg.id, '👍');
		await addReaction(harness, owner.token, channelId, msg.id, '❤️');

		await removeAllReactions(harness, owner.token, channelId, msg.id);
	});
});
