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
	addRecipientToGroupDm,
	createFriendship,
	createGroupDmChannel,
	getChannel,
	removeRecipientFromGroupDm,
	updateChannel,
} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {ensureSessionStarted} from '@fluxer/api/src/message/tests/MessageTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

describe('Group DM management', () => {
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

	it('can create group DM with multiple recipients', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);
		const user3 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);
		await ensureSessionStarted(harness, user3.token);

		await createFriendship(harness, user1, user2);
		await createFriendship(harness, user1, user3);

		const groupDm = await createGroupDmChannel(harness, user1.token, [user2.userId, user3.userId]);

		expect(groupDm.id).toBeTruthy();
		expect(groupDm.type).toBe(3);
		expect(groupDm.owner_id).toBe(user1.userId);
		expect(groupDm.recipients.length).toBe(2);
	});

	it('can update group DM name', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);
		const user3 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);
		await ensureSessionStarted(harness, user3.token);

		await createFriendship(harness, user1, user2);
		await createFriendship(harness, user1, user3);

		const groupDm = await createGroupDmChannel(harness, user1.token, [user2.userId, user3.userId]);

		const updated = await updateChannel(harness, user1.token, groupDm.id, {name: 'Cool Group Chat'});

		expect(updated.name).toBe('Cool Group Chat');
	});

	it('can add recipient to existing group DM', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);
		const user3 = await createTestAccount(harness);
		const user4 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);
		await ensureSessionStarted(harness, user3.token);
		await ensureSessionStarted(harness, user4.token);

		await createFriendship(harness, user1, user2);
		await createFriendship(harness, user1, user3);
		await createFriendship(harness, user1, user4);

		const groupDm = await createGroupDmChannel(harness, user1.token, [user2.userId, user3.userId]);
		expect(groupDm.recipients.length).toBe(2);

		await addRecipientToGroupDm(harness, user1.token, groupDm.id, user4.userId);

		const updatedChannel = await getChannel(harness, user1.token, groupDm.id);
		expect(updatedChannel.type).toBe(3);
	});

	it('can remove recipient from group DM', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);
		const user3 = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);
		await ensureSessionStarted(harness, user3.token);

		await createFriendship(harness, user1, user2);
		await createFriendship(harness, user1, user3);

		const groupDm = await createGroupDmChannel(harness, user1.token, [user2.userId, user3.userId]);

		await removeRecipientFromGroupDm(harness, user1.token, groupDm.id, user3.userId);

		const updatedChannel = await getChannel(harness, user1.token, groupDm.id);
		expect(updatedChannel.type).toBe(3);
	});

	it('rejects non-member adding recipient to group DM', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);
		const user3 = await createTestAccount(harness);
		const outsider = await createTestAccount(harness);

		await ensureSessionStarted(harness, user1.token);
		await ensureSessionStarted(harness, user2.token);
		await ensureSessionStarted(harness, user3.token);
		await ensureSessionStarted(harness, outsider.token);

		await createFriendship(harness, user1, user2);
		await createFriendship(harness, user1, user3);
		await createFriendship(harness, outsider, user3);

		const groupDm = await createGroupDmChannel(harness, user1.token, [user2.userId, user3.userId]);

		await createBuilder(harness, outsider.token)
			.put(`/channels/${groupDm.id}/recipients/${user3.userId}`)
			.body(null)
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});
});
