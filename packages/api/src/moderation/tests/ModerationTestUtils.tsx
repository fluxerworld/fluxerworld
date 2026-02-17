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

import {createTestAccount, type TestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {
	acceptInvite,
	createChannelInvite,
	createGuild,
	getChannel,
	setupTestGuildWithMembers,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';

export async function banUser(
	harness: ApiTestHarness,
	moderatorToken: string,
	guildId: string,
	targetUserId: string,
	deleteMessageDays = 0,
): Promise<void> {
	await createBuilder<void>(harness, moderatorToken)
		.put(`/guilds/${guildId}/bans/${targetUserId}`)
		.body({
			delete_message_days: deleteMessageDays,
		})
		.expect(204)
		.execute();
}

export async function createTimeoutModerationSetup(harness: ApiTestHarness): Promise<{
	owner: TestAccount;
	moderator: TestAccount;
	targetModerator: TestAccount;
	higherMember: TestAccount;
	guild: {id: string; name: string; system_channel_id?: string | null};
	moderatorRole: {id: string};
	juniorModeratorRole: {id: string};
	higherRole: {id: string};
}> {
	const {owner, members, guild} = await setupTestGuildWithMembers(harness, 3);

	const [moderator, targetModerator, higherMember] = members;

	const moderatorRole = await createRoleWithPermissions(
		harness,
		owner.token,
		guild.id,
		'Timeout Moderator Role',
		1n << 40n,
	);
	const juniorModeratorRole = await createRoleWithPermissions(
		harness,
		owner.token,
		guild.id,
		'Junior Moderator Role',
		1n << 40n,
	);
	const higherRole = await createRoleWithPermissions(harness, owner.token, guild.id, 'Higher Role', 0n);

	await updateRolePositions(harness, owner.token, guild.id, [
		{id: higherRole.id, position: 3},
		{id: moderatorRole.id, position: 2},
		{id: juniorModeratorRole.id, position: 1},
	]);

	await addMemberRole(harness, owner.token, guild.id, moderator.userId, moderatorRole.id);
	await addMemberRole(harness, owner.token, guild.id, targetModerator.userId, juniorModeratorRole.id);
	await addMemberRole(harness, owner.token, guild.id, higherMember.userId, higherRole.id);

	return {
		owner,
		moderator,
		targetModerator,
		higherMember,
		guild,
		moderatorRole,
		juniorModeratorRole,
		higherRole,
	};
}

async function createRoleWithPermissions(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	name: string,
	permissions: bigint,
): Promise<{id: string}> {
	return createBuilder<{id: string}>(harness, token)
		.post(`/guilds/${guildId}/roles`)
		.body({
			name,
			permissions: permissions.toString(),
		})
		.execute();
}

async function updateRolePositions(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	roles: Array<{id: string; position: number}>,
): Promise<void> {
	await createBuilder<void>(harness, token).patch(`/guilds/${guildId}/roles`).body(roles).expect(204).execute();
}

async function addMemberRole(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	userId: string,
	roleId: string,
): Promise<void> {
	await createBuilder<void>(harness, token)
		.put(`/guilds/${guildId}/members/${userId}/roles/${roleId}`)
		.expect(204)
		.execute();
}

export async function timeoutMember(
	harness: ApiTestHarness,
	token: string,
	guildId: string,
	targetUserId: string,
	minutesIntoFuture: number,
	expectedStatus: number = 200,
): Promise<{response: Response}> {
	const timeoutDate = new Date(Date.now() + minutesIntoFuture * 60 * 1000).toISOString();

	return await createBuilder<unknown>(harness, token)
		.patch(`/guilds/${guildId}/members/${targetUserId}`)
		.body({
			communication_disabled_until: timeoutDate,
		})
		.expect(expectedStatus)
		.executeWithResponse();
}

export async function createBannedUserSetup(harness: ApiTestHarness): Promise<{
	owner: TestAccount;
	target: TestAccount;
	guild: {id: string; name: string; system_channel_id?: string | null};
	channelId: string;
}> {
	const owner = await createTestAccount(harness);
	const target = await createTestAccount(harness);

	const guild = await createGuild(harness, owner.token, `Ban Test Guild ${Date.now()}`);
	const channel = await getChannel(harness, owner.token, guild.system_channel_id!);

	const invite = await createChannelInvite(harness, owner.token, channel.id);
	await acceptInvite(harness, target.token, invite.code);

	return {owner, target, guild, channelId: channel.id};
}
