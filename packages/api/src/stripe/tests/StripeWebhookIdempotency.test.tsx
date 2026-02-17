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

import {createHmac} from 'node:crypto';
import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {createUserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import {ProductType} from '@fluxer/api/src/stripe/ProductRegistry';
import {createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {
	createCheckoutCompletedEvent,
	createMockWebhookPayload,
	createStripeApiHandlers,
	createSubscriptionUpdatedEvent,
	type StripeWebhookEventData,
} from '@fluxer/api/src/test/msw/handlers/StripeApiHandlers';
import {server} from '@fluxer/api/src/test/msw/server';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {PaymentRepository} from '@fluxer/api/src/user/repositories/PaymentRepository';
import {UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, test} from 'vitest';

const MOCK_PRICES = {
	monthlyUsd: 'price_monthly_usd',
};

describe('Stripe Webhook Idempotency and Race Conditions', () => {
	let harness: Awaited<ReturnType<typeof createApiTestHarness>>;
	let stripeHandlers: ReturnType<typeof createStripeApiHandlers>;
	let originalWebhookSecret: string | undefined;
	let originalPrices: typeof Config.stripe.prices | undefined;

	function createWebhookSignature(payload: string, timestamp: number, secret: string): string {
		const signedPayload = `${timestamp}.${payload}`;
		const signature = createHmac('sha256', secret).update(signedPayload).digest('hex');
		return `t=${timestamp},v1=${signature}`;
	}

	async function sendWebhook(eventData: StripeWebhookEventData): Promise<{received: boolean}> {
		const {payload, timestamp} = createMockWebhookPayload(eventData);
		const signature = createWebhookSignature(payload, timestamp, Config.stripe.webhookSecret!);

		return createBuilder<{received: boolean}>(harness, '')
			.post('/stripe/webhook')
			.header('stripe-signature', signature)
			.header('content-type', 'application/json')
			.body(payload)
			.execute();
	}

	beforeAll(async () => {
		harness = await createApiTestHarness();
		originalWebhookSecret = Config.stripe.webhookSecret;
		originalPrices = Config.stripe.prices;
		Config.stripe.webhookSecret = 'whsec_test_secret';
		Config.stripe.prices = MOCK_PRICES;

		stripeHandlers = createStripeApiHandlers();
		server.use(...stripeHandlers.handlers);
	});

	beforeEach(async () => {
		await harness.resetData();
		stripeHandlers.reset();
	});

	afterEach(() => {
		server.resetHandlers();
		server.use(...stripeHandlers.handlers);
	});

	afterAll(async () => {
		await harness.shutdown();
		Config.stripe.webhookSecret = originalWebhookSecret;
		Config.stripe.prices = originalPrices;
	});

	async function createSubscriptionPayment(params: {
		checkoutSessionId: string;
		userId: string;
		subscriptionId: string;
		customerId: string;
		status: 'pending' | 'completed';
	}): Promise<void> {
		const paymentRepository = new PaymentRepository();

		await paymentRepository.createPayment({
			checkout_session_id: params.checkoutSessionId,
			user_id: createUserID(BigInt(params.userId)),
			price_id: MOCK_PRICES.monthlyUsd,
			product_type: ProductType.MONTHLY_SUBSCRIPTION,
			status: params.status,
			is_gift: false,
			created_at: new Date(),
		});

		if (params.status === 'completed') {
			await paymentRepository.updatePayment({
				checkout_session_id: params.checkoutSessionId,
				subscription_id: params.subscriptionId,
				stripe_customer_id: params.customerId,
				status: 'completed',
			});
		}
	}

	describe('idempotency', () => {
		test('handles duplicate webhook events idempotently', async () => {
			const account = await createTestAccount(harness);

			const subscriptionId = `sub_test_${Date.now()}`;
			const customerId = `cus_test_${Date.now()}`;
			const checkoutSessionId = `cs_test_${Date.now()}`;

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
					stripe_subscription_id: subscriptionId,
				})
				.execute();

			await createSubscriptionPayment({
				checkoutSessionId,
				userId: account.userId,
				subscriptionId,
				customerId,
				status: 'completed',
			});

			const eventData1 = {
				...createSubscriptionUpdatedEvent({
					subscriptionId,
					customerId,
					status: 'active',
				}),
				id: 'evt_same_123',
			};

			const response1 = await sendWebhook(eventData1);
			expect(response1.received).toBe(true);

			const userAfterFirst = await createBuilder<{premium_type: number; premium_until: string | null}>(
				harness,
				account.token,
			)
				.get('/users/@me')
				.execute();

			expect(userAfterFirst.premium_type).toBe(UserPremiumTypes.SUBSCRIPTION);

			const response2 = await sendWebhook(eventData1);
			expect(response2.received).toBe(true);

			const userAfterSecond = await createBuilder<{premium_type: number; premium_until: string | null}>(
				harness,
				account.token,
			)
				.get('/users/@me')
				.execute();

			expect(userAfterSecond.premium_type).toBe(userAfterFirst.premium_type);
			expect(userAfterSecond.premium_until).toBe(userAfterFirst.premium_until);
		});

		test('prevents concurrent webhooks from processing same subscription update', async () => {
			const account = await createTestAccount(harness);

			const subscriptionId = `sub_test_${Date.now()}`;
			const customerId = `cus_test_${Date.now()}`;
			const checkoutSessionId = `cs_test_${Date.now()}`;

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
					stripe_subscription_id: subscriptionId,
				})
				.execute();

			await createSubscriptionPayment({
				checkoutSessionId,
				userId: account.userId,
				subscriptionId,
				customerId,
				status: 'completed',
			});

			const eventData = {
				...createSubscriptionUpdatedEvent({
					subscriptionId,
					customerId,
					status: 'active',
				}),
				id: 'evt_concurrent_123',
			};

			const [response1, response2] = await Promise.all([sendWebhook(eventData), sendWebhook(eventData)]);

			expect(response1.received).toBe(true);
			expect(response2.received).toBe(true);

			const userAfter = await createBuilder<{premium_type: number}>(harness, account.token).get('/users/@me').execute();

			expect(userAfter.premium_type).toBe(UserPremiumTypes.SUBSCRIPTION);
		});
	});

	describe('race condition fixes', () => {
		test('preserves higher premiumUntil in concurrent subscription updates', async () => {
			const account = await createTestAccount(harness);

			const subscriptionId = `sub_test_${Date.now()}`;
			const checkoutSessionId = `cs_test_${Date.now()}`;
			const customerId = `cus_test_${Date.now()}`;

			const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
			const nearerTimestamp = Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_until: futureDate.toISOString(),
					stripe_subscription_id: subscriptionId,
				})
				.execute();

			await createSubscriptionPayment({
				checkoutSessionId,
				userId: account.userId,
				subscriptionId,
				customerId,
				status: 'pending',
			});

			const checkoutEvent = {
				...createCheckoutCompletedEvent({
					sessionId: checkoutSessionId,
					subscriptionId,
					customerId,
					metadata: {},
				}),
				id: 'evt_checkout_123',
			};

			await sendWebhook(checkoutEvent);

			const eventData = createSubscriptionUpdatedEvent({
				subscriptionId,
				customerId,
			});
			eventData.data.object.items = {
				data: [{current_period_end: nearerTimestamp}],
			};

			const subscriptionEvent = {
				...eventData,
				id: 'evt_preserve_123',
			};

			const response = await sendWebhook(subscriptionEvent);
			expect(response.received).toBe(true);

			const userAfter = await createBuilder<{premium_until: string | null}>(harness, account.token)
				.get('/users/@me')
				.execute();

			if (userAfter.premium_until) {
				const premiumUntilAfter = new Date(userAfter.premium_until);
				expect(premiumUntilAfter.getTime()).toBeGreaterThanOrEqual(futureDate.getTime() - 1000);
			}
		});

		test('handles concurrent subscription update webhooks', async () => {
			const account = await createTestAccount(harness);

			const subscriptionId = `sub_test_${Date.now()}`;
			const checkoutSessionId = `cs_test_${Date.now()}`;
			const customerId = `cus_test_${Date.now()}`;

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
					stripe_subscription_id: subscriptionId,
				})
				.execute();

			await createSubscriptionPayment({
				checkoutSessionId,
				userId: account.userId,
				subscriptionId,
				customerId,
				status: 'pending',
			});

			const checkoutEvent = {
				...createCheckoutCompletedEvent({
					sessionId: checkoutSessionId,
					subscriptionId,
					customerId,
					metadata: {},
				}),
				id: 'evt_checkout_concurrent',
			};

			await sendWebhook(checkoutEvent);

			const eventData1 = {
				...createSubscriptionUpdatedEvent({
					subscriptionId,
					customerId,
					status: 'active',
				}),
				id: 'evt_race_1',
			};
			const eventData2 = {
				...createSubscriptionUpdatedEvent({
					subscriptionId,
					customerId,
					status: 'active',
				}),
				id: 'evt_race_2',
			};

			const [response1, response2] = await Promise.all([sendWebhook(eventData1), sendWebhook(eventData2)]);

			expect(response1.received).toBe(true);
			expect(response2.received).toBe(true);

			const userAfter = await createBuilder<{premium_type: number}>(harness, account.token).get('/users/@me').execute();

			expect(userAfter.premium_type).toBeGreaterThan(UserPremiumTypes.NONE);
		});
	});
});
