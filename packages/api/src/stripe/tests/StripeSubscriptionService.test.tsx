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
import {createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createPwnedPasswordsRangeHandler} from '@fluxer/api/src/test/msw/handlers/PwnedPasswordsHandlers';
import {createStripeApiHandlers} from '@fluxer/api/src/test/msw/handlers/StripeApiHandlers';
import {server} from '@fluxer/api/src/test/msw/server';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

describe('StripeSubscriptionService', () => {
	let harness: Awaited<ReturnType<typeof createApiTestHarness>>;
	let stripeHandlers: ReturnType<typeof createStripeApiHandlers>;

	beforeAll(async () => {
		harness = await createApiTestHarness();
		stripeHandlers = createStripeApiHandlers();
		server.use(...stripeHandlers.handlers);
	});

	afterAll(async () => {
		await harness.shutdown();
	});

	beforeEach(async () => {
		await harness.resetData();
		stripeHandlers.resetAll();
		server.use(...stripeHandlers.handlers, createPwnedPasswordsRangeHandler());
	});

	describe('POST /premium/cancel-subscription', () => {
		test('cancels subscription at period end', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					stripe_subscription_id: 'sub_test_1',
					premium_type: 1,
					premium_will_cancel: false,
				})
				.execute();

			await createBuilder(harness, account.token).post('/premium/cancel-subscription').expect(204).execute();

			expect(stripeHandlers.spies.updatedSubscriptions).toHaveLength(1);
			const update = stripeHandlers.spies.updatedSubscriptions[0];
			expect(update?.id).toBe('sub_test_1');
			expect(update?.params.cancel_at_period_end).toBe('true');

			const me = await createBuilder<{premium_will_cancel: boolean}>(harness, account.token)
				.get('/users/@me')
				.execute();
			expect(me.premium_will_cancel).toBe(true);
		});

		test('rejects when no active subscription', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post('/premium/cancel-subscription')
				.expect(400, APIErrorCodes.STRIPE_NO_ACTIVE_SUBSCRIPTION)
				.execute();

			expect(stripeHandlers.spies.updatedSubscriptions).toHaveLength(0);
		});

		test('rejects when subscription already canceling', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					stripe_subscription_id: 'sub_test_1',
					premium_type: 1,
					premium_will_cancel: true,
				})
				.execute();

			await createBuilder(harness, account.token)
				.post('/premium/cancel-subscription')
				.expect(400, APIErrorCodes.STRIPE_SUBSCRIPTION_ALREADY_CANCELING)
				.execute();

			expect(stripeHandlers.spies.updatedSubscriptions).toHaveLength(0);
		});

		test('rejects when user does not exist', async () => {
			await createBuilder(harness, 'invalid-token').post('/premium/cancel-subscription').expect(401).execute();
		});

		test('handles stripe api errors gracefully', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					stripe_subscription_id: 'sub_test_1',
					premium_type: 1,
					premium_will_cancel: false,
				})
				.execute();

			stripeHandlers.reset();
			server.use(...createStripeApiHandlers({subscriptionShouldFail: true}).handlers);

			await createBuilder(harness, account.token)
				.post('/premium/cancel-subscription')
				.expect(400, APIErrorCodes.STRIPE_ERROR)
				.execute();
		});
	});

	describe('POST /premium/reactivate-subscription', () => {
		test('reactivates subscription', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					stripe_subscription_id: 'sub_test_1',
					premium_type: 1,
					premium_will_cancel: true,
				})
				.execute();

			await createBuilder(harness, account.token).post('/premium/reactivate-subscription').expect(204).execute();

			expect(stripeHandlers.spies.updatedSubscriptions).toHaveLength(1);
			const update = stripeHandlers.spies.updatedSubscriptions[0];
			expect(update?.id).toBe('sub_test_1');
			expect(update?.params.cancel_at_period_end).toBe('false');

			const me = await createBuilder<{premium_will_cancel: boolean}>(harness, account.token)
				.get('/users/@me')
				.execute();
			expect(me.premium_will_cancel).toBe(false);
		});

		test('rejects when no subscription id', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post('/premium/reactivate-subscription')
				.expect(400, APIErrorCodes.STRIPE_NO_SUBSCRIPTION)
				.execute();

			expect(stripeHandlers.spies.updatedSubscriptions).toHaveLength(0);
		});

		test('rejects when subscription not canceling', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					stripe_subscription_id: 'sub_test_1',
					premium_type: 1,
					premium_will_cancel: false,
				})
				.execute();

			await createBuilder(harness, account.token)
				.post('/premium/reactivate-subscription')
				.expect(400, APIErrorCodes.STRIPE_SUBSCRIPTION_NOT_CANCELING)
				.execute();

			expect(stripeHandlers.spies.updatedSubscriptions).toHaveLength(0);
		});

		test('rejects when user does not exist', async () => {
			await createBuilder(harness, 'invalid-token').post('/premium/reactivate-subscription').expect(401).execute();
		});

		test('handles stripe api errors gracefully', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					stripe_subscription_id: 'sub_test_1',
					premium_type: 1,
					premium_will_cancel: true,
				})
				.execute();

			stripeHandlers.reset();
			server.use(...createStripeApiHandlers({subscriptionShouldFail: true}).handlers);

			await createBuilder(harness, account.token)
				.post('/premium/reactivate-subscription')
				.expect(400, APIErrorCodes.STRIPE_ERROR)
				.execute();
		});
	});

	describe('extendSubscriptionWithGiftTrial', () => {
		test('updates subscription trial_end to extend by gift duration', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					stripe_subscription_id: 'sub_test_1',
					premium_type: 1,
				})
				.execute();

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/extend-subscription-trial`)
				.body({
					duration_months: 3,
					idempotency_key: 'gift_code_123',
				})
				.expect(204)
				.execute();

			expect(stripeHandlers.spies.retrievedSubscriptions).toContain('sub_test_1');
			expect(stripeHandlers.spies.updatedSubscriptions).toHaveLength(1);
			const update = stripeHandlers.spies.updatedSubscriptions[0];
			expect(update?.id).toBe('sub_test_1');
			expect(update?.params.trial_end).toBeDefined();
			expect(update?.params.proration_behavior).toBe('none');
		});

		test('stacks multiple gifts by reading current trial_end', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					stripe_subscription_id: 'sub_test_1',
					premium_type: 1,
				})
				.execute();

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/extend-subscription-trial`)
				.body({
					duration_months: 3,
					idempotency_key: 'gift_1',
				})
				.expect(204)
				.execute();

			stripeHandlers.reset();

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/extend-subscription-trial`)
				.body({
					duration_months: 6,
					idempotency_key: 'gift_2',
				})
				.expect(204)
				.execute();

			expect(stripeHandlers.spies.updatedSubscriptions).toHaveLength(1);
			const update = stripeHandlers.spies.updatedSubscriptions[0];
			expect(update?.params.trial_end).toBeDefined();
		});

		test('enforces idempotency with cache (gift already applied)', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					stripe_subscription_id: 'sub_test_1',
					premium_type: 1,
				})
				.execute();

			const idempotencyKey = 'gift_code_unique_123';

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/extend-subscription-trial`)
				.body({
					duration_months: 3,
					idempotency_key: idempotencyKey,
				})
				.expect(204)
				.execute();

			stripeHandlers.reset();

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/extend-subscription-trial`)
				.body({
					duration_months: 3,
					idempotency_key: idempotencyKey,
				})
				.expect(204)
				.execute();

			expect(stripeHandlers.spies.retrievedSubscriptions).toHaveLength(0);
			expect(stripeHandlers.spies.updatedSubscriptions).toHaveLength(0);
		});

		test('rejects when user has no active subscription', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/extend-subscription-trial`)
				.body({
					duration_months: 3,
					idempotency_key: 'gift_no_sub',
				})
				.expect(400, APIErrorCodes.NO_ACTIVE_SUBSCRIPTION)
				.execute();

			expect(stripeHandlers.spies.retrievedSubscriptions).toHaveLength(0);
		});

		test('handles stripe api errors gracefully', async () => {
			const account = await createTestAccount(harness);
			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					stripe_subscription_id: 'sub_test_1',
					premium_type: 1,
				})
				.execute();

			stripeHandlers.reset();
			server.use(...createStripeApiHandlers({subscriptionShouldFail: true}).handlers);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/extend-subscription-trial`)
				.body({
					duration_months: 3,
					idempotency_key: 'gift_fail',
				})
				.expect(400, APIErrorCodes.STRIPE_ERROR)
				.execute();
		});
	});
});
