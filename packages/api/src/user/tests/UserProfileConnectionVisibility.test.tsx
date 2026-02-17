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
import {createUserID} from '@fluxer/api/src/BrandedTypes';
import {createFriendship} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {
	createBlueskyConnectionViaOAuth,
	createBlueskyDid,
	createBlueskyHandle,
	updateConnection,
} from '@fluxer/api/src/connection/tests/ConnectionTestUtils';
import {acceptInvite, createChannelInvite, createGuild, getChannel} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {ConnectionTypes, ConnectionVisibilityFlags} from '@fluxer/constants/src/ConnectionConstants';
import type {UserProfileFullResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

async function getUserProfile(
	harness: ApiTestHarness,
	token: string,
	userId: string,
): Promise<UserProfileFullResponse> {
	return createBuilder<UserProfileFullResponse>(harness, token).get(`/users/${userId}/profile`).execute();
}

describe('User Profile Connection Visibility', () => {
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

	describe('Viewing own profile', () => {
		it('shows all verified connections regardless of visibility flags', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));

			const connection1 = await createBlueskyConnectionViaOAuth(
				harness,
				account.token,
				createBlueskyHandle('user1'),
				createBlueskyDid('user1'),
				userId,
			);

			const connection2 = await createBlueskyConnectionViaOAuth(
				harness,
				account.token,
				createBlueskyHandle('user2'),
				createBlueskyDid('user2'),
				userId,
			);

			const connection3 = await createBlueskyConnectionViaOAuth(
				harness,
				account.token,
				createBlueskyHandle('user3'),
				createBlueskyDid('user3'),
				userId,
			);

			await updateConnection(harness, account.token, ConnectionTypes.BLUESKY, connection1.id, {
				visibility_flags: ConnectionVisibilityFlags.EVERYONE,
			});

			await updateConnection(harness, account.token, ConnectionTypes.BLUESKY, connection2.id, {
				visibility_flags: ConnectionVisibilityFlags.FRIENDS,
			});

			await updateConnection(harness, account.token, ConnectionTypes.BLUESKY, connection3.id, {
				visibility_flags: ConnectionVisibilityFlags.MUTUAL_GUILDS,
			});

			const profile = await getUserProfile(harness, account.token, account.userId);
			expect(profile.connected_accounts).toHaveLength(3);
		});
	});

	describe('EVERYONE visibility', () => {
		it('shows connections with EVERYONE flag to any viewer who can access profile', async () => {
			const targetAccount = await createTestAccount(harness);
			const viewerAccount = await createTestAccount(harness);
			const targetUserId = createUserID(BigInt(targetAccount.userId));

			const connection = await createBlueskyConnectionViaOAuth(
				harness,
				targetAccount.token,
				createBlueskyHandle('target'),
				createBlueskyDid('target'),
				targetUserId,
			);

			await updateConnection(harness, targetAccount.token, ConnectionTypes.BLUESKY, connection.id, {
				visibility_flags: ConnectionVisibilityFlags.EVERYONE,
			});

			await createFriendship(harness, targetAccount, viewerAccount);

			const profile = await getUserProfile(harness, viewerAccount.token, targetAccount.userId);
			expect(profile.connected_accounts).toHaveLength(1);
			expect(profile.connected_accounts![0].id).toBe(connection.id);
		});
	});

	describe('FRIENDS_ONLY visibility', () => {
		it('shows connections with FRIENDS_ONLY flag only to friends', async () => {
			const targetAccount = await createTestAccount(harness);
			const friendAccount = await createTestAccount(harness);
			const targetUserId = createUserID(BigInt(targetAccount.userId));

			const connection = await createBlueskyConnectionViaOAuth(
				harness,
				targetAccount.token,
				createBlueskyHandle('target'),
				createBlueskyDid('target'),
				targetUserId,
			);

			await updateConnection(harness, targetAccount.token, ConnectionTypes.BLUESKY, connection.id, {
				visibility_flags: ConnectionVisibilityFlags.FRIENDS,
			});

			await createFriendship(harness, targetAccount, friendAccount);

			const friendProfile = await getUserProfile(harness, friendAccount.token, targetAccount.userId);
			expect(friendProfile.connected_accounts).toHaveLength(1);
			expect(friendProfile.connected_accounts![0].id).toBe(connection.id);
		});

		it('hides FRIENDS_ONLY connections from non-friends even with mutual guilds', async () => {
			const targetAccount = await createTestAccount(harness);
			const guildMemberAccount = await createTestAccount(harness);
			const targetUserId = createUserID(BigInt(targetAccount.userId));

			const connection = await createBlueskyConnectionViaOAuth(
				harness,
				targetAccount.token,
				createBlueskyHandle('target'),
				createBlueskyDid('target'),
				targetUserId,
			);

			await updateConnection(harness, targetAccount.token, ConnectionTypes.BLUESKY, connection.id, {
				visibility_flags: ConnectionVisibilityFlags.FRIENDS,
			});

			const guild = await createGuild(harness, targetAccount.token, 'Test Guild');
			const systemChannel = await getChannel(harness, targetAccount.token, guild.system_channel_id!);
			const invite = await createChannelInvite(harness, targetAccount.token, systemChannel.id);
			await acceptInvite(harness, guildMemberAccount.token, invite.code);

			const profile = await getUserProfile(harness, guildMemberAccount.token, targetAccount.userId);
			expect(profile.connected_accounts).toHaveLength(0);
		});
	});

	describe('MUTUAL_GUILDS visibility', () => {
		it('shows connections with MUTUAL_GUILDS flag only to users who share a guild', async () => {
			const targetAccount = await createTestAccount(harness);
			const guildMemberAccount = await createTestAccount(harness);
			const strangerAccount = await createTestAccount(harness);
			const targetUserId = createUserID(BigInt(targetAccount.userId));

			const connection = await createBlueskyConnectionViaOAuth(
				harness,
				targetAccount.token,
				createBlueskyHandle('target'),
				createBlueskyDid('target'),
				targetUserId,
			);

			await updateConnection(harness, targetAccount.token, ConnectionTypes.BLUESKY, connection.id, {
				visibility_flags: ConnectionVisibilityFlags.MUTUAL_GUILDS,
			});

			const guild = await createGuild(harness, targetAccount.token, 'Test Guild');
			const systemChannel = await getChannel(harness, targetAccount.token, guild.system_channel_id!);
			const invite = await createChannelInvite(harness, targetAccount.token, systemChannel.id);
			await acceptInvite(harness, guildMemberAccount.token, invite.code);

			const guildMemberProfile = await getUserProfile(harness, guildMemberAccount.token, targetAccount.userId);
			expect(guildMemberProfile.connected_accounts).toHaveLength(1);
			expect(guildMemberProfile.connected_accounts![0].id).toBe(connection.id);

			await createFriendship(harness, targetAccount, strangerAccount);

			const strangerProfile = await getUserProfile(harness, strangerAccount.token, targetAccount.userId);
			expect(strangerProfile.connected_accounts).toHaveLength(0);
		});

		it('hides MUTUAL_GUILDS connections from friends without shared guilds', async () => {
			const targetAccount = await createTestAccount(harness);
			const friendAccount = await createTestAccount(harness);
			const targetUserId = createUserID(BigInt(targetAccount.userId));

			const connection = await createBlueskyConnectionViaOAuth(
				harness,
				targetAccount.token,
				createBlueskyHandle('target'),
				createBlueskyDid('target'),
				targetUserId,
			);

			await updateConnection(harness, targetAccount.token, ConnectionTypes.BLUESKY, connection.id, {
				visibility_flags: ConnectionVisibilityFlags.MUTUAL_GUILDS,
			});

			await createFriendship(harness, targetAccount, friendAccount);

			const profile = await getUserProfile(harness, friendAccount.token, targetAccount.userId);
			expect(profile.connected_accounts).toHaveLength(0);
		});
	});

	describe('Multiple visibility flags (bitwise OR)', () => {
		it('shows connection if any visibility flag condition is met', async () => {
			const targetAccount = await createTestAccount(harness);
			const friendAccount = await createTestAccount(harness);
			const guildMemberAccount = await createTestAccount(harness);
			const targetUserId = createUserID(BigInt(targetAccount.userId));

			const connection = await createBlueskyConnectionViaOAuth(
				harness,
				targetAccount.token,
				createBlueskyHandle('target'),
				createBlueskyDid('target'),
				targetUserId,
			);

			await updateConnection(harness, targetAccount.token, ConnectionTypes.BLUESKY, connection.id, {
				visibility_flags: ConnectionVisibilityFlags.FRIENDS | ConnectionVisibilityFlags.MUTUAL_GUILDS,
			});

			await createFriendship(harness, targetAccount, friendAccount);

			const friendProfile = await getUserProfile(harness, friendAccount.token, targetAccount.userId);
			expect(friendProfile.connected_accounts).toHaveLength(1);

			const guild = await createGuild(harness, targetAccount.token, 'Test Guild');
			const systemChannel = await getChannel(harness, targetAccount.token, guild.system_channel_id!);
			const invite = await createChannelInvite(harness, targetAccount.token, systemChannel.id);
			await acceptInvite(harness, guildMemberAccount.token, invite.code);

			const guildMemberProfile = await getUserProfile(harness, guildMemberAccount.token, targetAccount.userId);
			expect(guildMemberProfile.connected_accounts).toHaveLength(1);
		});
	});

	describe('Sort order', () => {
		it('returns connections sorted by sort_order field', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));

			const connection1 = await createBlueskyConnectionViaOAuth(
				harness,
				account.token,
				createBlueskyHandle('user1'),
				createBlueskyDid('user1'),
				userId,
			);

			const connection2 = await createBlueskyConnectionViaOAuth(
				harness,
				account.token,
				createBlueskyHandle('user2'),
				createBlueskyDid('user2'),
				userId,
			);

			const connection3 = await createBlueskyConnectionViaOAuth(
				harness,
				account.token,
				createBlueskyHandle('user3'),
				createBlueskyDid('user3'),
				userId,
			);

			await updateConnection(harness, account.token, ConnectionTypes.BLUESKY, connection1.id, {
				sort_order: 2,
			});

			await updateConnection(harness, account.token, ConnectionTypes.BLUESKY, connection2.id, {
				sort_order: 0,
			});

			await updateConnection(harness, account.token, ConnectionTypes.BLUESKY, connection3.id, {
				sort_order: 1,
			});

			const profile = await getUserProfile(harness, account.token, account.userId);
			expect(profile.connected_accounts).toHaveLength(3);
			expect(profile.connected_accounts![0].id).toBe(connection2.id);
			expect(profile.connected_accounts![1].id).toBe(connection3.id);
			expect(profile.connected_accounts![2].id).toBe(connection1.id);
		});
	});
});
