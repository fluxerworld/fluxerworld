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
import {createGuild, loadFixture, sendMessageWithAttachments} from '@fluxer/api/src/channel/tests/AttachmentTestUtils';
import {addMemberRole, createRole} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {
	acceptInvite,
	createChannelInvite,
	createDMChannel,
	editMessageWithAttachments,
	ensureSessionStarted,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {MessageFlags, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('Message edit attachment description', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('author can edit own attachment description', async () => {
		const author = await createTestAccount(harness);
		await ensureSessionStarted(harness, author.token);
		const guild = await createGuild(harness, author.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const fileData = loadFixture('yeah.png');
		const {json: msg} = await sendMessageWithAttachments(
			harness,
			author.token,
			channelId,
			{
				content: 'Message with attachment',
				attachments: [{id: 0, filename: 'yeah.png'}],
			},
			[{index: 0, filename: 'yeah.png', data: fileData}],
		);

		expect(msg.attachments).toBeDefined();
		expect(msg.attachments).not.toBeNull();
		expect(msg.attachments!.length).toBe(1);

		const edited = await editMessageWithAttachments(harness, author.token, channelId, msg.id, {
			content: 'Message with edited attachment',
			attachments: [{id: 0, description: 'A cool image'}],
		});

		expect(edited.attachments).toBeDefined();
		expect(edited.attachments?.length).toBe(1);
		expect(edited.attachments?.[0].description).toBe('A cool image');
		expect(edited.content).toBe('Message with edited attachment');
		expect(edited.edited_timestamp).toBeDefined();
		expect(edited.edited_timestamp).not.toBeNull();
	});

	test('MANAGE_MESSAGES holder can edit others attachment descriptions in guild', async () => {
		const owner = await createTestAccount(harness);
		const moderator = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		await ensureSessionStarted(harness, owner.token);
		await ensureSessionStarted(harness, moderator.token);
		await ensureSessionStarted(harness, member.token);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const moderatorRole = await createRole(harness, owner.token, guild.id, {
			name: 'Moderator',
			permissions: Permissions.MANAGE_MESSAGES.toString(),
		});

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, moderator.token, invite.code);
		await acceptInvite(harness, member.token, invite.code);

		await addMemberRole(harness, owner.token, guild.id, moderator.userId, moderatorRole.id);

		const fileData = loadFixture('yeah.png');
		const {json: msg} = await sendMessageWithAttachments(
			harness,
			member.token,
			channelId,
			{
				content: 'Member message with attachment',
				attachments: [{id: 0, filename: 'yeah.png'}],
			},
			[{index: 0, filename: 'yeah.png', data: fileData}],
		);

		expect(msg.attachments).toBeDefined();
		expect(msg.attachments).not.toBeNull();
		expect(msg.attachments!.length).toBe(1);

		const edited = await editMessageWithAttachments(harness, moderator.token, channelId, msg.id, {
			attachments: [{id: 0, description: 'Moderator edited description'}],
		});

		expect(edited.attachments).toBeDefined();
		expect(edited.attachments?.length).toBe(1);
		expect(edited.attachments?.[0].description).toBe('Moderator edited description');
	});

	test('MANAGE_MESSAGES holder can edit both title and description', async () => {
		const owner = await createTestAccount(harness);
		const moderator = await createTestAccount(harness);

		await ensureSessionStarted(harness, owner.token);
		await ensureSessionStarted(harness, moderator.token);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const moderatorRole = await createRole(harness, owner.token, guild.id, {
			name: 'Moderator',
			permissions: Permissions.MANAGE_MESSAGES.toString(),
		});

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, moderator.token, invite.code);

		await addMemberRole(harness, owner.token, guild.id, moderator.userId, moderatorRole.id);

		const fileData = loadFixture('yeah.png');
		const {json: msg} = await sendMessageWithAttachments(
			harness,
			owner.token,
			channelId,
			{
				content: 'Owner message with attachment',
				attachments: [{id: 0, filename: 'yeah.png'}],
			},
			[{index: 0, filename: 'yeah.png', data: fileData}],
		);

		expect(msg.attachments).toBeDefined();
		expect(msg.attachments).not.toBeNull();
		expect(msg.attachments!.length).toBe(1);

		const edited = await editMessageWithAttachments(harness, moderator.token, channelId, msg.id, {
			attachments: [{id: 0, title: 'Image Title', description: 'Image description'}],
		});

		expect(edited.attachments).toBeDefined();
		expect(edited.attachments?.length).toBe(1);
		expect(edited.attachments?.[0].title).toBe('Image Title');
		expect(edited.attachments?.[0].description).toBe('Image description');
	});

	test('unauthorized user without MANAGE_MESSAGES is rejected with 403', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		await ensureSessionStarted(harness, owner.token);
		await ensureSessionStarted(harness, member.token);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const fileData = loadFixture('yeah.png');
		const {json: msg} = await sendMessageWithAttachments(
			harness,
			owner.token,
			channelId,
			{
				content: 'Owner message with attachment',
				attachments: [{id: 0, filename: 'yeah.png'}],
			},
			[{index: 0, filename: 'yeah.png', data: fileData}],
		);

		expect(msg.attachments).toBeDefined();
		expect(msg.attachments).not.toBeNull();
		expect(msg.attachments!.length).toBe(1);

		await createBuilder(harness, member.token)
			.patch(`/channels/${channelId}/messages/${msg.id}`)
			.body({
				attachments: [{id: 0, description: 'Unauthorized edit'}],
			})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('description validation enforces max 4096 characters', async () => {
		const author = await createTestAccount(harness);
		await ensureSessionStarted(harness, author.token);
		const guild = await createGuild(harness, author.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const fileData = loadFixture('yeah.png');
		const {json: msg} = await sendMessageWithAttachments(
			harness,
			author.token,
			channelId,
			{
				content: 'Message with attachment',
				attachments: [{id: 0, filename: 'yeah.png'}],
			},
			[{index: 0, filename: 'yeah.png', data: fileData}],
		);

		expect(msg.attachments).toBeDefined();
		expect(msg.attachments).not.toBeNull();
		expect(msg.attachments!.length).toBe(1);

		const longDescription = 'x'.repeat(4097);

		await createBuilder(harness, author.token)
			.patch(`/channels/${channelId}/messages/${msg.id}`)
			.body({
				content: 'Message with attachment',
				attachments: [{id: 0, description: longDescription}],
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('empty or null description clears alt text', async () => {
		const author = await createTestAccount(harness);
		await ensureSessionStarted(harness, author.token);
		const guild = await createGuild(harness, author.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const fileData = loadFixture('yeah.png');
		const {json: msg} = await sendMessageWithAttachments(
			harness,
			author.token,
			channelId,
			{
				content: 'Message with attachment',
				attachments: [{id: 0, filename: 'yeah.png', description: 'Initial description'}],
			},
			[{index: 0, filename: 'yeah.png', data: fileData}],
		);

		expect(msg.attachments).toBeDefined();
		expect(msg.attachments).not.toBeNull();
		expect(msg.attachments!.length).toBe(1);
		expect(msg.attachments![0].description).toBe('Initial description');

		const edited = await editMessageWithAttachments(harness, author.token, channelId, msg.id, {
			content: 'Message with attachment',
			attachments: [{id: 0, description: null}],
		});

		expect(edited.attachments).toBeDefined();
		expect(edited.attachments?.length).toBe(1);
		expect(edited.attachments?.[0].description).toBeNull();
	});

	test('non-existent attachment ID is gracefully ignored', async () => {
		const author = await createTestAccount(harness);
		await ensureSessionStarted(harness, author.token);
		const guild = await createGuild(harness, author.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const fileData = loadFixture('yeah.png');
		const {json: msg} = await sendMessageWithAttachments(
			harness,
			author.token,
			channelId,
			{
				content: 'Message with attachment',
				attachments: [{id: 0, filename: 'yeah.png'}],
			},
			[{index: 0, filename: 'yeah.png', data: fileData}],
		);

		expect(msg.attachments).toBeDefined();
		expect(msg.attachments).not.toBeNull();
		expect(msg.attachments!.length).toBe(1);

		const edited = await editMessageWithAttachments(harness, author.token, channelId, msg.id, {
			content: 'Message with attachment',
			attachments: [
				{id: 0, description: 'Real attachment'},
				{id: 999, description: 'Fake'},
			],
		});

		expect(edited.attachments).toBeDefined();
		expect(edited.attachments?.length).toBe(1);
		expect(edited.attachments?.[0].description).toBe('Real attachment');
	});

	test('DM channel: only author can edit, recipient is rejected', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);

		await createBuilder(harness, user1.token).post(`/users/@me/relationships/${user2.userId}`).body({}).execute();

		await createBuilder(harness, user2.token).put(`/users/@me/relationships/${user1.userId}`).body({}).execute();

		const dmChannel = await createDMChannel(harness, user1.token, user2.userId);

		const fileData = loadFixture('yeah.png');
		const {json: msg} = await sendMessageWithAttachments(
			harness,
			user1.token,
			dmChannel.id,
			{
				content: 'DM with attachment',
				attachments: [{id: 0, filename: 'yeah.png'}],
			},
			[{index: 0, filename: 'yeah.png', data: fileData}],
		);

		expect(msg.attachments).toBeDefined();
		expect(msg.attachments).not.toBeNull();
		expect(msg.attachments!.length).toBe(1);

		const editedByAuthor = await editMessageWithAttachments(harness, user1.token, dmChannel.id, msg.id, {
			content: 'DM with attachment',
			attachments: [{id: 0, description: 'Author edit'}],
		});

		expect(editedByAuthor.attachments).toBeDefined();
		expect(editedByAuthor.attachments?.length).toBe(1);
		expect(editedByAuthor.attachments?.[0].description).toBe('Author edit');

		await createBuilder(harness, user2.token)
			.patch(`/channels/${dmChannel.id}/messages/${msg.id}`)
			.body({
				content: 'DM with attachment',
				attachments: [{id: 0, description: 'Recipient edit'}],
			})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('multiple attachments: edit specific one', async () => {
		const author = await createTestAccount(harness);
		await ensureSessionStarted(harness, author.token);
		const guild = await createGuild(harness, author.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const fileData1 = loadFixture('yeah.png');
		const fileData2 = loadFixture('yeah.png');
		const {json: msg} = await sendMessageWithAttachments(
			harness,
			author.token,
			channelId,
			{
				content: 'Message with multiple attachments',
				attachments: [
					{id: 0, filename: 'first.png'},
					{id: 1, filename: 'second.png'},
				],
			},
			[
				{index: 0, filename: 'first.png', data: fileData1},
				{index: 1, filename: 'second.png', data: fileData2},
			],
		);

		expect(msg.attachments).toBeDefined();
		expect(msg.attachments).not.toBeNull();
		expect(msg.attachments!.length).toBe(2);

		const edited = await editMessageWithAttachments(harness, author.token, channelId, msg.id, {
			content: 'Message with multiple attachments',
			attachments: [{id: 0, description: 'First image description'}, {id: 1}],
		});

		expect(edited.attachments).toBeDefined();
		expect(edited.attachments?.length).toBe(2);
		expect(edited.attachments?.[0].description).toBe('First image description');
		expect(edited.attachments?.[1].description).toBeNull();
	});

	test('combined edit: SUPPRESS_EMBEDS flag and attachment description', async () => {
		const author = await createTestAccount(harness);
		await ensureSessionStarted(harness, author.token);
		const guild = await createGuild(harness, author.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const fileData = loadFixture('yeah.png');
		const {json: msg} = await sendMessageWithAttachments(
			harness,
			author.token,
			channelId,
			{
				content: 'Message with attachment',
				attachments: [{id: 0, filename: 'yeah.png'}],
			},
			[{index: 0, filename: 'yeah.png', data: fileData}],
		);

		expect(msg.attachments).toBeDefined();
		expect(msg.attachments).not.toBeNull();
		expect(msg.attachments!.length).toBe(1);

		const edited = await editMessageWithAttachments(harness, author.token, channelId, msg.id, {
			content: 'Message with attachment',
			attachments: [{id: 0, description: 'Edited description'}],
			flags: MessageFlags.SUPPRESS_EMBEDS,
		});

		expect(edited.attachments).toBeDefined();
		expect(edited.attachments?.length).toBe(1);
		expect(edited.attachments?.[0].description).toBe('Edited description');
	});

	test('verify edited_timestamp NOT set for non-author edits with MANAGE_MESSAGES', async () => {
		const owner = await createTestAccount(harness);
		const moderator = await createTestAccount(harness);

		await ensureSessionStarted(harness, owner.token);
		await ensureSessionStarted(harness, moderator.token);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const moderatorRole = await createRole(harness, owner.token, guild.id, {
			name: 'Moderator',
			permissions: Permissions.MANAGE_MESSAGES.toString(),
		});

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, moderator.token, invite.code);

		await addMemberRole(harness, owner.token, guild.id, moderator.userId, moderatorRole.id);

		const fileData = loadFixture('yeah.png');
		const {json: msg} = await sendMessageWithAttachments(
			harness,
			owner.token,
			channelId,
			{
				content: 'Owner message with attachment',
				attachments: [{id: 0, filename: 'yeah.png'}],
			},
			[{index: 0, filename: 'yeah.png', data: fileData}],
		);

		expect(msg.attachments).toBeDefined();
		expect(msg.attachments).not.toBeNull();
		expect(msg.attachments!.length).toBe(1);
		const originalEditedTimestamp = msg.edited_timestamp;

		const edited = await editMessageWithAttachments(harness, moderator.token, channelId, msg.id, {
			attachments: [{id: 0, description: 'Moderator edited description'}],
		});

		expect(edited.attachments).toBeDefined();
		expect(edited.attachments?.length).toBe(1);
		expect(edited.attachments?.[0].description).toBe('Moderator edited description');
		expect(edited.edited_timestamp).toBe(originalEditedTimestamp);
	});
});
