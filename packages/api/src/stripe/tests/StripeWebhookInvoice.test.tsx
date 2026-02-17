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

import crypto from 'node:crypto';
import {createTestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {createUserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import {ProductType} from '@fluxer/api/src/stripe/ProductRegistry';
import {createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {
	createMockWebhookPayload,
	type StripeWebhookEventData,
} from '@fluxer/api/src/test/msw/handlers/StripeApiHandlers';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

const MOCK_PRICES = {
	monthlyUsd: 'price_monthly_usd',
	monthlyEur: 'price_monthly_eur',
	yearlyUsd: 'price_yearly_usd',
	yearlyEur: 'price_yearly_eur',
	visionaryUsd: 'price_visionary_usd',
	visionaryEur: 'price_visionary_eur',
	giftVisionaryUsd: 'price_gift_visionary_usd',
	giftVisionaryEur: 'price_gift_visionary_eur',
	gift1MonthUsd: 'price_gift_1_month_usd',
	gift1MonthEur: 'price_gift_1_month_eur',
	gift1YearUsd: 'price_gift_1_year_usd',
	gift1YearEur: 'price_gift_1_year_eur',
};

describe('Stripe Webhook - Invoice Events', () => {
	let harness: Awaited<ReturnType<typeof createApiTestHarness>>;
	let originalWebhookSecret: string | undefined;
	let originalPrices: typeof Config.stripe.prices | undefined;

	beforeAll(async () => {
		harness = await createApiTestHarness();
		originalWebhookSecret = Config.stripe.webhookSecret;
		originalPrices = Config.stripe.prices;
		Config.stripe.webhookSecret = 'whsec_test_secret';
		Config.stripe.prices = MOCK_PRICES;
	});

	afterAll(async () => {
		await harness.shutdown();
		Config.stripe.webhookSecret = originalWebhookSecret;
		Config.stripe.prices = originalPrices;
	});

	beforeEach(async () => {
		await harness.resetData();
	});

	function createWebhookSignature(payload: string, timestamp: number, secret: string): string {
		const signedPayload = `${timestamp}.${payload}`;
		const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
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

	async function sendWebhookExpectStripeError(eventData: StripeWebhookEventData): Promise<void> {
		const {payload, timestamp} = createMockWebhookPayload(eventData);
		const signature = createWebhookSignature(payload, timestamp, Config.stripe.webhookSecret!);

		await createBuilder(harness, '')
			.post('/stripe/webhook')
			.header('stripe-signature', signature)
			.header('content-type', 'application/json')
			.body(payload)
			.expect(400, APIErrorCodes.STRIPE_ERROR)
			.execute();
	}

	async function createPaymentRecord(params: {
		userId: string;
		subscriptionId: string;
		priceId: string;
		productType: string;
	}): Promise<void> {
		const {userId, subscriptionId, priceId, productType} = params;
		const checkoutSessionId = `cs_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;

		const {PaymentRepository} = await import('@fluxer/api/src/user/repositories/PaymentRepository');
		const paymentRepo = new PaymentRepository();

		await paymentRepo.createPayment({
			checkout_session_id: checkoutSessionId,
			user_id: createUserID(BigInt(userId)),
			price_id: priceId,
			product_type: productType,
			status: 'complete',
			is_gift: false,
			created_at: new Date(),
		});

		await paymentRepo.updatePayment({
			checkout_session_id: checkoutSessionId,
			subscription_id: subscriptionId,
			stripe_customer_id: `cus_test_${Date.now()}`,
			payment_intent_id: `pi_test_${Date.now()}`,
			amount_cents: 2500,
			currency: 'usd',
			completed_at: new Date(),
		});
	}

	describe('invoice.payment_succeeded', () => {
		test('processes recurring subscription payment successfully', async () => {
			const account = await createTestAccount(harness);
			const subscriptionId = `sub_test_${Date.now()}`;

			await createPaymentRecord({
				userId: account.userId,
				subscriptionId,
				priceId: MOCK_PRICES.monthlyUsd,
				productType: ProductType.MONTHLY_SUBSCRIPTION,
			});

			const eventData: StripeWebhookEventData = {
				type: 'invoice.payment_succeeded',
				data: {
					object: {
						id: `in_test_${Date.now()}`,
						billing_reason: 'subscription_cycle',
						subscription: subscriptionId,
					},
				},
			};

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);

			const user = await createBuilder<{
				premium_type: number | null;
				premium_until: string | null;
			}>(harness, account.token)
				.get('/users/@me')
				.execute();

			expect(user.premium_type).toBe(UserPremiumTypes.SUBSCRIPTION);
			expect(user.premium_until).not.toBeNull();

			const premiumUntil = new Date(user.premium_until!);
			const now = new Date();
			const daysDiff = (premiumUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

			expect(daysDiff).toBeGreaterThanOrEqual(27);
			expect(daysDiff).toBeLessThanOrEqual(31);
		});

		test('skips first invoice for new subscription', async () => {
			const account = await createTestAccount(harness);
			const subscriptionId = `sub_test_${Date.now()}`;

			await createPaymentRecord({
				userId: account.userId,
				subscriptionId,
				priceId: MOCK_PRICES.monthlyUsd,
				productType: ProductType.MONTHLY_SUBSCRIPTION,
			});

			const eventData: StripeWebhookEventData = {
				type: 'invoice.payment_succeeded',
				data: {
					object: {
						id: `in_test_${Date.now()}`,
						billing_reason: 'subscription_create',
						subscription: subscriptionId,
					},
				},
			};

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);

			const user = await createBuilder<{
				premium_type: number;
				premium_until: string | null;
			}>(harness, account.token)
				.get('/users/@me')
				.execute();

			expect(user.premium_type).toBe(0);
			expect(user.premium_until).toBeNull();
		});

		test('skips manual invoice payments with no subscription context', async () => {
			const eventData: StripeWebhookEventData = {
				type: 'invoice.payment_succeeded',
				data: {
					object: {
						id: `in_test_${Date.now()}`,
						billing_reason: 'manual',
						collection_method: 'send_invoice',
					},
				},
			};

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);
		});

		test('handles missing subscription info gracefully', async () => {
			const subscriptionId = `sub_test_nonexistent_${Date.now()}`;

			const eventData: StripeWebhookEventData = {
				type: 'invoice.payment_succeeded',
				data: {
					object: {
						id: `in_test_${Date.now()}`,
						billing_reason: 'subscription_cycle',
						subscription: subscriptionId,
					},
				},
			};

			await sendWebhookExpectStripeError(eventData);
		});

		test('processes yearly subscription renewal correctly', async () => {
			const account = await createTestAccount(harness);
			const subscriptionId = `sub_test_${Date.now()}`;

			await createPaymentRecord({
				userId: account.userId,
				subscriptionId,
				priceId: MOCK_PRICES.yearlyUsd,
				productType: ProductType.YEARLY_SUBSCRIPTION,
			});

			const eventData: StripeWebhookEventData = {
				type: 'invoice.payment_succeeded',
				data: {
					object: {
						id: `in_test_${Date.now()}`,
						billing_reason: 'subscription_cycle',
						subscription: subscriptionId,
					},
				},
			};

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);

			const user = await createBuilder<{
				premium_type: number | null;
				premium_until: string | null;
			}>(harness, account.token)
				.get('/users/@me')
				.execute();

			expect(user.premium_type).toBe(UserPremiumTypes.SUBSCRIPTION);
			expect(user.premium_until).not.toBeNull();

			const premiumUntil = new Date(user.premium_until!);
			const now = new Date();
			const daysDiff = (premiumUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

			expect(daysDiff).toBeGreaterThanOrEqual(358);
			expect(daysDiff).toBeLessThanOrEqual(370);
		});

		test('stacks renewal on top of existing premium time', async () => {
			const account = await createTestAccount(harness);
			const subscriptionId = `sub_test_${Date.now()}`;

			const oneMonthLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_until: oneMonthLater.toISOString(),
					stripe_subscription_id: subscriptionId,
				})
				.execute();

			await createPaymentRecord({
				userId: account.userId,
				subscriptionId,
				priceId: MOCK_PRICES.monthlyUsd,
				productType: ProductType.MONTHLY_SUBSCRIPTION,
			});

			const userBefore = await createBuilder<{premium_until: string | null}>(harness, account.token)
				.get('/users/@me')
				.execute();
			const beforeExpiry = new Date(userBefore.premium_until!);

			const eventData: StripeWebhookEventData = {
				type: 'invoice.payment_succeeded',
				data: {
					object: {
						id: `in_test_${Date.now()}`,
						billing_reason: 'subscription_cycle',
						subscription: subscriptionId,
					},
				},
			};

			await sendWebhook(eventData);

			const userAfter = await createBuilder<{premium_until: string | null}>(harness, account.token)
				.get('/users/@me')
				.execute();
			const afterExpiry = new Date(userAfter.premium_until!);

			const daysDifference = (afterExpiry.getTime() - beforeExpiry.getTime()) / (1000 * 60 * 60 * 24);

			expect(daysDifference).toBeGreaterThanOrEqual(27);
			expect(daysDifference).toBeLessThanOrEqual(31);
		});
	});
});
