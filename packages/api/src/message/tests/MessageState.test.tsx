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
import {createTestBotAccount} from '@fluxer/api/src/bot/tests/BotTestUtils';
import {createDmChannel, createFriendship, createGroupDmChannel} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {
	deleteMessage,
	editMessage,
	ensureSessionStarted,
	getChannelState,
	getMessage,
	getMessages,
	sendMessage,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {MessageReferenceTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import type {MessageResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Message State', () => {
	let harness: ApiTestHarness;

	beforeAll(async () => {
		harness = await createApiTestHarness();
	});

	beforeEach(async () => {
		await harness.reset();
	});

	afterAll(async () => {
		await harness?.shutdown();
	});

	describe('Message delete reconciles channel state', () => {
		it('updates last_message_id when deleting the last message', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Channel State Test Guild');
			const channelId = guild.system_channel_id!;

			const msg1 = await sendMessage(harness, account.token, channelId, 'First message');
			const msg2 = await sendMessage(harness, account.token, channelId, 'Second message');

			const stateBeforeDelete = await getChannelState(harness, channelId);
			expect(stateBeforeDelete.last_message_id).toBe(msg2.id);

			await deleteMessage(harness, account.token, channelId, msg2.id);

			const stateAfterDelete = await getChannelState(harness, channelId);
			expect(stateAfterDelete.last_message_id).toBe(msg1.id);
		});

		it('sets last_message_id to null when deleting the only message', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Single Message Delete Guild');
			const channelId = guild.system_channel_id!;

			const msg = await sendMessage(harness, account.token, channelId, 'Only message');

			const stateBeforeDelete = await getChannelState(harness, channelId);
			expect(stateBeforeDelete.last_message_id).toBe(msg.id);

			await deleteMessage(harness, account.token, channelId, msg.id);

			const stateAfterDelete = await getChannelState(harness, channelId);
			expect(stateAfterDelete.last_message_id).toBeNull();
		});

		it('does not change last_message_id when deleting a non-last message', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Non-Last Message Delete Guild');
			const channelId = guild.system_channel_id!;

			const msg1 = await sendMessage(harness, account.token, channelId, 'First message');
			const msg2 = await sendMessage(harness, account.token, channelId, 'Second message');

			const stateBeforeDelete = await getChannelState(harness, channelId);
			expect(stateBeforeDelete.last_message_id).toBe(msg2.id);

			await deleteMessage(harness, account.token, channelId, msg1.id);

			const stateAfterDelete = await getChannelState(harness, channelId);
			expect(stateAfterDelete.last_message_id).toBe(msg2.id);
		});
	});

	describe('Message flags for guild messages', () => {
		it('flags default to 0 for standard guild messages', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Default Guild Flags Test');
			const channelId = guild.system_channel_id!;

			const msg = await sendMessage(harness, account.token, channelId, 'Standard message');

			expect((msg as MessageResponse & {flags: number}).flags).toBe(0);
		});

		it('flags are preserved when fetching guild messages', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Fetch Guild Flags Test');
			const channelId = guild.system_channel_id!;

			const createdMsg = await sendMessage(harness, account.token, channelId, 'Test message');
			const fetchedMsg = await getMessage(harness, account.token, channelId, createdMsg.id);

			expect((fetchedMsg as MessageResponse & {flags: number}).flags).toBe(
				(createdMsg as MessageResponse & {flags: number}).flags,
			);
		});

		it('flags are preserved in message list for guild channels', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'List Guild Flags Test');
			const channelId = guild.system_channel_id!;

			const createdMsg = await sendMessage(harness, account.token, channelId, 'List test message');
			const messages = await getMessages(harness, account.token, channelId);

			const foundMsg = messages.find((m) => m.id === createdMsg.id);
			expect(foundMsg).toBeDefined();
			expect((foundMsg as MessageResponse & {flags: number}).flags).toBe(
				(createdMsg as MessageResponse & {flags: number}).flags,
			);
		});
	});

	describe('Message flags for DM messages', () => {
		it('flags default to 0 for standard DM messages', async () => {
			const user1 = await createTestAccount(harness);
			const user2 = await createTestAccount(harness);
			await ensureSessionStarted(harness, user1.token);
			await ensureSessionStarted(harness, user2.token);

			await createFriendship(harness, user1, user2);
			const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

			const msg = await sendMessage(harness, user1.token, dmChannel.id, 'Standard DM');

			expect((msg as MessageResponse & {flags: number}).flags).toBe(0);
		});

		it('flags are preserved when fetching DM messages', async () => {
			const user1 = await createTestAccount(harness);
			const user2 = await createTestAccount(harness);
			await ensureSessionStarted(harness, user1.token);
			await ensureSessionStarted(harness, user2.token);

			await createFriendship(harness, user1, user2);
			const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

			const createdMsg = await sendMessage(harness, user1.token, dmChannel.id, 'Fetch DM test');
			const fetchedMsg = await getMessage(harness, user1.token, dmChannel.id, createdMsg.id);

			expect((fetchedMsg as MessageResponse & {flags: number}).flags).toBe(
				(createdMsg as MessageResponse & {flags: number}).flags,
			);
		});
	});

	describe('Message flags for group DM messages', () => {
		it('flags default to 0 for standard group DM messages', async () => {
			const user1 = await createTestAccount(harness);
			const user2 = await createTestAccount(harness);
			const user3 = await createTestAccount(harness);
			await ensureSessionStarted(harness, user1.token);
			await ensureSessionStarted(harness, user2.token);
			await ensureSessionStarted(harness, user3.token);

			await createFriendship(harness, user1, user2);
			await createFriendship(harness, user1, user3);

			const groupDmChannel = await createGroupDmChannel(harness, user1.token, [user2.userId, user3.userId]);

			const msg = await sendMessage(harness, user1.token, groupDmChannel.id, 'Standard group DM');

			expect((msg as MessageResponse & {flags: number}).flags).toBe(0);
		});

		it('flags are preserved when fetching group DM messages', async () => {
			const user1 = await createTestAccount(harness);
			const user2 = await createTestAccount(harness);
			const user3 = await createTestAccount(harness);
			await ensureSessionStarted(harness, user1.token);
			await ensureSessionStarted(harness, user2.token);
			await ensureSessionStarted(harness, user3.token);

			await createFriendship(harness, user1, user2);
			await createFriendship(harness, user1, user3);

			const groupDmChannel = await createGroupDmChannel(harness, user1.token, [user2.userId, user3.userId]);

			const createdMsg = await sendMessage(harness, user1.token, groupDmChannel.id, 'Fetch group DM test');
			const fetchedMsg = await getMessage(harness, user1.token, groupDmChannel.id, createdMsg.id);

			expect((fetchedMsg as MessageResponse & {flags: number}).flags).toBe(
				(createdMsg as MessageResponse & {flags: number}).flags,
			);
		});
	});

	describe('Message reference serialization', () => {
		it('includes message_reference in create response for reply', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Reply Create Test Guild');
			const channelId = guild.system_channel_id!;

			const originalMsg = await sendMessage(harness, account.token, channelId, 'Original message');

			const replyMsg = await createBuilder<{
				id: string;
				message_reference?: {
					channel_id: string;
					message_id: string;
					guild_id?: string;
					type: number;
				};
			}>(harness, account.token)
				.post(`/channels/${channelId}/messages`)
				.body({
					content: 'Reply message',
					message_reference: {
						message_id: originalMsg.id,
						channel_id: channelId,
						type: MessageReferenceTypes.DEFAULT,
					},
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(replyMsg.message_reference).toBeDefined();
			expect(replyMsg.message_reference?.channel_id).toBe(channelId);
			expect(replyMsg.message_reference?.message_id).toBe(originalMsg.id);
			expect(replyMsg.message_reference?.type).toBe(MessageReferenceTypes.DEFAULT);
		});

		it('includes message_reference in get response for reply', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Reply Get Test Guild');
			const channelId = guild.system_channel_id!;

			const originalMsg = await sendMessage(harness, account.token, channelId, 'Original for get test');

			const createdReply = await createBuilder<{id: string}>(harness, account.token)
				.post(`/channels/${channelId}/messages`)
				.body({
					content: 'Reply for get test',
					message_reference: {
						message_id: originalMsg.id,
						channel_id: channelId,
						type: MessageReferenceTypes.DEFAULT,
					},
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const fetchedMsg = await createBuilder<{
				id: string;
				message_reference?: {
					channel_id: string;
					message_id: string;
					guild_id?: string;
					type: number;
				};
			}>(harness, account.token)
				.get(`/channels/${channelId}/messages/${createdReply.id}`)
				.execute();

			expect(fetchedMsg.message_reference).toBeDefined();
			expect(fetchedMsg.message_reference?.channel_id).toBe(channelId);
			expect(fetchedMsg.message_reference?.message_id).toBe(originalMsg.id);
			expect(fetchedMsg.message_reference?.type).toBe(MessageReferenceTypes.DEFAULT);
		});

		it('includes message_reference in list response for reply', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Reply List Test Guild');
			const channelId = guild.system_channel_id!;

			const originalMsg = await sendMessage(harness, account.token, channelId, 'Original for list test');

			const createdReply = await createBuilder<{id: string}>(harness, account.token)
				.post(`/channels/${channelId}/messages`)
				.body({
					content: 'Reply for list test',
					message_reference: {
						message_id: originalMsg.id,
						channel_id: channelId,
						type: MessageReferenceTypes.DEFAULT,
					},
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const messages = await createBuilder<
				Array<{
					id: string;
					message_reference?: {
						channel_id: string;
						message_id: string;
						guild_id?: string;
						type: number;
					};
				}>
			>(harness, account.token)
				.get(`/channels/${channelId}/messages`)
				.execute();

			const foundReply = messages.find((m) => m.id === createdReply.id);
			expect(foundReply).toBeDefined();
			expect(foundReply?.message_reference).toBeDefined();
			expect(foundReply?.message_reference?.channel_id).toBe(channelId);
			expect(foundReply?.message_reference?.message_id).toBe(originalMsg.id);
			expect(foundReply?.message_reference?.type).toBe(MessageReferenceTypes.DEFAULT);
		});

		it('includes guild_id in message_reference for guild replies', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Guild ID Reference Test');
			const channelId = guild.system_channel_id!;

			const originalMsg = await sendMessage(harness, account.token, channelId, 'Original guild message');

			const reply = await createBuilder<{
				message_reference?: {
					guild_id?: string;
				};
			}>(harness, account.token)
				.post(`/channels/${channelId}/messages`)
				.body({
					content: 'Guild reply',
					message_reference: {
						message_id: originalMsg.id,
						channel_id: channelId,
						guild_id: guild.id,
						type: MessageReferenceTypes.DEFAULT,
					},
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(reply.message_reference?.guild_id).toBe(guild.id);
		});

		it('includes message_reference for forwarded messages', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Forward Reference Test Guild');
			const channelId = guild.system_channel_id!;

			const originalMsg = await sendMessage(harness, account.token, channelId, 'Message to forward');

			const forwardedMsg = await createBuilder<{
				id: string;
				message_reference?: {
					channel_id: string;
					message_id: string;
					type: number;
				};
			}>(harness, account.token)
				.post(`/channels/${channelId}/messages`)
				.body({
					message_reference: {
						message_id: originalMsg.id,
						channel_id: channelId,
						type: MessageReferenceTypes.FORWARD,
					},
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(forwardedMsg.message_reference).toBeDefined();
			expect(forwardedMsg.message_reference?.type).toBe(MessageReferenceTypes.FORWARD);
		});

		it('accepts bot replies when message_reference snowflakes are JSON numbers', async () => {
			const botAccount = await createTestBotAccount(harness);

			await ensureSessionStarted(harness, botAccount.ownerToken);

			const guild = await createGuild(harness, botAccount.ownerToken, 'Bot reply snowflake number test');
			const channelId = guild.system_channel_id!;
			const botGuildPermissions = (
				Permissions.VIEW_CHANNEL |
				Permissions.SEND_MESSAGES |
				Permissions.READ_MESSAGE_HISTORY
			).toString();

			await createBuilder<{redirect_to: string}>(harness, botAccount.ownerToken)
				.post('/oauth2/authorize/consent')
				.body({
					client_id: botAccount.appId,
					scope: 'bot',
					guild_id: guild.id,
					permissions: botGuildPermissions,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			const botAuthToken = `Bot ${botAccount.botToken}`;
			await ensureSessionStarted(harness, botAuthToken);

			const originalMsg = await sendMessage(harness, botAccount.ownerToken, channelId, 'Original message');

			const replyWithStringIds = await createBuilder<{
				message_reference?: {channel_id: string; message_id: string; type: number};
			}>(harness, botAuthToken)
				.post(`/channels/${channelId}/messages`)
				.body({
					content: 'Reply (string snowflakes)',
					message_reference: {
						message_id: originalMsg.id,
						channel_id: channelId,
						type: MessageReferenceTypes.DEFAULT,
					},
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(replyWithStringIds.message_reference?.message_id).toBe(originalMsg.id);
			expect(replyWithStringIds.message_reference?.channel_id).toBe(channelId);
			expect(replyWithStringIds.message_reference?.type).toBe(MessageReferenceTypes.DEFAULT);

			const rawNumericPayload = `{"content":"Reply (numeric snowflakes)","message_reference":{"channel_id":${channelId},"message_id":${originalMsg.id},"type":${MessageReferenceTypes.DEFAULT}}}`;

			const replyWithNumericIds = await createBuilder<{
				message_reference?: {channel_id: string; message_id: string; type: number};
			}>(harness, botAuthToken)
				.post(`/channels/${channelId}/messages`)
				.body(rawNumericPayload)
				.expect(HTTP_STATUS.OK)
				.execute();

			// If we ever regress and allow JSON.parse to lose precision, these IDs won't match.
			expect(replyWithNumericIds.message_reference?.message_id).toBe(originalMsg.id);
			expect(replyWithNumericIds.message_reference?.channel_id).toBe(channelId);
			expect(replyWithNumericIds.message_reference?.type).toBe(MessageReferenceTypes.DEFAULT);
		});
	});

	describe('Edited message timestamp', () => {
		it('edited_timestamp is null for newly created messages', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'New Message Timestamp Guild');
			const channelId = guild.system_channel_id!;

			const msg = await sendMessage(harness, account.token, channelId, 'New message');

			expect((msg as MessageResponse & {edited_timestamp: string | null}).edited_timestamp).toBeNull();
		});

		it('edited_timestamp is set after editing a message', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Edit Timestamp Guild');
			const channelId = guild.system_channel_id!;

			const msg = await sendMessage(harness, account.token, channelId, 'Original content');

			const beforeEdit = Date.now();
			const editedMsg = await editMessage(harness, account.token, channelId, msg.id, 'Edited content');
			const afterEdit = Date.now();

			const editedTimestamp = (editedMsg as MessageResponse & {edited_timestamp: string | null}).edited_timestamp;
			expect(editedTimestamp).not.toBeNull();

			const editedTime = new Date(editedTimestamp!).getTime();
			expect(editedTime).toBeGreaterThanOrEqual(beforeEdit - 1000);
			expect(editedTime).toBeLessThanOrEqual(afterEdit + 1000);
		});

		it('edited_timestamp is updated on subsequent edits', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Multiple Edit Timestamp Guild');
			const channelId = guild.system_channel_id!;

			const msg = await sendMessage(harness, account.token, channelId, 'Original');

			const firstEdit = await editMessage(harness, account.token, channelId, msg.id, 'First edit');
			const firstEditTimestamp = (firstEdit as MessageResponse & {edited_timestamp: string | null}).edited_timestamp;

			await new Promise((resolve) => setTimeout(resolve, 100));

			const secondEdit = await editMessage(harness, account.token, channelId, msg.id, 'Second edit');
			const secondEditTimestamp = (secondEdit as MessageResponse & {edited_timestamp: string | null}).edited_timestamp;

			expect(firstEditTimestamp).not.toBeNull();
			expect(secondEditTimestamp).not.toBeNull();

			const firstTime = new Date(firstEditTimestamp!).getTime();
			const secondTime = new Date(secondEditTimestamp!).getTime();
			expect(secondTime).toBeGreaterThanOrEqual(firstTime);
		});

		it('edited_timestamp is preserved when fetching edited message', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'Fetch Edited Timestamp Guild');
			const channelId = guild.system_channel_id!;

			const msg = await sendMessage(harness, account.token, channelId, 'Original');
			const editedMsg = await editMessage(harness, account.token, channelId, msg.id, 'Edited');

			const fetchedMsg = await getMessage(harness, account.token, channelId, msg.id);

			expect((fetchedMsg as MessageResponse & {edited_timestamp: string | null}).edited_timestamp).toBe(
				(editedMsg as MessageResponse & {edited_timestamp: string | null}).edited_timestamp,
			);
		});

		it('edited_timestamp is preserved in message list', async () => {
			const account = await createTestAccount(harness);
			await ensureSessionStarted(harness, account.token);
			const guild = await createGuild(harness, account.token, 'List Edited Timestamp Guild');
			const channelId = guild.system_channel_id!;

			const msg = await sendMessage(harness, account.token, channelId, 'Original');
			const editedMsg = await editMessage(harness, account.token, channelId, msg.id, 'Edited');

			const messages = await getMessages(harness, account.token, channelId);
			const foundMsg = messages.find((m) => m.id === msg.id);

			expect(foundMsg).toBeDefined();
			expect((foundMsg as MessageResponse & {edited_timestamp: string | null}).edited_timestamp).toBe(
				(editedMsg as MessageResponse & {edited_timestamp: string | null}).edited_timestamp,
			);
		});
	});
});
