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
	createChannel,
	createGuild,
	createPermissionOverwrite,
	createRole,
	getChannel,
	setupTestGuildWithMembers,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

describe('Channel Permission Overwrites', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('should create permission overwrite for role', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channel = await createChannel(harness, account.token, guild.id, 'test-channel');
		const role = await createRole(harness, account.token, guild.id, {name: 'Test Role'});

		const overwrite = await createPermissionOverwrite(harness, account.token, channel.id, role.id, {
			type: 0,
			allow: Permissions.SEND_MESSAGES.toString(),
			deny: '0',
		});

		expect(overwrite.id).toBe(role.id);
		expect(overwrite.type).toBe(0);
	});

	test('should create permission overwrite for member', async () => {
		const {owner, members, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0];

		const overwrite = await createPermissionOverwrite(harness, owner.token, systemChannel.id, member.userId, {
			type: 1,
			allow: Permissions.VIEW_CHANNEL.toString(),
			deny: Permissions.SEND_MESSAGES.toString(),
		});

		expect(overwrite.id).toBe(member.userId);
		expect(overwrite.type).toBe(1);
	});

	test('should deny permission via overwrite', async () => {
		const {owner, members, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0];

		await createPermissionOverwrite(harness, owner.token, systemChannel.id, member.userId, {
			type: 1,
			allow: '0',
			deny: Permissions.SEND_MESSAGES.toString(),
		});

		await createBuilder(harness, member.token)
			.post(`/channels/${systemChannel.id}/messages`)
			.body({content: 'Test message'})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should allow permission via overwrite', async () => {
		const {owner, members, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0];

		await createPermissionOverwrite(harness, owner.token, systemChannel.id, member.userId, {
			type: 1,
			allow: Permissions.SEND_MESSAGES.toString(),
			deny: '0',
		});

		await createBuilder(harness, member.token)
			.post(`/channels/${systemChannel.id}/messages`)
			.body({content: 'Test message'})
			.execute();
	});

	test('should update existing permission overwrite', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channel = await createChannel(harness, account.token, guild.id, 'test-channel');
		const role = await createRole(harness, account.token, guild.id, {name: 'Test Role'});

		await createPermissionOverwrite(harness, account.token, channel.id, role.id, {
			type: 0,
			allow: Permissions.SEND_MESSAGES.toString(),
			deny: '0',
		});

		const updated = await createPermissionOverwrite(harness, account.token, channel.id, role.id, {
			type: 0,
			allow: (Permissions.SEND_MESSAGES | Permissions.EMBED_LINKS).toString(),
			deny: '0',
		});

		expect(BigInt(updated.allow)).toBe(Permissions.SEND_MESSAGES | Permissions.EMBED_LINKS);
	});

	test('should delete permission overwrite', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channel = await createChannel(harness, account.token, guild.id, 'test-channel');
		const role = await createRole(harness, account.token, guild.id, {name: 'Test Role'});

		await createPermissionOverwrite(harness, account.token, channel.id, role.id, {
			type: 0,
			allow: Permissions.SEND_MESSAGES.toString(),
			deny: '0',
		});

		await createBuilder(harness, account.token)
			.delete(`/channels/${channel.id}/permissions/${role.id}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();

		const channelData = await getChannel(harness, account.token, channel.id);
		const overwrite = channelData.permission_overwrites?.find((o) => o.id === role.id);
		expect(overwrite).toBeUndefined();
	});

	test('should require MANAGE_ROLES to create overwrites', async () => {
		const {owner, members, guild, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0];
		const role = await createRole(harness, owner.token, guild.id, {name: 'Test Role'});

		await createBuilder(harness, member.token)
			.put(`/channels/${systemChannel.id}/permissions/${role.id}`)
			.body({
				type: 0,
				allow: Permissions.SEND_MESSAGES.toString(),
				deny: '0',
			})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('should show overwrites in channel response', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channel = await createChannel(harness, account.token, guild.id, 'test-channel');
		const role = await createRole(harness, account.token, guild.id, {name: 'Test Role'});

		await createPermissionOverwrite(harness, account.token, channel.id, role.id, {
			type: 0,
			allow: Permissions.SEND_MESSAGES.toString(),
			deny: '0',
		});

		const channelData = await getChannel(harness, account.token, channel.id);
		expect(channelData.permission_overwrites).toBeDefined();
		expect(channelData.permission_overwrites?.some((o) => o.id === role.id)).toBe(true);
	});

	test('should prioritize member overwrite over role overwrite', async () => {
		const {owner, members, guild, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0];
		const role = await createRole(harness, owner.token, guild.id, {name: 'Deny Role'});

		await createBuilder<void>(harness, owner.token)
			.put(`/guilds/${guild.id}/members/${member.userId}/roles/${role.id}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();

		await createPermissionOverwrite(harness, owner.token, systemChannel.id, role.id, {
			type: 0,
			allow: '0',
			deny: Permissions.SEND_MESSAGES.toString(),
		});

		await createPermissionOverwrite(harness, owner.token, systemChannel.id, member.userId, {
			type: 1,
			allow: Permissions.SEND_MESSAGES.toString(),
			deny: '0',
		});

		await createBuilder(harness, member.token)
			.post(`/channels/${systemChannel.id}/messages`)
			.body({content: 'Test message'})
			.execute();
	});

	test('should reject invalid overwrite type', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channel = await createChannel(harness, account.token, guild.id, 'test-channel');

		await createBuilder(harness, account.token)
			.put(`/channels/${channel.id}/permissions/123456789`)
			.body({
				type: 999,
				allow: '0',
				deny: '0',
			})
			.expect(HTTP_STATUS.BAD_REQUEST)
			.execute();
	});

	test('should handle multiple overlapping role overwrites', async () => {
		const account = await createTestAccount(harness);
		const guild = await createGuild(harness, account.token, 'Test Guild');
		const channel = await createChannel(harness, account.token, guild.id, 'test-channel');

		const role1 = await createRole(harness, account.token, guild.id, {name: 'Role 1'});
		const role2 = await createRole(harness, account.token, guild.id, {name: 'Role 2'});

		await createPermissionOverwrite(harness, account.token, channel.id, role1.id, {
			type: 0,
			allow: Permissions.SEND_MESSAGES.toString(),
			deny: '0',
		});

		await createPermissionOverwrite(harness, account.token, channel.id, role2.id, {
			type: 0,
			allow: Permissions.EMBED_LINKS.toString(),
			deny: '0',
		});

		const channelData = await getChannel(harness, account.token, channel.id);
		expect(channelData.permission_overwrites?.length).toBeGreaterThanOrEqual(2);
	});
});
