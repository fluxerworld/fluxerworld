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
	createStripeApiHandlers,
	createSubscriptionDeletedEvent,
	createSubscriptionUpdatedEvent,
	type StripeWebhookEventData,
} from '@fluxer/api/src/test/msw/handlers/StripeApiHandlers';
import {server} from '@fluxer/api/src/test/msw/server';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {PaymentRepository} from '@fluxer/api/src/user/repositories/PaymentRepository';
import {UserRepository} from '@fluxer/api/src/user/repositories/UserRepository';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, test} from 'vitest';

const MOCK_PRICES = {
	monthlyUsd: 'price_monthly_usd',
};

describe('Stripe Webhook Subscription Lifecycle', () => {
	let harness: Awaited<ReturnType<typeof createApiTestHarness>>;
	let stripeHandlers: ReturnType<typeof createStripeApiHandlers>;
	let originalWebhookSecret: string | undefined;
	let originalPrices: typeof Config.stripe.prices | undefined;
	let paymentRepository: PaymentRepository;
	let userRepository: UserRepository;

	beforeAll(async () => {
		harness = await createApiTestHarness();
		originalWebhookSecret = Config.stripe.webhookSecret;
		originalPrices = Config.stripe.prices;
		Config.stripe.webhookSecret = 'whsec_test_secret';
		Config.stripe.prices = MOCK_PRICES;

		stripeHandlers = createStripeApiHandlers();
		server.use(...stripeHandlers.handlers);

		paymentRepository = new PaymentRepository();
		userRepository = new UserRepository();
	});

	afterAll(async () => {
		await harness.shutdown();
		Config.stripe.webhookSecret = originalWebhookSecret;
		Config.stripe.prices = originalPrices;
	});

	beforeEach(async () => {
		await harness.resetData();
		stripeHandlers.reset();
	});

	afterEach(() => {
		server.resetHandlers();
		server.use(...stripeHandlers.handlers);
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

	describe('customer.subscription.updated', () => {
		test('updates subscription cancellation status when cancel_at_period_end is true', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));
			const subscriptionId = 'sub_test_monthly';
			const sessionId = `cs_test_cancel_${Date.now()}`;
			const cancelAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

			await paymentRepository.createPayment({
				checkout_session_id: sessionId,
				user_id: userId,
				price_id: MOCK_PRICES.monthlyUsd,
				product_type: ProductType.MONTHLY_SUBSCRIPTION,
				status: 'completed',
				is_gift: false,
				created_at: new Date(),
			});

			await paymentRepository.updatePayment({
				checkout_session_id: sessionId,
				subscription_id: subscriptionId,
				stripe_customer_id: 'cus_test_1',
				status: 'completed',
			});

			await userRepository.patchUpsert(
				userId,
				{
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					stripe_subscription_id: subscriptionId,
					stripe_customer_id: 'cus_test_1',
					premium_since: new Date(),
				},
				(await userRepository.findUnique(userId))!.toRow(),
			);

			const eventData = createSubscriptionUpdatedEvent({
				subscriptionId,
				cancelAtPeriodEnd: true,
			});
			eventData.data.object.cancel_at = cancelAt;
			eventData.data.object.items = {
				data: [{current_period_end: cancelAt}],
			};

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);

			const response = await harness.requestJson({
				path: '/users/@me',
				method: 'GET',
				headers: {authorization: account.token},
			});
			const user = (await response.json()) as {premium_will_cancel: boolean; premium_until: string | null};

			expect(user.premium_will_cancel).toBe(true);
			expect(user.premium_until).not.toBeNull();
		});

		test('preserves gifted extension when updating subscription', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));
			const subscriptionId = 'sub_test_gifted';
			const sessionId = `cs_test_gifted_${Date.now()}`;
			const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
			const currentPeriodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

			await paymentRepository.createPayment({
				checkout_session_id: sessionId,
				user_id: userId,
				price_id: MOCK_PRICES.monthlyUsd,
				product_type: ProductType.MONTHLY_SUBSCRIPTION,
				status: 'completed',
				is_gift: false,
				created_at: new Date(),
			});

			await paymentRepository.updatePayment({
				checkout_session_id: sessionId,
				subscription_id: subscriptionId,
				stripe_customer_id: 'cus_test_1',
				status: 'completed',
			});

			await userRepository.patchUpsert(
				userId,
				{
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_until: futureDate,
					stripe_subscription_id: subscriptionId,
					stripe_customer_id: 'cus_test_1',
					premium_since: new Date(),
				},
				(await userRepository.findUnique(userId))!.toRow(),
			);

			const eventData = createSubscriptionUpdatedEvent({
				subscriptionId,
				cancelAtPeriodEnd: false,
			});
			eventData.data.object.cancel_at = null;
			eventData.data.object.items = {
				data: [{current_period_end: currentPeriodEnd}],
			};

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);

			const response = await harness.requestJson({
				path: '/users/@me',
				method: 'GET',
				headers: {authorization: account.token},
			});
			const user = (await response.json()) as {premium_will_cancel: boolean; premium_until: string | null};

			expect(user.premium_will_cancel).toBe(false);
			expect(user.premium_until).not.toBeNull();
			const premiumUntil = new Date(user.premium_until!);
			expect(premiumUntil.getTime()).toBeGreaterThan(new Date(currentPeriodEnd * 1000).getTime());
		});

		test('does not clear premium when period end is missing', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));
			const subscriptionId = 'sub_test_missing_period';
			const sessionId = `cs_test_missing_period_${Date.now()}`;
			const futureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

			await paymentRepository.createPayment({
				checkout_session_id: sessionId,
				user_id: userId,
				price_id: MOCK_PRICES.monthlyUsd,
				product_type: ProductType.MONTHLY_SUBSCRIPTION,
				status: 'completed',
				is_gift: false,
				created_at: new Date(),
			});

			await paymentRepository.updatePayment({
				checkout_session_id: sessionId,
				subscription_id: subscriptionId,
				stripe_customer_id: 'cus_test_1',
				status: 'completed',
			});

			await userRepository.patchUpsert(
				userId,
				{
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					premium_until: futureDate,
					stripe_subscription_id: subscriptionId,
					stripe_customer_id: 'cus_test_1',
					premium_since: new Date(),
				},
				(await userRepository.findUnique(userId))!.toRow(),
			);

			const eventData = createSubscriptionUpdatedEvent({
				subscriptionId,
				cancelAtPeriodEnd: false,
			});
			eventData.data.object.items = {data: []};

			await sendWebhookExpectStripeError(eventData);

			const response = await harness.requestJson({
				path: '/users/@me',
				method: 'GET',
				headers: {authorization: account.token},
			});
			const user = (await response.json()) as {premium_until: string | null};

			expect(user.premium_until).not.toBeNull();
			const premiumUntil = new Date(user.premium_until!);
			expect(premiumUntil.getTime()).toBeGreaterThanOrEqual(futureDate.getTime() - 1000);
		});
	});

	describe('customer.subscription.deleted', () => {
		test('removes premium for non-lifetime users on subscription deletion', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));
			const subscriptionId = 'sub_test_to_delete';
			const sessionId = `cs_test_delete_${Date.now()}`;

			await paymentRepository.createPayment({
				checkout_session_id: sessionId,
				user_id: userId,
				price_id: MOCK_PRICES.monthlyUsd,
				product_type: ProductType.MONTHLY_SUBSCRIPTION,
				status: 'completed',
				is_gift: false,
				created_at: new Date(),
			});

			await paymentRepository.updatePayment({
				checkout_session_id: sessionId,
				subscription_id: subscriptionId,
				stripe_customer_id: 'cus_test_1',
				status: 'completed',
			});

			await userRepository.patchUpsert(
				userId,
				{
					premium_type: UserPremiumTypes.SUBSCRIPTION,
					stripe_subscription_id: subscriptionId,
					stripe_customer_id: 'cus_test_1',
					premium_since: new Date(),
				},
				(await userRepository.findUnique(userId))!.toRow(),
			);

			const beforeUser = await userRepository.findUnique(userId);
			expect(beforeUser?.premiumType).toBe(UserPremiumTypes.SUBSCRIPTION);
			expect(beforeUser?.stripeSubscriptionId).toBe(subscriptionId);

			const eventData = createSubscriptionDeletedEvent({subscriptionId});
			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);

			const afterUser = await userRepository.findUnique(userId);
			expect(afterUser?.premiumType).toBe(UserPremiumTypes.NONE);
			expect(afterUser?.premiumUntil).toBeNull();
			expect(afterUser?.stripeSubscriptionId).toBeNull();
		});

		test('preserves lifetime premium on subscription deletion', async () => {
			const account = await createTestAccount(harness);
			const userId = createUserID(BigInt(account.userId));
			const subscriptionId = 'sub_test_lifetime_user';
			const sessionId = `cs_test_lifetime_${Date.now()}`;

			await paymentRepository.createPayment({
				checkout_session_id: sessionId,
				user_id: userId,
				price_id: MOCK_PRICES.monthlyUsd,
				product_type: ProductType.MONTHLY_SUBSCRIPTION,
				status: 'completed',
				is_gift: false,
				created_at: new Date(),
			});

			await paymentRepository.updatePayment({
				checkout_session_id: sessionId,
				subscription_id: subscriptionId,
				stripe_customer_id: 'cus_test_1',
				status: 'completed',
			});

			await userRepository.patchUpsert(
				userId,
				{
					premium_type: UserPremiumTypes.LIFETIME,
					stripe_subscription_id: subscriptionId,
					stripe_customer_id: 'cus_test_1',
					premium_since: new Date(),
				},
				(await userRepository.findUnique(userId))!.toRow(),
			);

			const beforeUser = await userRepository.findUnique(userId);
			expect(beforeUser?.premiumType).toBe(UserPremiumTypes.LIFETIME);

			const eventData = createSubscriptionDeletedEvent({subscriptionId});
			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);

			const afterUser = await userRepository.findUnique(userId);
			expect(afterUser?.premiumType).toBe(UserPremiumTypes.LIFETIME);
			expect(afterUser?.stripeSubscriptionId).toBeNull();
		});

		test('processes donation subscription deletion', async () => {
			const subscriptionId = 'sub_donor_delete_test';
			const donorEmail = 'donor-delete@example.com';
			const {DonationRepository} = await import('@fluxer/api/src/donation/DonationRepository');
			const donationRepository = new DonationRepository();

			await donationRepository.createDonor({
				email: donorEmail,
				stripeCustomerId: 'cus_donor_delete_123',
				businessName: null,
				taxId: null,
				taxIdType: null,
				stripeSubscriptionId: subscriptionId,
				subscriptionAmountCents: 2500,
				subscriptionCurrency: 'usd',
				subscriptionInterval: 'month',
				subscriptionCurrentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			});

			const donorBefore = await donationRepository.findDonorByEmail(donorEmail);
			expect(donorBefore).not.toBeNull();
			expect(donorBefore?.stripeSubscriptionId).toBe(subscriptionId);

			const deleteEvent = createSubscriptionDeletedEvent({subscriptionId});
			const deleteResult = await sendWebhook(deleteEvent);
			expect(deleteResult.received).toBe(true);

			const donorAfter = await donationRepository.findDonorByEmail(donorEmail);
			expect(donorAfter?.stripeSubscriptionId).toBeNull();
		});
	});
});
