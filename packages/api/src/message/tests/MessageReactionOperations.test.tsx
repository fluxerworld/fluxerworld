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
	getMessage,
	removeAllReactions,
	removeAllReactionsForEmoji,
	removeReaction,
	sendMessage,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message reaction operations', () => {
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

	describe('removeAllReactionsForEmoji', () => {
		it('removes only reactions for the specified emoji and preserves other reactions', async () => {
			const owner = await createTestAccount(harness);
			const member = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);
			await ensureSessionStarted(harness, member.token);

			const guild = await createGuild(harness, owner.token, 'Reaction Ops Guild');
			const channelId = guild.system_channel_id!;

			const invite = await createChannelInvite(harness, owner.token, channelId);
			await acceptInvite(harness, member.token, invite.code);

			const msg = await sendMessage(harness, owner.token, channelId, 'test message');

			await addReaction(harness, owner.token, channelId, msg.id, '👍');
			await addReaction(harness, member.token, channelId, msg.id, '👍');
			await addReaction(harness, owner.token, channelId, msg.id, '❤️');
			await addReaction(harness, member.token, channelId, msg.id, '❤️');
			await addReaction(harness, owner.token, channelId, msg.id, '🔥');

			let thumbsUpUsers = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}`)
				.execute();
			expect(thumbsUpUsers.length).toBe(2);

			let heartUsers = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('❤️')}`)
				.execute();
			expect(heartUsers.length).toBe(2);

			let fireUsers = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('🔥')}`)
				.execute();
			expect(fireUsers.length).toBe(1);

			await removeAllReactionsForEmoji(harness, owner.token, channelId, msg.id, '👍');

			thumbsUpUsers = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}`)
				.execute();
			expect(thumbsUpUsers.length).toBe(0);

			heartUsers = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('❤️')}`)
				.execute();
			expect(heartUsers.length).toBe(2);

			fireUsers = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('🔥')}`)
				.execute();
			expect(fireUsers.length).toBe(1);

			const updatedMsg = await getMessage(harness, owner.token, channelId, msg.id);
			expect(updatedMsg.reactions).toBeDefined();
			expect(updatedMsg.reactions).not.toBeNull();
			expect(updatedMsg.reactions!.length).toBe(2);

			const emojiNames = updatedMsg.reactions!.map((r) => r.emoji.name);
			expect(emojiNames).toContain('❤️');
			expect(emojiNames).toContain('🔥');
			expect(emojiNames).not.toContain('👍');
		});

		it('removes reactions for emoji with skin tone modifier', async () => {
			const owner = await createTestAccount(harness);
			const member = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);
			await ensureSessionStarted(harness, member.token);

			const guild = await createGuild(harness, owner.token, 'Reaction Ops Guild');
			const channelId = guild.system_channel_id!;

			const invite = await createChannelInvite(harness, owner.token, channelId);
			await acceptInvite(harness, member.token, invite.code);

			const msg = await sendMessage(harness, owner.token, channelId, 'test message');

			await addReaction(harness, owner.token, channelId, msg.id, '🖖🏿');
			await addReaction(harness, member.token, channelId, msg.id, '🖖🏿');
			await addReaction(harness, owner.token, channelId, msg.id, '👋');

			let vulcanUsers = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('🖖🏿')}`)
				.execute();
			expect(vulcanUsers.length).toBe(2);

			await removeAllReactionsForEmoji(harness, owner.token, channelId, msg.id, '🖖🏿');

			vulcanUsers = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('🖖🏿')}`)
				.execute();
			expect(vulcanUsers.length).toBe(0);

			const waveUsers = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👋')}`)
				.execute();
			expect(waveUsers.length).toBe(1);
		});

		it('handles removing last emoji on message correctly', async () => {
			const owner = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);

			const guild = await createGuild(harness, owner.token, 'Reaction Ops Guild');
			const channelId = guild.system_channel_id!;

			const msg = await sendMessage(harness, owner.token, channelId, 'test message');

			await addReaction(harness, owner.token, channelId, msg.id, '👍');

			let users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}`)
				.execute();
			expect(users.length).toBe(1);

			await removeAllReactionsForEmoji(harness, owner.token, channelId, msg.id, '👍');

			users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}`)
				.execute();
			expect(users.length).toBe(0);

			const updatedMsg = await getMessage(harness, owner.token, channelId, msg.id);
			expect(
				updatedMsg.reactions === undefined || updatedMsg.reactions === null || updatedMsg.reactions.length === 0,
			).toBe(true);
		});
	});

	describe('removeAllReactions', () => {
		it('removes all reactions from message', async () => {
			const owner = await createTestAccount(harness);
			const member = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);
			await ensureSessionStarted(harness, member.token);

			const guild = await createGuild(harness, owner.token, 'Reaction Ops Guild');
			const channelId = guild.system_channel_id!;

			const invite = await createChannelInvite(harness, owner.token, channelId);
			await acceptInvite(harness, member.token, invite.code);

			const msg = await sendMessage(harness, owner.token, channelId, 'test message');

			await addReaction(harness, owner.token, channelId, msg.id, '👍');
			await addReaction(harness, member.token, channelId, msg.id, '👍');
			await addReaction(harness, owner.token, channelId, msg.id, '❤️');
			await addReaction(harness, owner.token, channelId, msg.id, '🔥');

			await removeAllReactions(harness, owner.token, channelId, msg.id);

			const thumbsUpUsers = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}`)
				.execute();
			expect(thumbsUpUsers.length).toBe(0);

			const heartUsers = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('❤️')}`)
				.execute();
			expect(heartUsers.length).toBe(0);

			const fireUsers = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('🔥')}`)
				.execute();
			expect(fireUsers.length).toBe(0);

			const updatedMsg = await getMessage(harness, owner.token, channelId, msg.id);
			expect(
				updatedMsg.reactions === undefined || updatedMsg.reactions === null || updatedMsg.reactions.length === 0,
			).toBe(true);
		});
	});

	describe('removeReaction for specific user', () => {
		it('removes only specified user reaction and preserves others', async () => {
			const owner = await createTestAccount(harness);
			const member1 = await createTestAccount(harness);
			const member2 = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);
			await ensureSessionStarted(harness, member1.token);
			await ensureSessionStarted(harness, member2.token);

			const guild = await createGuild(harness, owner.token, 'Reaction Ops Guild');
			const channelId = guild.system_channel_id!;

			const invite = await createChannelInvite(harness, owner.token, channelId);
			await acceptInvite(harness, member1.token, invite.code);
			await acceptInvite(harness, member2.token, invite.code);

			const msg = await sendMessage(harness, owner.token, channelId, 'test message');

			await addReaction(harness, owner.token, channelId, msg.id, '👍');
			await addReaction(harness, member1.token, channelId, msg.id, '👍');
			await addReaction(harness, member2.token, channelId, msg.id, '👍');

			let users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}`)
				.execute();
			expect(users.length).toBe(3);

			await removeReaction(harness, owner.token, channelId, msg.id, '👍', member1.userId);

			users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}`)
				.execute();
			expect(users.length).toBe(2);

			const userIds = users.map((u) => u.id);
			expect(userIds).toContain(owner.userId);
			expect(userIds).toContain(member2.userId);
			expect(userIds).not.toContain(member1.userId);
		});
	});

	describe('reaction idempotency', () => {
		it('adding same reaction twice is idempotent', async () => {
			const owner = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);

			const guild = await createGuild(harness, owner.token, 'Reaction Ops Guild');
			const channelId = guild.system_channel_id!;

			const msg = await sendMessage(harness, owner.token, channelId, 'test message');

			await addReaction(harness, owner.token, channelId, msg.id, '👍');
			await addReaction(harness, owner.token, channelId, msg.id, '👍');

			const users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}`)
				.execute();
			expect(users.length).toBe(1);
			expect(users[0].id).toBe(owner.userId);

			const message = await getMessage(harness, owner.token, channelId, msg.id);
			expect(message.reactions).toBeDefined();
			expect(message.reactions!.length).toBe(1);
			expect(message.reactions![0].count).toBe(1);
		});
	});

	describe('reaction counts', () => {
		it('accurately tracks reaction counts with multiple users', async () => {
			const owner = await createTestAccount(harness);
			const member1 = await createTestAccount(harness);
			const member2 = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);
			await ensureSessionStarted(harness, member1.token);
			await ensureSessionStarted(harness, member2.token);

			const guild = await createGuild(harness, owner.token, 'Reaction Counts Guild');
			const channelId = guild.system_channel_id!;

			const invite = await createChannelInvite(harness, owner.token, channelId);
			await acceptInvite(harness, member1.token, invite.code);
			await acceptInvite(harness, member2.token, invite.code);

			const msg = await sendMessage(harness, owner.token, channelId, 'test message');

			await addReaction(harness, owner.token, channelId, msg.id, '👍');
			await addReaction(harness, member1.token, channelId, msg.id, '👍');
			await addReaction(harness, member2.token, channelId, msg.id, '👍');

			await addReaction(harness, owner.token, channelId, msg.id, '❤️');
			await addReaction(harness, member1.token, channelId, msg.id, '❤️');

			let message = await getMessage(harness, owner.token, channelId, msg.id);
			expect(message.reactions).toBeDefined();
			expect(message.reactions!.length).toBe(2);

			const thumbsUp = message.reactions!.find((r) => r.emoji.name === '👍');
			const heart = message.reactions!.find((r) => r.emoji.name === '❤️');
			expect(thumbsUp?.count).toBe(3);
			expect(heart?.count).toBe(2);

			await removeReaction(harness, member2.token, channelId, msg.id, '👍');

			message = await getMessage(harness, owner.token, channelId, msg.id);
			const updatedThumbsUp = message.reactions!.find((r) => r.emoji.name === '👍');
			expect(updatedThumbsUp?.count).toBe(2);
		});
	});

	describe('multiple emojis on same message', () => {
		it('supports multiple different emojis from same user', async () => {
			const owner = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);

			const guild = await createGuild(harness, owner.token, 'Multi Emoji Guild');
			const channelId = guild.system_channel_id!;

			const msg = await sendMessage(harness, owner.token, channelId, 'test message');

			await addReaction(harness, owner.token, channelId, msg.id, '👍');
			await addReaction(harness, owner.token, channelId, msg.id, '❤️');
			await addReaction(harness, owner.token, channelId, msg.id, '🔥');
			await addReaction(harness, owner.token, channelId, msg.id, '😂');

			const message = await getMessage(harness, owner.token, channelId, msg.id);
			expect(message.reactions).toBeDefined();
			expect(message.reactions!.length).toBe(4);

			const emojiNames = message.reactions!.map((r) => r.emoji.name);
			expect(emojiNames).toContain('👍');
			expect(emojiNames).toContain('❤️');
			expect(emojiNames).toContain('🔥');
			expect(emojiNames).toContain('😂');

			for (const reaction of message.reactions!) {
				expect(reaction.count).toBe(1);
				expect(reaction.me).toBe(true);
			}
		});
	});
});
