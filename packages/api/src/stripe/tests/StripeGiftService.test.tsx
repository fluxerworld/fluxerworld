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
import {Config} from '@fluxer/api/src/Config';
import {createGuild} from '@fluxer/api/src/guild/tests/GuildTestUtils';
import {createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

describe('StripeGiftService', () => {
	let harness: Awaited<ReturnType<typeof createApiTestHarness>>;
	let originalVisionariesGuildId: string | undefined;

	beforeAll(async () => {
		harness = await createApiTestHarness();
		originalVisionariesGuildId = Config.instance.visionariesGuildId ?? undefined;
	});

	afterAll(async () => {
		await harness.shutdown();
		Config.instance.visionariesGuildId = originalVisionariesGuildId;
	});

	beforeEach(async () => {
		await harness.resetData();
		const owner = await createTestAccount(harness);
		const visionariesGuild = await createGuild(harness, owner.token, 'Visionaries Gift Test Guild');
		Config.instance.visionariesGuildId = visionariesGuild.id;
	});

	describe('GET /gifts/:code', () => {
		test('returns error for unknown gift code', async () => {
			await createBuilder(harness, '')
				.get('/gifts/invalid_code')
				.expect(404, APIErrorCodes.UNKNOWN_GIFT_CODE)
				.execute();
		});
	});

	describe('POST /gifts/:code/redeem', () => {
		test('requires authentication', async () => {
			await createBuilder(harness, 'invalid-token').post('/gifts/test_code/redeem').expect(401).execute();
		});

		test('returns error for unknown gift code', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post('/gifts/invalid_code/redeem')
				.expect(404, APIErrorCodes.UNKNOWN_GIFT_CODE)
				.execute();
		});
	});

	describe('GET /users/@me/gifts', () => {
		test('returns empty array when user has no gifts', async () => {
			const account = await createTestAccount(harness);

			const gifts = await createBuilder<Array<unknown>>(harness, account.token).get('/users/@me/gifts').execute();

			expect(gifts).toEqual([]);
		});

		test('requires authentication', async () => {
			await createBuilder(harness, 'invalid-token').get('/users/@me/gifts').expect(401).execute();
		});
	});
});
