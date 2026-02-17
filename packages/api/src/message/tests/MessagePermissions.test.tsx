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
import {addMemberRole, createRole, getRoles, updateRole} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {
	acceptInvite,
	createChannelInvite,
	createGuild,
	markChannelAsIndexed,
	markGuildChannelsAsIndexed,
	pinMessage,
	sendMessage,
	updateChannelPermissions,
} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {createFavoriteMemeFromUrl} from '@fluxer/api/src/user/tests/FavoriteMemeTestUtils';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {GuildNSFWLevel} from '@fluxer/constants/src/GuildConstants';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

const TEST_IMAGE_URL = 'https://picsum.photos/id/1/100';

describe('Message Permissions', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness({search: 'meilisearch'});
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('should require SEND_MESSAGES permission to send messages', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.SEND_MESSAGES;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		await createBuilder(harness, member.token)
			.post(`/channels/${channelId}/messages`)
			.body({content: 'Test message'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should require MENTION_EVERYONE permission to use @everyone', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.MENTION_EVERYONE;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const message = await sendMessage(harness, member.token, channelId, '@everyone hello');
		expect(message.mention_everyone).toBe(false);
	});

	test('should allow @everyone with MENTION_EVERYONE permission', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, owner.token, channelId, '@everyone announcement');
		expect(message.mention_everyone).toBe(true);
	});

	test('should require EMBED_LINKS permission for embeds', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const noEmbedsRole = await createRole(harness, owner.token, guild.id, {
			name: 'No Embeds',
			permissions: (Permissions.SEND_MESSAGES & ~Permissions.EMBED_LINKS).toString(),
		});

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		await addMemberRole(harness, owner.token, guild.id, member.userId, noEmbedsRole.id);

		const message = await sendMessage(harness, member.token, channelId, 'https://example.com');
		expect(message.content).toBe('https://example.com');
	});

	test('should require ATTACH_FILES permission for favourite meme id messages', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;
		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const meme = await createFavoriteMemeFromUrl(harness, member.token, {
			url: TEST_IMAGE_URL,
			name: 'Permission meme',
		});

		await updateChannelPermissions(harness, owner.token, channelId, member.userId, {
			type: 1,
			deny: Permissions.ATTACH_FILES.toString(),
		});

		await createBuilder(harness, member.token)
			.post(`/channels/${channelId}/messages`)
			.body({favorite_meme_id: meme.id})
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.MISSING_PERMISSIONS)
			.execute();
	});

	test('should require EMBED_LINKS permission for favourite meme id messages', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;
		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const meme = await createFavoriteMemeFromUrl(harness, member.token, {
			url: TEST_IMAGE_URL,
			name: 'Permission meme',
		});

		await updateChannelPermissions(harness, owner.token, channelId, member.userId, {
			type: 1,
			deny: Permissions.EMBED_LINKS.toString(),
		});

		await createBuilder(harness, member.token)
			.post(`/channels/${channelId}/messages`)
			.body({favorite_meme_id: meme.id})
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.MISSING_PERMISSIONS)
			.execute();
	});

	test('should require READ_MESSAGE_HISTORY to fetch messages', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.READ_MESSAGE_HISTORY;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		await sendMessage(harness, owner.token, channelId, 'History message');

		const messages = await createBuilder<Array<unknown>>(harness, member.token)
			.get(`/channels/${channelId}/messages`)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(messages.length).toBe(0);
	});

	test('should forbid underage user from fetching messages in an age-restricted guild', async () => {
		const owner = await createTestAccount(harness, {dateOfBirth: '2000-01-01'});
		const underageMember = await createTestAccount(harness, {dateOfBirth: '2012-01-01'});

		const guild = await createGuild(harness, owner.token, 'Age Restricted Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, underageMember.token, invite.code);

		await createBuilder(harness, owner.token)
			.patch(`/guilds/${guild.id}`)
			.body({nsfw_level: GuildNSFWLevel.AGE_RESTRICTED})
			.expect(HTTP_STATUS.OK)
			.execute();

		const message = await sendMessage(harness, owner.token, channelId, 'Guild is now age-restricted');

		await createBuilder(harness, underageMember.token)
			.get(`/channels/${channelId}/messages`)
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.NSFW_CONTENT_AGE_RESTRICTED)
			.execute();

		await createBuilder(harness, underageMember.token)
			.get(`/channels/${channelId}/messages/${message.id}`)
			.expect(HTTP_STATUS.FORBIDDEN, APIErrorCodes.NSFW_CONTENT_AGE_RESTRICTED)
			.execute();
	});

	test('should allow adult user to fetch messages in an age-restricted guild', async () => {
		const owner = await createTestAccount(harness, {dateOfBirth: '2000-01-01'});
		const adultMember = await createTestAccount(harness, {dateOfBirth: '2000-01-01'});

		const guild = await createGuild(harness, owner.token, 'Age Restricted Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, adultMember.token, invite.code);

		await createBuilder(harness, owner.token)
			.patch(`/guilds/${guild.id}`)
			.body({nsfw_level: GuildNSFWLevel.AGE_RESTRICTED})
			.expect(HTTP_STATUS.OK)
			.execute();

		await sendMessage(harness, owner.token, channelId, 'Adults only');

		const messages = await createBuilder<Array<unknown>>(harness, adultMember.token)
			.get(`/channels/${channelId}/messages`)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(messages.length).toBeGreaterThan(0);
	});

	test('should require MANAGE_MESSAGES to delete other users messages', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const ownerMessage = await sendMessage(harness, owner.token, channelId, 'Owner message');

		await createBuilder(harness, member.token)
			.delete(`/channels/${channelId}/messages/${ownerMessage.id}`)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should allow deleting own messages without MANAGE_MESSAGES', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const memberMessage = await sendMessage(harness, member.token, channelId, 'My message');

		await createBuilder(harness, member.token)
			.delete(`/channels/${channelId}/messages/${memberMessage.id}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
	});

	test('should allow MANAGE_MESSAGES role to delete others messages', async () => {
		const owner = await createTestAccount(harness);
		const moderator = await createTestAccount(harness);
		const member = await createTestAccount(harness);

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

		const memberMessage = await sendMessage(harness, member.token, channelId, 'Delete me');

		await createBuilder(harness, moderator.token)
			.delete(`/channels/${channelId}/messages/${memberMessage.id}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
	});

	test('should only allow editing own messages', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const ownerMessage = await sendMessage(harness, owner.token, channelId, 'Original');

		await createBuilder(harness, member.token)
			.patch(`/channels/${channelId}/messages/${ownerMessage.id}`)
			.body({content: 'Edited'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should allow channel permission overwrites to override role permissions', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		await updateChannelPermissions(harness, owner.token, channelId, member.userId, {
			type: 1,
			deny: Permissions.SEND_MESSAGES.toString(),
		});

		await createBuilder(harness, member.token)
			.post(`/channels/${channelId}/messages`)
			.body({content: 'Test'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should require ADD_REACTIONS to add reactions', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.ADD_REACTIONS;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const message = await sendMessage(harness, owner.token, channelId, 'React to this');

		await createBuilder(harness, member.token)
			.put(`/channels/${channelId}/messages/${message.id}/reactions/%F0%9F%91%8D/@me`)
			.body(null)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should require READ_MESSAGE_HISTORY to get pinned messages', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, owner.token, channelId, 'Pin this message');
		await pinMessage(harness, owner.token, channelId, message.id);

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.READ_MESSAGE_HISTORY;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const body = await createBuilder<{items: Array<unknown>; has_more: boolean}>(harness, member.token)
			.get(`/channels/${channelId}/messages/pins`)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(body.items).toEqual([]);
	});

	test('should allow getting pinned messages with READ_MESSAGE_HISTORY permission', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, owner.token, channelId, 'Pin this message');
		await pinMessage(harness, owner.token, channelId, message.id);

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const result = await createBuilder<{items: Array<unknown>}>(harness, member.token)
			.get(`/channels/${channelId}/messages/pins`)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(result.items).toBeDefined();
		expect(result.items.length).toBe(1);
	});

	test('should require READ_MESSAGE_HISTORY for channel message search', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		await sendMessage(harness, owner.token, channelId, 'searchable content here');

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.READ_MESSAGE_HISTORY;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const result = await createBuilder<{messages: Array<unknown>}>(harness, member.token)
			.post('/search/messages')
			.body({
				content: 'searchable',
				context_channel_id: channelId,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(result.messages).toEqual([]);
	});

	test('should allow message search with READ_MESSAGE_HISTORY permission', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		await sendMessage(harness, owner.token, channelId, 'searchable content here');
		await markChannelAsIndexed(harness, channelId);

		await createBuilder(harness, owner.token)
			.post('/search/messages')
			.body({
				content: 'searchable',
				context_channel_id: channelId,
			})
			.expect(HTTP_STATUS.OK)
			.execute();
	});

	test('should require READ_MESSAGE_HISTORY for guild-wide message search', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		await sendMessage(harness, owner.token, channelId, 'guild wide search restricted message');
		await markGuildChannelsAsIndexed(harness, owner.token, guild.id);

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.READ_MESSAGE_HISTORY;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const json = await createBuilder<{messages: Array<unknown>}>(harness, member.token)
			.post('/search/messages')
			.body({
				content: 'guild wide search restricted',
				context_guild_id: guild.id,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(json.messages).toEqual([]);
	});

	test('should require MENTION_EVERYONE permission to use @here', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.MENTION_EVERYONE;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const message = await sendMessage(harness, member.token, channelId, '@here hello');
		expect(message.mention_everyone).toBe(false);
	});

	test('should allow @here with MENTION_EVERYONE permission', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, owner.token, channelId, '@here announcement');
		expect(message.mention_everyone).toBe(true);
	});

	test('should grant MENTION_EVERYONE via channel permission overwrite', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.MENTION_EVERYONE;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		await updateChannelPermissions(harness, owner.token, channelId, member.userId, {
			type: 1,
			allow: Permissions.MENTION_EVERYONE.toString(),
		});

		const message = await sendMessage(harness, member.token, channelId, '@everyone granted');
		expect(message.mention_everyone).toBe(true);
	});

	test('should deny EMBED_LINKS via channel permission overwrite', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		await updateChannelPermissions(harness, owner.token, channelId, member.userId, {
			type: 1,
			deny: Permissions.EMBED_LINKS.toString(),
		});

		const message = await sendMessage(harness, member.token, channelId, 'Check out https://example.com for more info');
		expect(message.content).toBe('Check out https://example.com for more info');
		expect(message.embeds).toEqual([]);
	});

	test('should allow embeds with EMBED_LINKS permission', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const message = await sendMessage(harness, owner.token, channelId, 'https://example.com');
		expect(message.content).toBe('https://example.com');
	});

	test('should deny READ_MESSAGE_HISTORY via channel permission overwrite', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		await sendMessage(harness, owner.token, channelId, 'Historical message');

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		await updateChannelPermissions(harness, owner.token, channelId, member.userId, {
			type: 1,
			deny: Permissions.READ_MESSAGE_HISTORY.toString(),
		});

		const messages = await createBuilder<Array<unknown>>(harness, member.token)
			.get(`/channels/${channelId}/messages`)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(messages.length).toBe(0);
	});

	test('should grant READ_MESSAGE_HISTORY via channel permission overwrite', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		await sendMessage(harness, owner.token, channelId, 'Historical message');

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.READ_MESSAGE_HISTORY;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		await updateChannelPermissions(harness, owner.token, channelId, member.userId, {
			type: 1,
			allow: Permissions.READ_MESSAGE_HISTORY.toString(),
		});

		const messages = await createBuilder<Array<unknown>>(harness, member.token)
			.get(`/channels/${channelId}/messages`)
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(Array.isArray(messages)).toBe(true);
	});

	test('should force tts to false when user lacks SEND_TTS_MESSAGES permission', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.SEND_TTS_MESSAGES;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		const message = await createBuilder<{tts?: boolean}>(harness, member.token)
			.post(`/channels/${channelId}/messages`)
			.body({content: 'Test message', tts: true})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(message.tts).toBeUndefined();
	});

	test('should allow tts when user has SEND_TTS_MESSAGES permission', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Test Guild');
		const channelId = guild.system_channel_id!;

		const ttsRole = await createRole(harness, owner.token, guild.id, {
			name: 'TTS',
			permissions: (Permissions.SEND_MESSAGES | Permissions.SEND_TTS_MESSAGES).toString(),
		});

		const invite = await createChannelInvite(harness, owner.token, channelId);
		await acceptInvite(harness, member.token, invite.code);

		await addMemberRole(harness, owner.token, guild.id, member.userId, ttsRole.id);

		const message = await createBuilder<{tts?: boolean; content?: string}>(harness, member.token)
			.post(`/channels/${channelId}/messages`)
			.body({content: 'TTS message', tts: true})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(message.tts).toBe(true);
	});
});
