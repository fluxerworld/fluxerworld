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
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('DM creation allowed with mutual guild', () => {
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

	it('allows users sharing a guild to create DMs without being friends', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		const guild = await createGuild(harness, user1.token, 'Test Community');
		const systemChannel = await getChannel(harness, user1.token, guild.system_channel_id!);
		const invite = await createChannelInvite(harness, user1.token, systemChannel.id);
		await acceptInvite(harness, user2.token, invite.code);

		const dm = await createDmChannel(harness, user1.token, user2.userId);
		expect(dm.id).toBeTruthy();
		expect(dm.id.length).toBeGreaterThan(0);
	});
});
