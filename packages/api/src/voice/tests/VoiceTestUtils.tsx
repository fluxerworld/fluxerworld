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

import {createTestAccount as authCreateTestAccount, type TestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {
	acceptInvite,
	createChannel,
	createChannelInvite,
	createDmChannel,
	createFriendship,
	createGuild,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import type {ChannelResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import type {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';

export async function createTestAccount(harness: ApiTestHarness): Promise<TestAccount> {
	return authCreateTestAccount(harness);
}

export async function createTestAccountUnclaimed(harness: ApiTestHarness): Promise<TestAccount> {
	const account = await authCreateTestAccount(harness);
	await createBuilder(harness, '').post(`/test/users/${account.userId}/unclaim`).body(null).execute();
	return account;
}

export async function createGuildWithVoiceChannel(
	harness: ApiTestHarness,
	token: string,
	guildName: string,
): Promise<{guild: GuildResponse; voiceChannel: ChannelResponse}> {
	const guild = await createGuild(harness, token, guildName);
	const voiceChannel = await createChannel(harness, token, guild.id, 'voice-test', ChannelTypes.GUILD_VOICE);
	return {guild, voiceChannel};
}

export interface VoiceTestSetup {
	owner: TestAccount;
	member: TestAccount;
	guild: GuildResponse;
	voiceChannel: ChannelResponse;
	textChannel: ChannelResponse;
}

export async function setupVoiceTestGuild(harness: ApiTestHarness): Promise<VoiceTestSetup> {
	const owner = await createTestAccount(harness);
	const member = await createTestAccount(harness);

	await ensureSessionStarted(harness, owner.token);
	await ensureSessionStarted(harness, member.token);

	const guild = await createGuild(harness, owner.token, 'Voice Test Guild');
	const voiceChannel = await createChannel(harness, owner.token, guild.id, 'voice-test', ChannelTypes.GUILD_VOICE);
	const textChannel = await createChannel(harness, owner.token, guild.id, 'text-test', ChannelTypes.GUILD_TEXT);

	const invite = await createChannelInvite(harness, owner.token, guild.system_channel_id!);
	await acceptInvite(harness, member.token, invite.code);

	return {owner, member, guild, voiceChannel, textChannel};
}

export interface DmCallTestSetup {
	user1: TestAccount;
	user2: TestAccount;
	dmChannel: {id: string; type: number};
}

export async function setupDmCallTest(harness: ApiTestHarness): Promise<DmCallTestSetup> {
	const user1 = await createTestAccount(harness);
	const user2 = await createTestAccount(harness);

	await ensureSessionStarted(harness, user1.token);
	await ensureSessionStarted(harness, user2.token);

	const guild = await createGuild(harness, user1.token, 'Mutual Guild');
	const invite = await createChannelInvite(harness, user1.token, guild.system_channel_id!);
	await acceptInvite(harness, user2.token, invite.code);

	const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

	return {user1, user2, dmChannel};
}

export async function setupDmCallTestWithFriendship(harness: ApiTestHarness): Promise<DmCallTestSetup> {
	const user1 = await createTestAccount(harness);
	const user2 = await createTestAccount(harness);

	await ensureSessionStarted(harness, user1.token);
	await ensureSessionStarted(harness, user2.token);

	await createFriendship(harness, user1, user2);

	const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

	return {user1, user2, dmChannel};
}

export async function getCallEligibility(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
): Promise<{ringable: boolean; silent?: boolean}> {
	return createBuilder<{ringable: boolean; silent?: boolean}>(harness, token)
		.get(`/channels/${channelId}/call`)
		.execute();
}

export async function ringCall(
	harness: ApiTestHarness,
	token: string,
	channelId: string,
	recipients?: Array<string>,
): Promise<void> {
	const body = recipients ? {recipients} : {};
	await createBuilder(harness, token).post(`/channels/${channelId}/call/ring`).body(body).expect(204).execute();
}

export async function endCall(harness: ApiTestHarness, token: string, channelId: string): Promise<void> {
	await createBuilder(harness, token).post(`/channels/${channelId}/call/end`).body(null).expect(204).execute();
}
