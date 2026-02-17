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
	createFriendship,
	createGroupDmChannel,
	type GroupDmChannelResponse,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Group DM name update', () => {
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

	it('updates group DM name correctly', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);
		const user3 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);
		await ensureSessionStarted(harness, user3.token);

		await createFriendship(harness, user1, user2);
		await createFriendship(harness, user1, user3);

		const groupDm = await createGroupDmChannel(harness, user1.token, [user2.userId, user3.userId]);

		const updated = await createBuilder<GroupDmChannelResponse>(harness, user1.token)
			.patch(`/channels/${groupDm.id}`)
			.body({name: 'Cool Group Chat'})
			.expect(HTTP_STATUS.OK)
			.execute();

		expect(updated.name).toBe('Cool Group Chat');
	});
});
