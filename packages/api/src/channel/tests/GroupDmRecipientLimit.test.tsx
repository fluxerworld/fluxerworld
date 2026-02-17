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
import {createFriendship, seedPrivateChannels} from '@fluxer/api/src/channel/tests/ChannelTestUtils';
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {HTTP_STATUS} from '@fluxer/api/src/test/TestConstants';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {afterAll, beforeAll, beforeEach, describe, expect, it} from 'vitest';

const MAX_GROUP_DM_LIMIT = 150;
const MAX_GROUP_DM_ERROR_CODE = 'MAX_GROUP_DMS';

describe('Group DM Recipient Limit', () => {
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

	it('rejects creating group DM when user has reached limit', async () => {
		const creator = await createTestAccount(harness);
		const target = await createTestAccount(harness);
		const recipient = await createTestAccount(harness);
		const helper = await createTestAccount(harness);

		await createFriendship(harness, creator, target);
		await createFriendship(harness, creator, recipient);

		const seedResult = await seedPrivateChannels(harness, target.token, target.userId, {
			group_dm_count: MAX_GROUP_DM_LIMIT,
			recipients: [helper.userId, recipient.userId],
			clear_existing: true,
		});

		expect(seedResult.group_dms).toHaveLength(MAX_GROUP_DM_LIMIT);

		await createBuilder(harness, creator.token)
			.post('/users/@me/channels')
			.body({
				recipients: [helper.userId, target.userId],
			})
			.expect(HTTP_STATUS.BAD_REQUEST, MAX_GROUP_DM_ERROR_CODE)
			.execute();
	});
});
