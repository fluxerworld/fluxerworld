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

import {createTestAccount, unclaimAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {
	acceptInvite,
	createChannelInvite,
	createDmChannel,
	createFriendship,
	createGuild,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {updateUserSettings} from '@fluxer/api/src/user/tests/UserTestUtils';
import {IncomingCallFlags} from '@fluxer/constants/src/UserConstants';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Voice Unclaimed Account Restrictions', () => {
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

	describe('DM call restrictions', () => {
		it('unclaimed account cannot initiate DM call', async () => {
			const user1 = await createTestAccount(harness);
			const user2 = await createTestAccount(harness);

			await ensureSessionStarted(harness, user1.token);
			await ensureSessionStarted(harness, user2.token);

			const guild = await createGuild(harness, user1.token, 'Mutual Guild');
			const invite = await createChannelInvite(harness, user1.token, guild.system_channel_id!);
			await acceptInvite(harness, user2.token, invite.code);

			const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

			await unclaimAccount(harness, user1.userId);

			const callData = await createBuilder<{ringable: boolean}>(harness, user1.token)
				.get(`/channels/${dmChannel.id}/call`)
				.execute();

			expect(callData.ringable).toBe(false);
		});

		it('claimed account can initiate DM call with unclaimed recipient', async () => {
			const user1 = await createTestAccount(harness);
			const user2 = await createTestAccount(harness);

			await ensureSessionStarted(harness, user1.token);
			await ensureSessionStarted(harness, user2.token);

			const guild = await createGuild(harness, user1.token, 'Mutual Guild');
			const invite = await createChannelInvite(harness, user1.token, guild.system_channel_id!);
			await acceptInvite(harness, user2.token, invite.code);

			await updateUserSettings(harness, user2.token, {
				incoming_call_flags: IncomingCallFlags.GUILD_MEMBERS,
			});

			const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

			await unclaimAccount(harness, user2.userId);

			const callData = await createBuilder<{ringable: boolean}>(harness, user1.token)
				.get(`/channels/${dmChannel.id}/call`)
				.execute();

			expect(callData.ringable).toBe(true);
		});

		it('unclaimed account cannot call friend', async () => {
			const user1 = await createTestAccount(harness);
			const user2 = await createTestAccount(harness);

			await ensureSessionStarted(harness, user1.token);
			await ensureSessionStarted(harness, user2.token);

			await createFriendship(harness, user1, user2);

			const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

			await unclaimAccount(harness, user1.userId);

			const callData = await createBuilder<{ringable: boolean}>(harness, user1.token)
				.get(`/channels/${dmChannel.id}/call`)
				.execute();

			expect(callData.ringable).toBe(false);
		});
	});
});
