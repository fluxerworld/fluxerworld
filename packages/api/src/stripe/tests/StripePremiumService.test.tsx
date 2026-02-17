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
import {UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

describe('StripePremiumService', () => {
	let harness: Awaited<ReturnType<typeof createApiTestHarness>>;
	let originalVisionariesGuildId: string | undefined;
	let originalOperatorsGuildId: string | undefined;

	beforeAll(async () => {
		harness = await createApiTestHarness();
		originalVisionariesGuildId = Config.instance.visionariesGuildId ?? undefined;
		originalOperatorsGuildId = Config.instance.operatorsGuildId ?? undefined;
	});

	afterAll(async () => {
		await harness.shutdown();
		Config.instance.visionariesGuildId = originalVisionariesGuildId;
		Config.instance.operatorsGuildId = originalOperatorsGuildId;
	});

	beforeEach(async () => {
		await harness.resetData();
		const owner = await createTestAccount(harness);
		const visionariesGuild = await createGuild(harness, owner.token, 'Visionaries Test Guild');
		const operatorsGuild = await createGuild(harness, owner.token, 'Operators Test Guild');
		Config.instance.visionariesGuildId = visionariesGuild.id;
		Config.instance.operatorsGuildId = operatorsGuild.id;
	});

	describe('POST /premium/visionary/rejoin', () => {
		test('allows visionary users to rejoin guild', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.LIFETIME,
					premium_lifetime_sequence: 0,
				})
				.execute();

			await createBuilder(harness, account.token).post('/premium/visionary/rejoin').expect(204).execute();
		});

		test('rejects users without visionary access', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
				})
				.execute();

			await createBuilder(harness, account.token)
				.post('/premium/visionary/rejoin')
				.expect(403, APIErrorCodes.MISSING_ACCESS)
				.execute();
		});

		test('requires authentication', async () => {
			await createBuilder(harness, 'invalid-token').post('/premium/visionary/rejoin').expect(401).execute();
		});
	});

	describe('POST /premium/operator/rejoin', () => {
		test('allows visionary users to rejoin operator guild', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.LIFETIME,
					premium_lifetime_sequence: 1,
				})
				.execute();

			await createBuilder(harness, account.token).post('/premium/operator/rejoin').expect(204).execute();
		});

		test('rejects users without visionary access', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
				})
				.execute();

			await createBuilder(harness, account.token)
				.post('/premium/operator/rejoin')
				.expect(403, APIErrorCodes.MISSING_ACCESS)
				.execute();
		});

		test('requires authentication', async () => {
			await createBuilder(harness, 'invalid-token').post('/premium/operator/rejoin').expect(401).execute();
		});
	});

	describe('premium duration and stacking', () => {
		test('sets premium_since on first grant', async () => {
			const account = await createTestAccount(harness);
			const before = new Date();

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
				})
				.execute();

			const me = await createBuilder<{premium_since: string | null; premium_type: number}>(harness, account.token)
				.get('/users/@me')
				.execute();

			expect(me.premium_type).toBe(UserPremiumTypes.SUBSCRIPTION);
			expect(me.premium_since).toBeDefined();
			const premiumSince = new Date(me.premium_since!);
			expect(premiumSince.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
			expect(premiumSince.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
		});

		test('preserves premium_since on renewal', async () => {
			const account = await createTestAccount(harness);
			const originalSince = new Date('2024-01-01T00:00:00Z');

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_since: originalSince.toISOString(),
					premium_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
				})
				.execute();

			const me1 = await createBuilder<{premium_since: string | null}>(harness, account.token)
				.get('/users/@me')
				.execute();

			expect(me1.premium_since).toBe(originalSince.toISOString());

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
				})
				.execute();

			const me2 = await createBuilder<{premium_since: string | null}>(harness, account.token)
				.get('/users/@me')
				.execute();

			expect(me2.premium_since).toBe(originalSince.toISOString());
		});

		test('supports lifetime premium type', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.LIFETIME,
					premium_lifetime_sequence: 5,
				})
				.execute();

			const me = await createBuilder<{premium_type: number; premium_lifetime_sequence: number | null}>(
				harness,
				account.token,
			)
				.get('/users/@me')
				.execute();

			expect(me.premium_type).toBe(UserPremiumTypes.LIFETIME);
			expect(me.premium_lifetime_sequence).toBe(5);
		});
	});
});
