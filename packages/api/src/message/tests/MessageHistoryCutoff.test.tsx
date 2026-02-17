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
import {getRoles, updateGuild, updateRole} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {
	acceptInvite,
	addReaction,
	createChannelInvite,
	createGuild,
	markChannelAsIndexed,
	pinMessage,
	removeReaction,
	seedMessagesAtTimestamps,
	sendMessage,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import type {MessageResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {extractTimestamp} from '@fluxer/snowflake/src/SnowflakeUtils';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('MessageHistoryCutoff', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness({search: 'meilisearch'});
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	async function removeReadMessageHistoryFromEveryone(ownerToken: string, guild: GuildResponse): Promise<void> {
		const roles = await getRoles(harness, ownerToken, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);
		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.READ_MESSAGE_HISTORY;
			await updateRole(harness, ownerToken, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}
	}

	async function setupGuildWithMember(): Promise<{
		ownerToken: string;
		ownerUserId: string;
		memberToken: string;
		memberUserId: string;
		guild: GuildResponse;
		channelId: string;
	}> {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Cutoff Test Guild');
		const channelId = guild.system_channel_id!;
		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);
		return {
			ownerToken: owner.token,
			ownerUserId: owner.userId,
			memberToken: member.token,
			memberUserId: member.userId,
			guild,
			channelId,
		};
	}

	function getGuildCreationCutoff(guild: GuildResponse): string {
		return new Date(Math.max(extractTimestamp(guild.id), Date.now() - 100)).toISOString();
	}

	describe('Guild Update Validation', () => {
		test('should allow setting message_history_cutoff to a valid timestamp', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Cutoff Guild');

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			const updated = await updateGuild(harness, owner.token, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			expect(updated.message_history_cutoff).toBeDefined();
			expect(new Date(updated.message_history_cutoff!).getTime()).toBeCloseTo(new Date(cutoffTimestamp).getTime(), -3);
		});

		test('should allow setting message_history_cutoff to null', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Cutoff Guild');

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, owner.token, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			const updated = await updateGuild(harness, owner.token, guild.id, {
				message_history_cutoff: null,
			});

			expect(updated.message_history_cutoff).toBeNull();
		});

		test('should reject message_history_cutoff before guild creation time', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Cutoff Guild');

			const veryOldTimestamp = new Date('2020-01-01T00:00:00.000Z').toISOString();

			await createBuilder(harness, owner.token)
				.patch(`/guilds/${guild.id}`)
				.body({message_history_cutoff: veryOldTimestamp})
				.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
				.execute();
		});

		test('should reject message_history_cutoff in the future', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Cutoff Guild');

			const futureTimestamp = new Date(Date.now() + 86400000).toISOString();

			await createBuilder(harness, owner.token)
				.patch(`/guilds/${guild.id}`)
				.body({message_history_cutoff: futureTimestamp})
				.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_FORM_BODY')
				.execute();
		});

		test('should require MANAGE_GUILD permission to set message_history_cutoff', async () => {
			const {memberToken, guild} = await setupGuildWithMember();

			const cutoffTimestamp = getGuildCreationCutoff(guild);

			await createBuilder(harness, memberToken)
				.patch(`/guilds/${guild.id}`)
				.body({message_history_cutoff: cutoffTimestamp})
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});

		test('should persist message_history_cutoff and return it in guild response', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Cutoff Guild');

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, owner.token, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			const fetchedGuild = await createBuilder<GuildResponse>(harness, owner.token)
				.get(`/guilds/${guild.id}`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(fetchedGuild.message_history_cutoff).toBeDefined();
			expect(new Date(fetchedGuild.message_history_cutoff!).getTime()).toBeCloseTo(
				new Date(cutoffTimestamp).getTime(),
				-3,
			);
		});
	});

	describe('Single Message Fetch', () => {
		test('should allow user with READ_MESSAGE_HISTORY to fetch any message regardless of cutoff', async () => {
			const {ownerToken, guild, channelId} = await setupGuildWithMember();

			const message = await sendMessage(harness, ownerToken, channelId, 'Test message');

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			const fetched = await createBuilder<MessageResponse>(harness, ownerToken)
				.get(`/channels/${channelId}/messages/${message.id}`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(fetched.id).toBe(message.id);
		});

		test('should deny user without READ_MESSAGE_HISTORY from fetching any message when cutoff is null', async () => {
			const {ownerToken, memberToken, guild, channelId} = await setupGuildWithMember();

			const message = await sendMessage(harness, ownerToken, channelId, 'Test message');

			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			await createBuilder(harness, memberToken)
				.get(`/channels/${channelId}/messages/${message.id}`)
				.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_MESSAGE')
				.execute();
		});

		test('should allow user without READ_MESSAGE_HISTORY to fetch messages after cutoff', async () => {
			const {ownerToken, memberToken, guild, channelId} = await setupGuildWithMember();

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			const message = await sendMessage(harness, ownerToken, channelId, 'Message after cutoff');

			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			const fetched = await createBuilder<MessageResponse>(harness, memberToken)
				.get(`/channels/${channelId}/messages/${message.id}`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(fetched.id).toBe(message.id);
		});

		test('should deny user without READ_MESSAGE_HISTORY from fetching messages before cutoff', async () => {
			const {ownerToken, memberToken, ownerUserId, guild, channelId} = await setupGuildWithMember();

			const baseTime = Date.now() - 7200000;
			const seedResult = await seedMessagesAtTimestamps(harness, channelId, [new Date(baseTime)], ownerUserId);
			const oldMessageId = seedResult.messages[0]!.message_id;

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			await createBuilder(harness, memberToken)
				.get(`/channels/${channelId}/messages/${oldMessageId}`)
				.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_MESSAGE')
				.execute();
		});
	});

	describe('Message List', () => {
		test('should return all messages for user with READ_MESSAGE_HISTORY regardless of cutoff', async () => {
			const {ownerToken, guild, channelId} = await setupGuildWithMember();

			await sendMessage(harness, ownerToken, channelId, 'Message 1');
			await sendMessage(harness, ownerToken, channelId, 'Message 2');
			await sendMessage(harness, ownerToken, channelId, 'Message 3');

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			const messages = await createBuilder<Array<MessageResponse>>(harness, ownerToken)
				.get(`/channels/${channelId}/messages`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(messages.length).toBeGreaterThanOrEqual(3);
		});

		test('should return empty array for user without READ_MESSAGE_HISTORY when cutoff is null', async () => {
			const {ownerToken, memberToken, guild, channelId} = await setupGuildWithMember();

			await sendMessage(harness, ownerToken, channelId, 'Message 1');
			await sendMessage(harness, ownerToken, channelId, 'Message 2');

			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			const messages = await createBuilder<Array<MessageResponse>>(harness, memberToken)
				.get(`/channels/${channelId}/messages`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(messages).toEqual([]);
		});

		test('should only return messages after cutoff for user without READ_MESSAGE_HISTORY', async () => {
			const {ownerToken, memberToken, ownerUserId, guild, channelId} = await setupGuildWithMember();

			const baseTime = Date.now() - 7200000;
			const seedResult = await seedMessagesAtTimestamps(harness, channelId, [new Date(baseTime)], ownerUserId);

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			const recentMessage = await sendMessage(harness, ownerToken, channelId, 'Recent message after cutoff');
			const newerMessage = await sendMessage(harness, ownerToken, channelId, 'Newest message after cutoff');

			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			const messages = await createBuilder<Array<MessageResponse>>(harness, memberToken)
				.get(`/channels/${channelId}/messages`)
				.expect(HTTP_STATUS.OK)
				.execute();

			const returnedMessageIds = new Set(messages.map((message) => message.id));
			expect(returnedMessageIds.has(seedResult.messages[0]!.message_id)).toBe(false);
			expect(returnedMessageIds.has(recentMessage.id)).toBe(true);
			expect(returnedMessageIds.has(newerMessage.id)).toBe(true);
		});
	});

	describe('Message Reply Validation', () => {
		test('should deny reply to any message when user lacks READ_MESSAGE_HISTORY and cutoff is null', async () => {
			const {ownerToken, memberToken, guild, channelId} = await setupGuildWithMember();

			const originalMessage = await sendMessage(harness, ownerToken, channelId, 'Original message');

			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			await createBuilder(harness, memberToken)
				.post(`/channels/${channelId}/messages`)
				.body({
					content: 'Attempted reply',
					message_reference: {
						message_id: originalMessage.id,
						channel_id: channelId,
					},
				})
				.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_MESSAGE')
				.execute();
		});

		test('should allow reply to message after cutoff when user lacks READ_MESSAGE_HISTORY', async () => {
			const {ownerToken, memberToken, guild, channelId} = await setupGuildWithMember();

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			const originalMessage = await sendMessage(harness, ownerToken, channelId, 'Recent message');

			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			const reply = await createBuilder<MessageResponse>(harness, memberToken)
				.post(`/channels/${channelId}/messages`)
				.body({
					content: 'Reply to recent message',
					message_reference: {
						message_id: originalMessage.id,
						channel_id: channelId,
					},
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(reply.id).toBeDefined();
			expect(reply.content).toBe('Reply to recent message');
		});

		test('should deny reply to message before cutoff when user lacks READ_MESSAGE_HISTORY', async () => {
			const {ownerToken, memberToken, ownerUserId, guild, channelId} = await setupGuildWithMember();

			const baseTime = Date.now() - 7200000;
			const seedResult = await seedMessagesAtTimestamps(harness, channelId, [new Date(baseTime)], ownerUserId);
			const oldMessageId = seedResult.messages[0]!.message_id;

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			await createBuilder(harness, memberToken)
				.post(`/channels/${channelId}/messages`)
				.body({
					content: 'Attempted reply to old message',
					message_reference: {
						message_id: oldMessageId,
						channel_id: channelId,
					},
				})
				.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_MESSAGE')
				.execute();
		});

		test('should allow user with READ_MESSAGE_HISTORY to reply to any message', async () => {
			const {ownerToken, ownerUserId, guild, channelId} = await setupGuildWithMember();

			const baseTime = Date.now() - 7200000;
			const seedResult = await seedMessagesAtTimestamps(harness, channelId, [new Date(baseTime)], ownerUserId);
			const oldMessageId = seedResult.messages[0]!.message_id;

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			const reply = await createBuilder<MessageResponse>(harness, ownerToken)
				.post(`/channels/${channelId}/messages`)
				.body({
					content: 'Reply from owner',
					message_reference: {
						message_id: oldMessageId,
						channel_id: channelId,
					},
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(reply.id).toBeDefined();
			expect(reply.content).toBe('Reply from owner');
		});

		test('should require READ_MESSAGE_HISTORY for forwards regardless of cutoff', async () => {
			const {ownerToken, memberToken, guild, channelId} = await setupGuildWithMember();

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			const originalMessage = await sendMessage(harness, ownerToken, channelId, 'Message to forward');

			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			await createBuilder(harness, memberToken)
				.post(`/channels/${channelId}/messages`)
				.body({
					message_reference: {
						message_id: originalMessage.id,
						channel_id: channelId,
						guild_id: guild.id,
						type: 1,
					},
				})
				.expect(HTTP_STATUS.FORBIDDEN)
				.execute();
		});
	});

	describe('Pinned Messages', () => {
		test('should return empty pinned messages for user without READ_MESSAGE_HISTORY', async () => {
			const {ownerToken, memberToken, guild, channelId} = await setupGuildWithMember();

			const message = await sendMessage(harness, ownerToken, channelId, 'Pin this message');
			await pinMessage(harness, ownerToken, channelId, message.id);

			await new Promise((resolve) => setTimeout(resolve, 5));
			const cutoffTimestamp = new Date(extractTimestamp(message.id) + 1).toISOString();
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			const body = await createBuilder<{items: Array<unknown>; has_more: boolean}>(harness, memberToken)
				.get(`/channels/${channelId}/messages/pins`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(body.items).toEqual([]);
		});

		test('should return pinned messages for user with READ_MESSAGE_HISTORY', async () => {
			const {ownerToken, guild, channelId} = await setupGuildWithMember();

			const message = await sendMessage(harness, ownerToken, channelId, 'Pin this message');
			await pinMessage(harness, ownerToken, channelId, message.id);

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			const body = await createBuilder<{items: Array<unknown>; has_more: boolean}>(harness, ownerToken)
				.get(`/channels/${channelId}/messages/pins`)
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(body.items.length).toBe(1);
		});
	});

	describe('Search Messages', () => {
		test('should return empty search results for user without READ_MESSAGE_HISTORY when cutoff is null', async () => {
			const {ownerToken, memberToken, guild, channelId} = await setupGuildWithMember();

			await sendMessage(harness, ownerToken, channelId, 'searchable cutoff content');
			await markChannelAsIndexed(harness, channelId);

			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			const json = await createBuilder<{messages: Array<unknown>}>(harness, memberToken)
				.post('/search/messages')
				.body({
					content: 'searchable cutoff',
					context_channel_id: channelId,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			expect(json.messages).toEqual([]);
		});

		test('should return search results for user with READ_MESSAGE_HISTORY regardless of cutoff', async () => {
			const owner = await createTestAccount(harness);
			const guild = await createGuild(harness, owner.token, 'Search Cutoff Guild');
			const channelId = guild.system_channel_id!;

			await sendMessage(harness, owner.token, channelId, 'searchable cutoff owner content');
			await markChannelAsIndexed(harness, channelId);

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, owner.token, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			await createBuilder(harness, owner.token)
				.post('/search/messages')
				.body({
					content: 'searchable cutoff owner',
					context_channel_id: channelId,
				})
				.expect(HTTP_STATUS.OK)
				.execute();
		});

		test('should filter search results by cutoff for user without READ_MESSAGE_HISTORY', async () => {
			const {ownerToken, memberToken, ownerUserId, guild, channelId} = await setupGuildWithMember();

			const baseTime = Date.now() - 7200000;
			await seedMessagesAtTimestamps(harness, channelId, [new Date(baseTime)], ownerUserId);

			const recentMessage = await sendMessage(harness, ownerToken, channelId, 'searchable recent cutoff content');

			await markChannelAsIndexed(harness, channelId);

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});

			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			const json = await createBuilder<{messages: Array<{id: string}>}>(harness, memberToken)
				.post('/search/messages')
				.body({
					content: 'searchable recent cutoff',
					context_channel_id: channelId,
				})
				.expect(HTTP_STATUS.OK)
				.execute();

			if (json.messages.length > 0) {
				for (const msg of json.messages) {
					expect(msg.id).toBe(recentMessage.id);
				}
			}
		});
	});

	describe('Reactions', () => {
		test('should deny adding reaction to message before cutoff when user lacks READ_MESSAGE_HISTORY', async () => {
			const {ownerToken, memberToken, ownerUserId, guild, channelId} = await setupGuildWithMember();

			const baseTime = Date.now() - 7200000;
			const seedResult = await seedMessagesAtTimestamps(harness, channelId, [new Date(baseTime)], ownerUserId);
			const oldMessageId = seedResult.messages[0]!.message_id;

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});
			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			await createBuilder(harness, memberToken)
				.put(`/channels/${channelId}/messages/${oldMessageId}/reactions/${encodeURIComponent('👍')}/@me`)
				.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_MESSAGE')
				.execute();
		});

		test('should allow adding and removing reaction to message after cutoff when user lacks READ_MESSAGE_HISTORY', async () => {
			const {ownerToken, memberToken, guild, channelId, memberUserId} = await setupGuildWithMember();

			const cutoffTimestamp = getGuildCreationCutoff(guild);
			await updateGuild(harness, ownerToken, guild.id, {
				message_history_cutoff: cutoffTimestamp,
			});
			const message = await sendMessage(harness, ownerToken, channelId, 'Reactable recent message');
			await removeReadMessageHistoryFromEveryone(ownerToken, guild);

			await addReaction(harness, memberToken, channelId, message.id, encodeURIComponent('👍'));
			await removeReaction(harness, memberToken, channelId, message.id, encodeURIComponent('👍'), memberUserId);
		});
	});
});
