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
import {
	acceptInvite,
	createChannelInvite,
	createEmoji,
	createGuildWithMember,
	getPngDataUrl,
} from '@fluxer/api/src/emoji/tests/EmojiTestUtils';
import {
	addReaction,
	createGuild,
	createMessageHarness,
	ensureSessionStarted,
	removeReaction,
	sendMessage,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {MAX_REACTIONS_PER_MESSAGE} from '@fluxer/constants/src/LimitConstants';
import type {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Emoji reactions', () => {
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

	describe('Add reaction', () => {
		it('adds reaction with guild emoji', async () => {
			const owner = await createTestAccount(harness);
			await ensureSessionStarted(harness, owner.token);

			const guild = await createGuild(harness, owner.token, 'Emoji Reaction Guild');
			const channelId = guild.system_channel_id!;

			const emoji = await createEmoji(harness, owner.token, guild.id, {
				name: 'testreaction',
				image: getPngDataUrl(),
			});

			const msg = await sendMessage(harness, owner.token, channelId, 'test message');

			const customEmojiString = `${emoji.name}:${emoji.id}`;
			await addReaction(harness, owner.token, channelId, msg.id, customEmojiString);

			const users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent(customEmojiString)}`)
				.execute();

			expect(users.length).toBe(1);
			expect(users[0].id).toBe(owner.userId);
		});

		it('adds reaction with unicode emoji', async () => {
			const owner = await createTestAccount(harness);
			await ensureSessionStarted(harness, owner.token);

			const guild = await createGuild(harness, owner.token, 'Emoji Reaction Guild');
			const channelId = guild.system_channel_id!;

			const msg = await sendMessage(harness, owner.token, channelId, 'test message');

			await addReaction(harness, owner.token, channelId, msg.id, '👍');

			const users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}`)
				.execute();

			expect(users.length).toBe(1);
			expect(users[0].id).toBe(owner.userId);
		});
	});

	describe('Reaction limit enforcement', () => {
		it('enforces max reactions per message limit', async () => {
			const owner = await createTestAccount(harness);
			await ensureSessionStarted(harness, owner.token);

			const guild = await createGuild(harness, owner.token, 'Reaction Limit Guild');
			const channelId = guild.system_channel_id!;

			const msg = await sendMessage(harness, owner.token, channelId, 'test message');

			const unicodeEmojis = [
				'👍',
				'👎',
				'❤️',
				'🔥',
				'😂',
				'😢',
				'😮',
				'😡',
				'🎉',
				'👏',
				'🙌',
				'💯',
				'✅',
				'❌',
				'⭐',
				'🌟',
				'💪',
				'🤔',
				'👀',
				'🙏',
				'💕',
				'🥳',
				'🤣',
				'😍',
				'🤯',
				'😱',
				'🥺',
				'😎',
				'🤩',
				'🥰',
			];

			for (let i = 0; i < MAX_REACTIONS_PER_MESSAGE; i++) {
				await addReaction(harness, owner.token, channelId, msg.id, unicodeEmojis[i]);
			}

			await createBuilder(harness, owner.token)
				.put(`/channels/${channelId}/messages/${msg.id}/reactions/${encodeURIComponent('🆕')}/@me`)
				.body(null)
				.expect(400, 'MAX_REACTIONS')
				.execute();
		});
	});

	describe('Remove reaction', () => {
		it('allows member to remove own reaction', async () => {
			const owner = await createTestAccount(harness);
			const member = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);
			await ensureSessionStarted(harness, member.token);

			const {channel} = await createGuildWithMember(harness, owner, member);

			const msg = await sendMessage(harness, owner.token, channel.id, 'reaction test');

			await addReaction(harness, member.token, channel.id, msg.id, '👍');

			let users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channel.id}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}`)
				.execute();

			expect(users.length).toBe(1);

			await removeReaction(harness, member.token, channel.id, msg.id, '👍');

			users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channel.id}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}`)
				.execute();

			expect(users.length).toBe(0);
		});

		it('allows owner to remove other users reaction with MANAGE_MESSAGES', async () => {
			const owner = await createTestAccount(harness);
			const member = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);
			await ensureSessionStarted(harness, member.token);

			const {channel} = await createGuildWithMember(harness, owner, member);

			const msg = await sendMessage(harness, owner.token, channel.id, 'reaction test');

			await addReaction(harness, member.token, channel.id, msg.id, '❤️');

			let users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channel.id}/messages/${msg.id}/reactions/${encodeURIComponent('❤️')}`)
				.execute();

			expect(users.length).toBe(1);

			await removeReaction(harness, owner.token, channel.id, msg.id, '❤️', member.userId);

			users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channel.id}/messages/${msg.id}/reactions/${encodeURIComponent('❤️')}`)
				.execute();

			expect(users.length).toBe(0);
		});

		it('prevents member without MANAGE_MESSAGES from removing others reactions', async () => {
			const owner = await createTestAccount(harness);
			const member = await createTestAccount(harness);
			const otherMember = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);
			await ensureSessionStarted(harness, member.token);
			await ensureSessionStarted(harness, otherMember.token);

			const {channel} = await createGuildWithMember(harness, owner, member);

			const invite = await createChannelInvite(harness, owner.token, channel.id);
			await acceptInvite(harness, otherMember.token, invite.code);

			const msg = await sendMessage(harness, owner.token, channel.id, 'reaction test');

			await addReaction(harness, otherMember.token, channel.id, msg.id, '🔥');

			await createBuilder(harness, member.token)
				.delete(
					`/channels/${channel.id}/messages/${msg.id}/reactions/${encodeURIComponent('🔥')}/${otherMember.userId}`,
				)
				.expect(403, 'MISSING_PERMISSIONS')
				.execute();
		});
	});

	describe('List users who reacted', () => {
		it('lists all users who reacted with an emoji', async () => {
			const owner = await createTestAccount(harness);
			const member1 = await createTestAccount(harness);
			const member2 = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);
			await ensureSessionStarted(harness, member1.token);
			await ensureSessionStarted(harness, member2.token);

			const {channel} = await createGuildWithMember(harness, owner, member1);

			const invite = await createChannelInvite(harness, owner.token, channel.id);
			await acceptInvite(harness, member2.token, invite.code);

			const msg = await sendMessage(harness, owner.token, channel.id, 'reaction test');

			await addReaction(harness, owner.token, channel.id, msg.id, '🎉');
			await addReaction(harness, member1.token, channel.id, msg.id, '🎉');
			await addReaction(harness, member2.token, channel.id, msg.id, '🎉');

			const users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channel.id}/messages/${msg.id}/reactions/${encodeURIComponent('🎉')}`)
				.execute();

			expect(users.length).toBe(3);

			const userIds = users.map((u) => u.id);
			expect(userIds).toContain(owner.userId);
			expect(userIds).toContain(member1.userId);
			expect(userIds).toContain(member2.userId);
		});

		it('lists users who reacted with guild emoji', async () => {
			const owner = await createTestAccount(harness);
			const member = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);
			await ensureSessionStarted(harness, member.token);

			const {guild, channel} = await createGuildWithMember(harness, owner, member);

			const emoji = await createEmoji(harness, owner.token, guild.id, {
				name: 'listtest',
				image: getPngDataUrl(),
			});

			const msg = await sendMessage(harness, owner.token, channel.id, 'reaction test');

			const customEmojiString = `${emoji.name}:${emoji.id}`;
			await addReaction(harness, owner.token, channel.id, msg.id, customEmojiString);
			await addReaction(harness, member.token, channel.id, msg.id, customEmojiString);

			const users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channel.id}/messages/${msg.id}/reactions/${encodeURIComponent(customEmojiString)}`)
				.execute();

			expect(users.length).toBe(2);

			const userIds = users.map((u) => u.id);
			expect(userIds).toContain(owner.userId);
			expect(userIds).toContain(member.userId);
		});

		it('supports limit parameter for listing reaction users', async () => {
			const owner = await createTestAccount(harness);
			const member1 = await createTestAccount(harness);
			const member2 = await createTestAccount(harness);

			await ensureSessionStarted(harness, owner.token);
			await ensureSessionStarted(harness, member1.token);
			await ensureSessionStarted(harness, member2.token);

			const {channel} = await createGuildWithMember(harness, owner, member1);

			const invite = await createChannelInvite(harness, owner.token, channel.id);
			await acceptInvite(harness, member2.token, invite.code);

			const msg = await sendMessage(harness, owner.token, channel.id, 'reaction test');

			await addReaction(harness, owner.token, channel.id, msg.id, '👍');
			await addReaction(harness, member1.token, channel.id, msg.id, '👍');
			await addReaction(harness, member2.token, channel.id, msg.id, '👍');

			const users = await createBuilder<Array<UserPartialResponse>>(harness, owner.token)
				.get(`/channels/${channel.id}/messages/${msg.id}/reactions/${encodeURIComponent('👍')}?limit=2`)
				.execute();

			expect(users.length).toBe(2);
		});
	});
});
