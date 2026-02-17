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

import {loadFixture, sendMessageWithAttachments} from '@fluxer/api/src/channel/tests/AttachmentTestUtils';
import {
	acceptInvite,
	createChannelInvite,
	createGuild,
	createMessageHarness,
	createTestAccount,
	ensureSessionStarted,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import type {MessageResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Allowed mentions', () => {
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

	it('does not include user mentions when allowed_mentions.parse is empty', async () => {
		const sender = await createTestAccount(harness);
		const mentioned = await createTestAccount(harness);

		await ensureSessionStarted(harness, sender.token);
		await ensureSessionStarted(harness, mentioned.token);

		const guild = await createGuild(harness, sender.token, 'Allowed Mentions: parse empty');
		const channelId = guild.system_channel_id!;
		const invite = await createChannelInvite(harness, sender.token, channelId);
		await acceptInvite(harness, mentioned.token, invite.code);

		const content = `test <@${mentioned.userId}>`;
		const message = await createBuilder<MessageResponse>(harness, sender.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				content,
				allowed_mentions: {parse: []},
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(message.mentions ?? []).toHaveLength(0);
		expect(message.mention_roles ?? []).toHaveLength(0);
		expect(message.mention_everyone).toBe(false);
	});

	it("includes user mentions when allowed_mentions.parse contains 'users'", async () => {
		const sender = await createTestAccount(harness);
		const mentioned = await createTestAccount(harness);

		await ensureSessionStarted(harness, sender.token);
		await ensureSessionStarted(harness, mentioned.token);

		const guild = await createGuild(harness, sender.token, 'Allowed Mentions: parse users');
		const channelId = guild.system_channel_id!;
		const invite = await createChannelInvite(harness, sender.token, channelId);
		await acceptInvite(harness, mentioned.token, invite.code);

		const content = `test <@${mentioned.userId}>`;
		const message = await createBuilder<MessageResponse>(harness, sender.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				content,
				allowed_mentions: {parse: ['users']},
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(message.mentions?.some((user) => user.id === mentioned.userId)).toBe(true);
		expect(message.mention_everyone).toBe(false);
	});

	it('does not treat replied_user as disabling other mentions', async () => {
		const sender = await createTestAccount(harness);
		const mentioned = await createTestAccount(harness);

		await ensureSessionStarted(harness, sender.token);
		await ensureSessionStarted(harness, mentioned.token);

		const guild = await createGuild(harness, sender.token, 'Allowed Mentions: replied_user only');
		const channelId = guild.system_channel_id!;
		const invite = await createChannelInvite(harness, sender.token, channelId);
		await acceptInvite(harness, mentioned.token, invite.code);

		const content = `test <@${mentioned.userId}>`;
		const message = await createBuilder<MessageResponse>(harness, sender.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				content,
				allowed_mentions: {replied_user: false},
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(message.mentions?.some((user) => user.id === mentioned.userId)).toBe(true);
	});

	it('mentions the referenced author for attachment-only replies by default', async () => {
		const replier = await createTestAccount(harness);
		const referencedAuthor = await createTestAccount(harness);

		await ensureSessionStarted(harness, replier.token);
		await ensureSessionStarted(harness, referencedAuthor.token);

		const guild = await createGuild(harness, replier.token, 'Allowed Mentions: attachment reply');
		const channelId = guild.system_channel_id!;
		const invite = await createChannelInvite(harness, replier.token, channelId);
		await acceptInvite(harness, referencedAuthor.token, invite.code);

		const fixture = loadFixture('yeah.png');
		const original = await sendMessageWithAttachments(
			harness,
			referencedAuthor.token,
			channelId,
			{
				content: '',
				attachments: [{id: 0, filename: 'original.png'}],
			},
			[{index: 0, filename: 'original.png', data: fixture}],
		);

		expect(original.response.status).toBe(200);

		const reply = await sendMessageWithAttachments(
			harness,
			replier.token,
			channelId,
			{
				content: '',
				message_reference: {
					channel_id: channelId,
					message_id: original.json.id,
					type: 0,
				},
				attachments: [{id: 0, filename: 'reply.png'}],
			},
			[{index: 0, filename: 'reply.png', data: fixture}],
		);

		expect(reply.response.status).toBe(200);
		expect(reply.json.mentions?.some((user) => user.id === referencedAuthor.userId)).toBe(true);
	});

	it('supports whitelisting specific users when parse is omitted', async () => {
		const sender = await createTestAccount(harness);
		const allowedUser = await createTestAccount(harness);
		const blockedUser = await createTestAccount(harness);

		await ensureSessionStarted(harness, sender.token);
		await ensureSessionStarted(harness, allowedUser.token);
		await ensureSessionStarted(harness, blockedUser.token);

		const guild = await createGuild(harness, sender.token, 'Allowed Mentions: explicit users');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, sender.token, channelId);
		await acceptInvite(harness, allowedUser.token, invite.code);
		await acceptInvite(harness, blockedUser.token, invite.code);

		const content = `test <@${allowedUser.userId}> <@${blockedUser.userId}>`;
		const message = await createBuilder<MessageResponse>(harness, sender.token)
			.post(`/channels/${channelId}/messages`)
			.body({
				content,
				allowed_mentions: {users: [allowedUser.userId]},
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const mentionedIds = (message.mentions ?? []).map((user) => user.id);
		expect(mentionedIds).toEqual([allowedUser.userId]);
	});
});
