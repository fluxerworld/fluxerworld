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
	fetchHarvestDownload,
	markHarvestCompleted,
	requestHarvest,
} from '@fluxer/api/src/user/tests/HarvestTestUtils';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

describe('Harvest Download Expiration Boundary', () => {
	let harness: ApiTestHarness;

	beforeEach(async () => {
		harness = await createApiTestHarness();
		vi.useFakeTimers();
	});

	afterEach(async () => {
		vi.useRealTimers();
		await harness?.shutdown();
	});

	test('download succeeds before expiration and fails after', async () => {
		vi.useRealTimers();

		const account = await createTestAccount(harness);

		const {harvest_id} = await requestHarvest(harness, account.token);

		const baseTime = Date.now();
		const expirationTime = new Date(baseTime + 5000);
		await markHarvestCompleted(account.userId, harvest_id, expirationTime);

		const download = await fetchHarvestDownload(harness, account.token, harvest_id);
		expect(download.download_url).not.toBe('');
		expect(download.expires_at).not.toBe('');

		vi.useFakeTimers({now: baseTime + 7000});

		await expectHarvestDownloadFailsWithError(harness, account.token, harvest_id, 'HARVEST_EXPIRED');
	});
});
