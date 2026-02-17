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
import {createFriendship, createGroupDmChannel} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Group DM Security Boundaries', () => {
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

	it('non-member cannot read messages from group DM', async () => {
		const creator = await createTestAccount(harness);
		const recipient = await createTestAccount(harness);
		const attacker = await createTestAccount(harness);

		await createFriendship(harness, creator, recipient);

		const groupDm = await createGroupDmChannel(harness, creator.token, [recipient.userId]);

		await createBuilder(harness, attacker.token)
			.get(`/channels/${groupDm.id}/messages`)
			.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_CHANNEL')
			.execute();
	});

	it('non-member cannot send messages to group DM', async () => {
		const creator = await createTestAccount(harness);
		const recipient = await createTestAccount(harness);
		const attacker = await createTestAccount(harness);

		await createFriendship(harness, creator, recipient);

		const groupDm = await createGroupDmChannel(harness, creator.token, [recipient.userId]);

		await createBuilder(harness, attacker.token)
			.post(`/channels/${groupDm.id}/messages`)
			.body({content: 'Unauthorized message'})
			.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_CHANNEL')
			.execute();
	});

	it('non-member cannot add themselves to group DM', async () => {
		const creator = await createTestAccount(harness);
		const recipient = await createTestAccount(harness);
		const attacker = await createTestAccount(harness);

		await createFriendship(harness, creator, recipient);

		const groupDm = await createGroupDmChannel(harness, creator.token, [recipient.userId]);

		await createBuilder(harness, attacker.token)
			.put(`/channels/${groupDm.id}/recipients/${attacker.userId}`)
			.body(null)
			.expect(HTTP_STATUS.FORBIDDEN, 'MISSING_ACCESS')
			.execute();
	});

	it('recipient can leave group DM', async () => {
		const creator = await createTestAccount(harness);
		const recipient = await createTestAccount(harness);

		await createFriendship(harness, creator, recipient);

		const groupDm = await createGroupDmChannel(harness, creator.token, [recipient.userId]);

		await createBuilder(harness, recipient.token)
			.delete(`/channels/${groupDm.id}/recipients/${recipient.userId}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();
	});

	it('after leaving, former member cannot read messages', async () => {
		const creator = await createTestAccount(harness);
		const recipient = await createTestAccount(harness);

		await createFriendship(harness, creator, recipient);

		const groupDm = await createGroupDmChannel(harness, creator.token, [recipient.userId]);

		await createBuilder(harness, recipient.token)
			.delete(`/channels/${groupDm.id}/recipients/${recipient.userId}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();

		await createBuilder(harness, recipient.token)
			.get(`/channels/${groupDm.id}/messages`)
			.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_CHANNEL')
			.execute();
	});

	it('after leaving, former member cannot send messages', async () => {
		const creator = await createTestAccount(harness);
		const recipient = await createTestAccount(harness);

		await createFriendship(harness, creator, recipient);

		const groupDm = await createGroupDmChannel(harness, creator.token, [recipient.userId]);

		await createBuilder(harness, recipient.token)
			.delete(`/channels/${groupDm.id}/recipients/${recipient.userId}`)
			.expect(HTTP_STATUS.NO_CONTENT)
			.execute();

		await createBuilder(harness, recipient.token)
			.post(`/channels/${groupDm.id}/messages`)
			.body({content: 'Message after leaving'})
			.expect(HTTP_STATUS.NOT_FOUND, 'UNKNOWN_CHANNEL')
			.execute();
	});
});
