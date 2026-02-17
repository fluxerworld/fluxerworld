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
	createChannelInvite,
	createDmChannel,
	createGuild,
	getChannel,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Voice Call Update', () => {
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

	async function setupUsersWithMutualGuild() {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);

		const guild = await createGuild(harness, user1.token, 'Mutual Guild');
		const invite = await createChannelInvite(harness, user1.token, guild.system_channel_id!);
		await acceptInvite(harness, user2.token, invite.code);

		return {user1, user2, guild};
	}

	describe('Update call region', () => {
		it('returns 404 when updating region for non-existent call', async () => {
			const {user1, user2} = await setupUsersWithMutualGuild();

			const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

			await createBuilder(harness, user1.token)
				.patch(`/channels/${dmChannel.id}/call`)
				.body({region: 'us-west'})
				.expect(HTTP_STATUS.NOT_FOUND, 'NO_ACTIVE_CALL')
				.execute();
		});

		it('returns 404 when updating call without body', async () => {
			const {user1, user2} = await setupUsersWithMutualGuild();

			const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

			await createBuilder(harness, user1.token)
				.patch(`/channels/${dmChannel.id}/call`)
				.body({})
				.expect(HTTP_STATUS.NOT_FOUND, 'NO_ACTIVE_CALL')
				.execute();
		});

		it('returns 404 for non-existent channel update', async () => {
			const user = await createTestAccount(harness);

			await createBuilder(harness, user.token)
				.patch('/channels/999999999999999999/call')
				.body({region: 'us-west'})
				.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_CHANNEL')
				.execute();
		});

		it('returns error for text channel update', async () => {
			const user = await createTestAccount(harness);
			await ensureSessionStarted(harness, user.token);

			const guild = await createGuild(harness, user.token, 'Test Guild');
			const textChannel = await getChannel(harness, user.token, guild.system_channel_id!);

			await createBuilder(harness, user.token)
				.patch(`/channels/${textChannel.id}/call`)
				.body({region: 'us-west'})
				.expect(HTTP_STATUS.BAD_REQUEST, 'INVALID_CHANNEL_TYPE_FOR_CALL')
				.execute();
		});
	});

	describe('End call', () => {
		it('ends call for DM channel', async () => {
			const {user1, user2} = await setupUsersWithMutualGuild();

			const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

			await createBuilder(harness, user1.token)
				.post(`/channels/${dmChannel.id}/call/end`)
				.body(null)
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();
		});

		it('ends call for channel without active call', async () => {
			const {user1, user2} = await setupUsersWithMutualGuild();

			const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

			await createBuilder(harness, user1.token)
				.post(`/channels/${dmChannel.id}/call/end`)
				.body(null)
				.expect(HTTP_STATUS.NO_CONTENT)
				.execute();
		});
	});
});
