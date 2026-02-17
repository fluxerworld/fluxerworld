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
import {createFriendship} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {createDmChannel, createGuildWithMember, sendTypingIndicator} from '@fluxer/api/src/emoji/tests/EmojiTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, it} from 'vitest';

describe('Typing indicators permissions', () => {
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

	it('allows typing indicator in DM channel by participant', async () => {
		const user1 = await createTestAccount(harness);
		const user2 = await createTestAccount(harness);

		await createFriendship(harness, user1, user2);

		const dmChannel = await createDmChannel(harness, user1.token, user2.userId);

		await sendTypingIndicator(harness, user1.token, dmChannel.id);
	});

	it('rejects typing indicator from user not in DM channel', async () => {
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

	it('allows typing indicator in guild channel by guild member', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const {channel} = await createGuildWithMember(harness, owner, member);

		await sendTypingIndicator(harness, member.token, channel.id);
	});

	it('rejects typing indicator from non-member in guild channel', async () => {
		const owner = await createTestAccount(harness);
		const member = await createTestAccount(harness);
		const nonMember = await createTestAccount(harness);

		const {channel} = await createGuildWithMember(harness, owner, member);

		await createBuilder(harness, nonMember.token)
			.post(`/channels/${channel.id}/typing`)
			.body({})
			.expect(HTTP_STATUS.FORBIDDEN)
			.execute();
	});
});
