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
import {type ApiTestHarness, createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {
	expectHarvestDownloadFailsWithError,
	markHarvestCompleted,
	requestHarvest,
} from '@fluxer/api/src/user/tests/HarvestTestUtils';
import {beforeEach, describe, test} from 'vitest';

describe('Harvest Download Expired', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
	});

	test('download fails when harvest has expired', async () => {
		const account = await createTestAccount(harness);

		const {harvest_id} = await requestHarvest(harness, account.token);

		const expiredTime = new Date(Date.now() - 60 * 60 * 1000);
		await markHarvestCompleted(account.userId, harvest_id, expiredTime);

		await expectHarvestDownloadFailsWithError(harness, account.token, harvest_id, 'HARVEST_EXPIRED');
	});
});
