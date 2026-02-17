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
import {createDmChannel, createFriendship} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder, createBuilderWithoutAuth} from '@fluxer/api/src/test/TestRequestBuilder';
import {sendTypingIndicator} from '@fluxer/api/src/typing/tests/TypingTestUtils';
import {afterEach, beforeEach, describe, test} from 'vitest';

describe('Typing in DM channel', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	afterEach(async () => {
		await harness?.shutdown();
	});

	test('user can send typing indicator in DM channel', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await createFriendship(harness, user1, user2);

		const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

		await sendTypingIndicator(harness, user1.token, dmChannel.id);
	});

	test('both participants can send typing indicator in DM', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await createFriendship(harness, user1, user2);

		const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

		await sendTypingIndicator(harness, user1.token, dmChannel.id);
		await sendTypingIndicator(harness, user2.token, dmChannel.id);
	});

	test('rejects typing indicator from user not in DM channel', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);
		const user3 = await createTestAccount(harness);

		await createFriendship(harness, user1, user2);

		const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

		await createBuilder(harness, user3.token)
			.post(`/channels/${dmChannel.id}/typing`)
			.body({})
			.expect(HTTP_STATUS.NOT_FOUND)
			.execute();
	});

	test('rejects typing indicator without authorization', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await createFriendship(harness, user1, user2);

		const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

		await createBuilderWithoutAuth(harness)
			.post(`/channels/${dmChannel.id}/typing`)
			.body({})
			.expect(HTTP_STATUS.UNAUTHORIZED)
			.execute();
	});
});
