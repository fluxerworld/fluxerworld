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

import {setupTestGuildWithMembers} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {addMemberRole, createRole, getRoles, updateRole} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {updateChannelPermissions} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {sendTypingIndicator} from '@fluxer/api/src/typing/tests/TypingTestUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {afterEach, beforeEach, describe, test} from 'vitest';

describe('Typing permissions', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('requires SEND_MESSAGES permission for typing indicator', async () => {
		const {owner, members, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0]!;

		await updateChannelPermissions(harness, owner.token, systemChannel.id, member.userId, {
			type: 1,
			deny: Permissions.SEND_MESSAGES.toString(),
		});

		await createBuilder(harness, member.token)
			.post(`/channels/${systemChannel.id}/typing`)
			.body({})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('requires VIEW_CHANNEL permission for typing indicator', async () => {
		const {owner, members, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0]!;

		await updateChannelPermissions(harness, owner.token, systemChannel.id, member.userId, {
			type: 1,
			deny: Permissions.VIEW_CHANNEL.toString(),
		});

		await createBuilder(harness, member.token)
			.post(`/channels/${systemChannel.id}/typing`)
			.body({})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('allows typing with SEND_MESSAGES permission from role', async () => {
		const {owner, members, guild, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0]!;

		const typingRole = await createRole(harness, owner.token, guild.id, {
			name: 'Can Type',
			permissions: Permissions.SEND_MESSAGES.toString(),
		});

		await createBuilder<void>(harness, owner.token)
			.put(`/guilds/${guild.id}/members/${member.userId}/roles/${typingRole.id}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();

		await sendTypingIndicator(harness, member.token, systemChannel.id);
	});

	test('denies typing when SEND_MESSAGES denied via @everyone role', async () => {
		const {owner, members, guild, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0]!;

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.SEND_MESSAGES;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		await createBuilder(harness, member.token)
			.post(`/channels/${systemChannel.id}/typing`)
			.body({})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('denies typing when VIEW_CHANNEL denied via @everyone role', async () => {
		const {owner, members, guild, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0]!;

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.VIEW_CHANNEL;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		await createBuilder(harness, member.token)
			.post(`/channels/${systemChannel.id}/typing`)
			.body({})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});

	test('channel overwrite can override role permission for typing', async () => {
		const {owner, members, guild, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0]!;

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.SEND_MESSAGES;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		await updateChannelPermissions(harness, owner.token, systemChannel.id, member.userId, {
			type: 1,
			allow: Permissions.SEND_MESSAGES.toString(),
		});

		await sendTypingIndicator(harness, member.token, systemChannel.id);
	});

	test('owner can always send typing indicator regardless of permissions', async () => {
		const {owner, guild, systemChannel} = await setupTestGuildWithMembers(harness, 0);

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.SEND_MESSAGES;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		await sendTypingIndicator(harness, owner.token, systemChannel.id);
	});

	test('member with role granting SEND_MESSAGES can type', async () => {
		const {owner, members, guild, systemChannel} = await setupTestGuildWithMembers(harness, 1);
		const member = members[0]!;

		const roles = await getRoles(harness, owner.token, guild.id);
		const everyoneRole = roles.find((r) => r.id === guild.id);

		if (everyoneRole) {
			const permissions = BigInt(everyoneRole.permissions);
			const newPermissions = permissions & ~Permissions.SEND_MESSAGES;
			await updateRole(harness, owner.token, guild.id, everyoneRole.id, {
				permissions: newPermissions.toString(),
			});
		}

		const typingRole = await createRole(harness, owner.token, guild.id, {
			name: 'Typer',
			permissions: (Permissions.VIEW_CHANNEL | Permissions.SEND_MESSAGES).toString(),
		});

		await addMemberRole(harness, owner.token, guild.id, member.userId, typingRole.id);

		await sendTypingIndicator(harness, member.token, systemChannel.id);
	});
});
