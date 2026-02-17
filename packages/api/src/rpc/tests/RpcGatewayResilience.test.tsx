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
import {createOAuth2BotApplication} from '@fluxer/api/src/bot/tests/BotTestUtils';
import {Config} from '@fluxer/api/src/Config';
import {setupTestGuildWithMembers} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {createFriendship} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {grantPremium, updateUserProfile} from '@fluxer/api/src/user/tests/UserTestUtils';
import {UserFlags, UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {afterEach, beforeEach, describe, expect, test} from 'vitest';

interface SessionRpcResponse {
	type: 'session';
	data: {
		user: {
			id: string;
			discriminator: string;
		};
		relationships: Array<{
			id: string;
		}>;
	};
}

interface GuildRpcResponse {
	type: 'guild';
	data: {
		members: Array<{
			user: {
				id: string;
			};
		}>;
	};
}

describe('Gateway RPC resilience', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness.shutdown();
	});

	test('session RPC skips relationships pointing to deleted users', async () => {
		const account = await createTestAccount(harness);
		const friend = await createTestAccount(harness);

		await createFriendship(harness, account, friend);

		await createBuilder(harness, '')
			.patch(`/test/users/${friend.userId}/flags`)
			.body({flags: UserFlags.DELETED.toString()})
			.expect(HTTP_STATUS.OK)
			.execute();
		await createBuilder(harness, '').post('/test/cache-clear').expect(HTTP_STATUS.OK).execute();

		const response = await createBuilder<SessionRpcResponse>(harness, `Bearer ${Config.gateway.rpcSecret}`)
			.post('/_rpc')
			.body({
				type: 'session',
				token: account.token,
				version: 1,
				ip: '127.0.0.1',
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(response.type).toBe('session');
		expect(response.data.relationships.some((relationship) => relationship.id === friend.userId)).toBe(false);
	});

	test('session RPC authenticates bot tokens with Bot prefix', async () => {
		const owner = await createTestAccount(harness);
		const bot = await createOAuth2BotApplication(harness, owner.token, `RPC Bot Prefix ${Date.now()}`);

		const response = await createBuilder<SessionRpcResponse>(harness, `Bearer ${Config.gateway.rpcSecret}`)
			.post('/_rpc')
			.body({
				type: 'session',
				token: `Bot ${bot.botToken}`,
				version: 1,
				ip: '127.0.0.1',
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(response.type).toBe('session');
		expect(response.data.user.id).toBe(bot.botUserId);
	});

	test('guild RPC skips members whose backing users are deleted', async () => {
		const {owner, members, guild} = await setupTestGuildWithMembers(harness, 1);
		const staleMember = members[0];
		expect(staleMember).toBeDefined();

		await createBuilder(harness, '')
			.patch(`/test/users/${staleMember!.userId}/flags`)
			.body({flags: UserFlags.DELETED.toString()})
			.expect(HTTP_STATUS.OK)
			.execute();
		await createBuilder(harness, '').post('/test/cache-clear').expect(HTTP_STATUS.OK).execute();

		const response = await createBuilder<GuildRpcResponse>(harness, `Bearer ${Config.gateway.rpcSecret}`)
			.post('/_rpc')
			.body({
				type: 'guild',
				guild_id: guild.id,
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(response.type).toBe('guild');
		expect(response.data.members.some((member) => member.user.id === staleMember!.userId)).toBe(false);
		expect(response.data.members.some((member) => member.user.id === owner.userId)).toBe(true);
	});

	test('session RPC rerolls discriminator 0000 for non-lifetime premium users', async () => {
		const account = await createTestAccount(harness);
		if (!account.username) {
			throw new Error('Expected test account username');
		}

		await grantPremium(harness, account.userId, UserPremiumTypes.LIFETIME);
		const lifetimeUpdated = await updateUserProfile(harness, account.token, {
			username: account.username,
			discriminator: '0000',
			password: account.password,
		});
		expect(lifetimeUpdated.json.discriminator).toBe('0000');

		await grantPremium(harness, account.userId, UserPremiumTypes.SUBSCRIPTION);

		const response = await createBuilder<SessionRpcResponse>(harness, `Bearer ${Config.gateway.rpcSecret}`)
			.post('/_rpc')
			.body({
				type: 'session',
				token: account.token,
				version: 1,
				ip: '127.0.0.1',
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(response.type).toBe('session');
		expect(response.data.user.id).toBe(account.userId);
		expect(response.data.user.discriminator).not.toBe('0000');
	});

	test('session RPC sanitizes owned bot discriminators and marks BOT_SANITIZED', async () => {
		const owner = await createTestAccount(harness);
		const bot = await createOAuth2BotApplication(harness, owner.token, `RPC owned bot sanitization ${Date.now()}`);

		const ownerBefore = await createBuilder<{flags?: string}>(harness, '')
			.get(`/test/users/${owner.userId}/data-exists`)
			.expect(HTTP_STATUS.OK)
			.execute();
		const beforeFlags = BigInt(ownerBefore.flags ?? '0');
		expect((beforeFlags & UserFlags.BOT_SANITIZED) === UserFlags.BOT_SANITIZED).toBe(false);

		await createBuilder(harness, '')
			.patch(`/test/users/${bot.botUserId}/discriminator`)
			.body({discriminator: 0})
			.expect(HTTP_STATUS.OK)
			.execute();
		await createBuilder(harness, '').post('/test/cache-clear').expect(HTTP_STATUS.OK).execute();

		const botBefore = await createBuilder<{discriminator: string}>(harness, `Bot ${bot.botToken}`)
			.get('/users/@me')
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(botBefore.discriminator).toBe('0000');

		await createBuilder<SessionRpcResponse>(harness, `Bearer ${Config.gateway.rpcSecret}`)
			.post('/_rpc')
			.body({
				type: 'session',
				token: owner.token,
				version: 1,
				ip: '127.0.0.1',
			})
			.expect(HTTP_STATUS.OK)
			.execute();

		const botAfter = await createBuilder<{discriminator: string}>(harness, `Bot ${bot.botToken}`)
			.get('/users/@me')
			.expect(HTTP_STATUS.OK)
			.execute();
		expect(botAfter.discriminator).not.toBe('0000');

		const ownerAfter = await createBuilder<{flags?: string}>(harness, '')
			.get(`/test/users/${owner.userId}/data-exists`)
			.expect(HTTP_STATUS.OK)
			.execute();
		const afterFlags = BigInt(ownerAfter.flags ?? '0');
		expect((afterFlags & UserFlags.BOT_SANITIZED) === UserFlags.BOT_SANITIZED).toBe(true);
	});
});
