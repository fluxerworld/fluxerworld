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
import {clearDonationTestEmails, listDonationTestEmails} from '@fluxer/api/src/donation/tests/DonationTestUtils';
import {ProductType} from '@fluxer/api/src/stripe/ProductRegistry';
import {createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {
	createCheckoutCompletedEvent,
	createMockWebhookPayload,
	createStripeApiHandlers,
	type StripeWebhookEventData,
} from '@fluxer/api/src/test/msw/handlers/StripeApiHandlers';
import {server} from '@fluxer/api/src/test/msw/server';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, test} from 'vitest';

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

describe('StripeWebhookService - checkout.session.completed', () => {
	let harness: Awaited<ReturnType<typeof createApiTestHarness>>;
	let stripeHandlers: ReturnType<typeof createStripeApiHandlers>;
	let originalWebhookSecret: string | undefined;
	let originalPrices: typeof Config.stripe.prices | undefined;

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
		server.use(...stripeHandlers.handlers);
	});

	afterEach(() => {
		server.resetHandlers();
	});

	afterAll(async () => {
		await harness.shutdown();
		Config.stripe.webhookSecret = originalWebhookSecret;
		Config.stripe.prices = originalPrices;
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

	describe('premium checkout', () => {
		test('processes completed premium checkout session successfully', async () => {
			const account = await createTestAccount(harness);

			const {PaymentRepository} = await import('@fluxer/api/src/user/repositories/PaymentRepository');
			const {UserRepository} = await import('@fluxer/api/src/user/repositories/UserRepository');
			const paymentRepository = new PaymentRepository();
			const userRepository = new UserRepository();

			await paymentRepository.createPayment({
				checkout_session_id: 'cs_test_123',
				user_id: createUserID(BigInt(account.userId)),
				price_id: MOCK_PRICES.monthlyUsd,
				product_type: ProductType.MONTHLY_SUBSCRIPTION,
				status: 'pending',
				is_gift: false,
				created_at: new Date(),
			});

			const eventData = createCheckoutCompletedEvent({
				sessionId: 'cs_test_123',
				customerId: 'cus_test_1',
				subscriptionId: 'sub_test_1',
				metadata: {},
			});

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);

			const updatedPayment = await userRepository.getPaymentByCheckoutSession('cs_test_123');
			expect(updatedPayment?.status).toBe('completed');
			expect(updatedPayment?.stripeCustomerId).toBe('cus_test_1');
			expect(updatedPayment?.subscriptionId).toBe('sub_test_1');

			const user = await createBuilder<{premium_type: number}>(harness, account.token).get('/users/@me').execute();
			expect(user.premium_type).toBe(UserPremiumTypes.SUBSCRIPTION);
		});

		test('updates user with Stripe customer ID on first purchase', async () => {
			const account = await createTestAccount(harness);

			const {PaymentRepository} = await import('@fluxer/api/src/user/repositories/PaymentRepository');
			const {UserRepository} = await import('@fluxer/api/src/user/repositories/UserRepository');
			const paymentRepository = new PaymentRepository();
			const userRepository = new UserRepository();

			await paymentRepository.createPayment({
				checkout_session_id: 'cs_test_123',
				user_id: createUserID(BigInt(account.userId)),
				price_id: MOCK_PRICES.monthlyUsd,
				product_type: ProductType.MONTHLY_SUBSCRIPTION,
				status: 'pending',
				is_gift: false,
				created_at: new Date(),
			});

			const eventData = createCheckoutCompletedEvent({
				sessionId: 'cs_test_123',
				customerId: 'cus_new_123',
				metadata: {},
			});

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);

			const user = await userRepository.findUnique(createUserID(BigInt(account.userId)));
			expect(user?.stripeCustomerId).toBe('cus_new_123');
		});

		test('skips already processed payment', async () => {
			const account = await createTestAccount(harness);

			const {PaymentRepository} = await import('@fluxer/api/src/user/repositories/PaymentRepository');
			const paymentRepository = new PaymentRepository();

			await paymentRepository.createPayment({
				checkout_session_id: 'cs_test_123',
				user_id: createUserID(BigInt(account.userId)),
				price_id: MOCK_PRICES.monthlyUsd,
				product_type: ProductType.MONTHLY_SUBSCRIPTION,
				status: 'completed',
				is_gift: false,
				created_at: new Date(),
			});

			const beforeUser = await createBuilder<{premium_type: number}>(harness, account.token)
				.get('/users/@me')
				.execute();

			const eventData = createCheckoutCompletedEvent({
				sessionId: 'cs_test_123',
				metadata: {},
			});

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);

			const afterUser = await createBuilder<{premium_type: number}>(harness, account.token).get('/users/@me').execute();
			expect(afterUser.premium_type).toBe(beforeUser.premium_type);
		});

		test('handles missing payment record gracefully', async () => {
			const eventData = createCheckoutCompletedEvent({
				sessionId: 'cs_nonexistent_123',
				metadata: {},
			});

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);
		});

		test('handles external donate checkout sessions without internal payment records', async () => {
			const eventData: StripeWebhookEventData = {
				type: 'checkout.session.completed',
				data: {
					object: {
						id: 'cs_external_donate_123',
						object: 'checkout.session',
						mode: 'payment',
						status: 'complete',
						payment_status: 'paid',
						submit_type: 'donate',
						payment_link: 'plink_external_123',
						payment_intent: 'pi_external_123',
						amount_total: 1000,
						currency: 'usd',
						customer: null,
						customer_email: null,
						customer_details: {
							email: 'external-donor@example.com',
							name: 'External Donor',
						},
						metadata: {},
					},
				},
			};

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);
		});

		test('handles gift purchase correctly', async () => {
			const account = await createTestAccount(harness);

			const {PaymentRepository} = await import('@fluxer/api/src/user/repositories/PaymentRepository');
			const {UserRepository} = await import('@fluxer/api/src/user/repositories/UserRepository');
			const paymentRepository = new PaymentRepository();
			const userRepository = new UserRepository();

			await paymentRepository.createPayment({
				checkout_session_id: 'cs_test_123',
				user_id: createUserID(BigInt(account.userId)),
				price_id: MOCK_PRICES.gift1MonthUsd,
				product_type: ProductType.GIFT_1_MONTH,
				status: 'pending',
				is_gift: true,
				created_at: new Date(),
			});

			const eventData = createCheckoutCompletedEvent({
				sessionId: 'cs_test_123',
				metadata: {},
			});

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);

			const updatedPayment = await userRepository.getPaymentByCheckoutSession('cs_test_123');
			expect(updatedPayment?.status).toBe('completed');
			expect(updatedPayment?.giftCode).not.toBeNull();

			const user = await createBuilder<{premium_type: number}>(harness, account.token).get('/users/@me').execute();
			expect(user.premium_type).toBe(UserPremiumTypes.NONE);
		});
	});

	describe('donation checkout', () => {
		test('handles donation without email gracefully', async () => {
			const eventData = createCheckoutCompletedEvent({
				metadata: {is_donation: 'true'},
			});

			await sendWebhookExpectStripeError(eventData);
		});

		test('records donation with valid email and subscription', async () => {
			await clearDonationTestEmails(harness);

			const donationEmail = 'donor@example.com';
			const eventData = createCheckoutCompletedEvent({
				customerId: 'cus_donation_1',
				subscriptionId: 'sub_donation_1',
				metadata: {is_donation: 'true', donation_email: donationEmail},
			});

			const result = await sendWebhook(eventData);
			expect(result.received).toBe(true);

			const {DonationRepository} = await import('@fluxer/api/src/donation/DonationRepository');
			const donationRepository = new DonationRepository();

			const donor = await donationRepository.findDonorByEmail(donationEmail);
			expect(donor).not.toBeNull();
			expect(donor?.stripeCustomerId).toBe('cus_donation_1');
			expect(donor?.stripeSubscriptionId).toBe('sub_donation_1');

			const emails = await listDonationTestEmails(harness, {recipient: donationEmail});
			const confirmationEmail = emails.find((e) => e.type === 'donation_confirmation');
			expect(confirmationEmail).toBeDefined();
			expect(confirmationEmail?.to).toBe(donationEmail);
		});
	});
});
