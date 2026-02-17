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
	addMemberRole,
	createChannelInvite,
	createGuild,
	createRole,
	getChannel,
	getMember,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {createOAuth2Application, createUniqueApplicationName} from '@fluxer/api/src/oauth/tests/OAuth2TestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import type {GuildRoleResponse} from '@fluxer/schema/src/domains/guild/GuildRoleSchemas';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('OAuth2 Bot Guild Add', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('should add bot to guild with proper role creation', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Bot Test Guild');

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
			bot_public: true,
		});

		await createBuilder(harness, owner.token)
			.post('/oauth2/authorize/consent')
			.body({
				client_id: app.application.id,
				scope: 'bot',
				guild_id: guild.id,
				permissions: Permissions.SEND_MESSAGES.toString(),
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const botMember = await getMember(harness, owner.token, guild.id, app.botUserId);
		expect(botMember.user?.id).toBe(app.botUserId);
	});

	test('should require MANAGE_GUILD permission to add bot', async () => {
		const owner = await createTestAccount(harness);
		const regularUser = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Bot Test Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);
		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, regularUser.token, invite.code);

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
			bot_public: true,
		});

		await createBuilder(harness, regularUser.token)
			.post('/oauth2/authorize/consent')
			.body({
				client_id: app.application.id,
				scope: 'bot',
				guild_id: guild.id,
				permissions: '0',
			})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should reject adding bot that is already in guild', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Bot Test Guild');

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
			bot_public: true,
		});

		await createBuilder(harness, owner.token)
			.post('/oauth2/authorize/consent')
			.body({
				client_id: app.application.id,
				scope: 'bot',
				guild_id: guild.id,
				permissions: '0',
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		await createBuilder(harness, owner.token)
			.post('/oauth2/authorize/consent')
			.body({
				client_id: app.application.id,
				scope: 'bot',
				guild_id: guild.id,
				permissions: '0',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should gracefully handle unknown permission bits', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Bot Test Guild');

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
			bot_public: true,
		});

		const unknownPermissionBits = (1n << 60n).toString();

		await createBuilder(harness, owner.token)
			.post('/oauth2/authorize/consent')
			.body({
				client_id: app.application.id,
				scope: 'bot',
				guild_id: guild.id,
				permissions: unknownPermissionBits,
			})
			.expect(HTTP_STATUS.OK)
			.execute();
	});

	test('should add bot without permissions when permissions is 0', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Bot Test Guild');

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
			bot_public: true,
		});

		await createBuilder(harness, owner.token)
			.post('/oauth2/authorize/consent')
			.body({
				client_id: app.application.id,
				scope: 'bot',
				guild_id: guild.id,
				permissions: '0',
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const botMember = await getMember(harness, owner.token, guild.id, app.botUserId);
		expect(botMember.user?.id).toBe(app.botUserId);
	});

	test('should reject bot scope for non-public bot without owner consent', async () => {
		const owner = await createTestAccount(harness);
		const otherUser = await createTestAccount(harness);

		const guild = await createGuild(harness, otherUser.token, 'Other User Guild');

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
			bot_public: false,
		});

		await createBuilder(harness, otherUser.token)
			.post('/oauth2/authorize/consent')
			.body({
				client_id: app.application.id,
				scope: 'bot',
				guild_id: guild.id,
				permissions: '0',
			})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should allow public bot to be added by any user with MANAGE_GUILD', async () => {
		const owner = await createTestAccount(harness);
		const otherUser = await createTestAccount(harness);

		const guild = await createGuild(harness, otherUser.token, 'Other User Guild');

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
			bot_public: true,
		});

		await createBuilder(harness, otherUser.token)
			.post('/oauth2/authorize/consent')
			.body({
				client_id: app.application.id,
				scope: 'bot',
				guild_id: guild.id,
				permissions: '0',
			})
			.expect(HTTP_STATUS.OK)
			.execute();
	});

	test('should reject negative permissions', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Bot Test Guild');

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
			bot_public: true,
		});

		await createBuilder(harness, owner.token)
			.post('/oauth2/authorize/consent')
			.body({
				client_id: app.application.id,
				scope: 'bot',
				guild_id: guild.id,
				permissions: '-1',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should reject invalid permissions string', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Bot Test Guild');

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
			bot_public: true,
		});

		await createBuilder(harness, owner.token)
			.post('/oauth2/authorize/consent')
			.body({
				client_id: app.application.id,
				scope: 'bot',
				guild_id: guild.id,
				permissions: 'not_a_number',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should create role with correct permissions and assign to bot', async () => {
		const owner = await createTestAccount(harness);
		const guild = await createGuild(harness, owner.token, 'Bot Test Guild');

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
			bot_public: true,
		});

		const requestedPermissions = Permissions.SEND_MESSAGES | Permissions.MANAGE_MESSAGES;

		await createBuilder(harness, owner.token)
			.post('/oauth2/authorize/consent')
			.body({
				client_id: app.application.id,
				scope: 'bot',
				guild_id: guild.id,
				permissions: requestedPermissions.toString(),
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const roles = await createBuilder<Array<GuildRoleResponse>>(harness, owner.token)
			.get(`/guilds/${guild.id}/roles`)
			.execute();

		const botRole = roles.find((r) => r.name === app.application.name);
		expect(botRole).toBeDefined();
		expect(BigInt(botRole!.permissions)).toBe(requestedPermissions);

		const botMember = await getMember(harness, owner.token, guild.id, app.botUserId);
		expect(botMember.roles).toContain(botRole!.id);
	});

	test('should succeed when admin with MANAGE_GUILD adds bot with permissions they lack', async () => {
		const owner = await createTestAccount(harness);
		const admin = await createTestAccount(harness);

		const guild = await createGuild(harness, owner.token, 'Bot Test Guild');
		const systemChannel = await getChannel(harness, owner.token, guild.system_channel_id!);
		const invite = await createChannelInvite(harness, owner.token, systemChannel.id);
		await acceptInvite(harness, admin.token, invite.code);

		const adminRole = await createRole(harness, owner.token, guild.id, {
			name: 'Admin',
			permissions: (Permissions.MANAGE_GUILD | Permissions.SEND_MESSAGES).toString(),
		});
		await addMemberRole(harness, owner.token, guild.id, admin.userId, adminRole.id);

		const app = await createOAuth2Application(harness, owner.token, {
			name: createUniqueApplicationName(),
			redirect_uris: ['https://example.com/callback'],
			bot_public: true,
		});

		const botPermissions = Permissions.MANAGE_MESSAGES | Permissions.MANAGE_CHANNELS;

		await createBuilder(harness, admin.token)
			.post('/oauth2/authorize/consent')
			.body({
				client_id: app.application.id,
				scope: 'bot',
				guild_id: guild.id,
				permissions: botPermissions.toString(),
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const roles = await createBuilder<Array<GuildRoleResponse>>(harness, owner.token)
			.get(`/guilds/${guild.id}/roles`)
			.execute();

		const botRole = roles.find((r) => r.name === app.application.name);
		expect(botRole).toBeDefined();
		expect(BigInt(botRole!.permissions)).toBe(botPermissions);

		const botMember = await getMember(harness, owner.token, guild.id, app.botUserId);
		expect(botMember.roles).toContain(botRole!.id);
	});
});
