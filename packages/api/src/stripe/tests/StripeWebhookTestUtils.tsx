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

import {createTestAccount, type TestAccount} from '@fluxer/api/src/auth/tests/AuthTestUtils';
import {createUserID, type UserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import type {StripeWebhookService} from '@fluxer/api/src/stripe/services/StripeWebhookService';
import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {
	createMockWebhookPayload,
	createStripeApiHandlers,
	type StripeApiMockConfig,
	type StripeApiMockSpies,
	type StripeWebhookEventData,
} from '@fluxer/api/src/test/msw/handlers/StripeApiHandlers';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {setupServer} from 'msw/node';
import {afterAll, afterEach, beforeAll} from 'vitest';

export interface WebhookTestHarness {
	harness: ApiTestHarness;
	stripeHandlers: {
		spies: StripeApiMockSpies;
		reset: () => void;
	};
	mswServer: ReturnType<typeof setupServer>;
}

export async function createWebhookTestHarness(config?: StripeApiMockConfig): Promise<WebhookTestHarness> {
	const harness = await createApiTestHarness();

	const stripeHandlers = createStripeApiHandlers(config);
	const mswServer = setupServer(...stripeHandlers.handlers);

	return {
		harness,
		stripeHandlers: {
			spies: stripeHandlers.spies,
			reset: stripeHandlers.reset,
		},
		mswServer,
	};
}

export function setupWebhookTestServer(testHarness: WebhookTestHarness): void {
	beforeAll(() => {
		testHarness.mswServer.listen({onUnhandledRequest: 'bypass'});
	});

	afterEach(() => {
		testHarness.stripeHandlers.reset();
		testHarness.mswServer.resetHandlers();
	});

	afterAll(() => {
		testHarness.mswServer.close();
	});
}

export async function sendWebhook(service: StripeWebhookService, eventData: StripeWebhookEventData): Promise<void> {
	const {payload, timestamp} = createMockWebhookPayload(eventData);

	const signature = `t=${timestamp},v1=test_signature_${Date.now()}`;

	await service.handleWebhook({
		body: payload,
		signature,
	});
}

export async function createTestUserWithPremium(
	harness: ApiTestHarness,
	premiumType: number,
	options?: {
		email?: string;
		username?: string;
		premiumUntil?: Date;
		stripeCustomerId?: string;
		stripeSubscriptionId?: string;
	},
): Promise<TestAccount> {
	const account = await createTestAccount(harness, {
		email: options?.email,
		username: options?.username,
	});

	await createBuilder(harness, account.token)
		.patch(`/test/users/${account.userId}/premium`)
		.body({
			premium_type: premiumType,
			premium_until: options?.premiumUntil?.toISOString() || null,
			stripe_customer_id: options?.stripeCustomerId || null,
			stripe_subscription_id: options?.stripeSubscriptionId || null,
		})
		.execute();

	return account;
}

export async function createTestPayment(
	harness: ApiTestHarness,
	userId: UserID,
	sessionId: string,
	options?: {
		priceId?: string;
		productType?: string;
		status?: string;
		isGift?: boolean;
		giftCode?: string;
		stripeCustomerId?: string;
		paymentIntentId?: string;
		subscriptionId?: string;
	},
): Promise<void> {
	await createBuilder(harness, '')
		.post('/test/payments')
		.body({
			checkout_session_id: sessionId,
			user_id: userId,
			price_id: options?.priceId || 'price_test_monthly',
			product_type: options?.productType || 'monthly_subscription',
			status: options?.status || 'pending',
			is_gift: options?.isGift || false,
			gift_code: options?.giftCode || null,
			stripe_customer_id: options?.stripeCustomerId || null,
			payment_intent_id: options?.paymentIntentId || null,
			subscription_id: options?.subscriptionId || null,
		})
		.execute();
}

export interface CreateTestAccountWithPaymentOptions {
	email?: string;
	username?: string;
	sessionId?: string;
	priceId?: string;
	productType?: string;
	status?: string;
	isGift?: boolean;
}

export async function createTestAccountWithPayment(
	harness: ApiTestHarness,
	options?: CreateTestAccountWithPaymentOptions,
): Promise<{account: TestAccount; sessionId: string}> {
	const account = await createTestAccount(harness, {
		email: options?.email,
		username: options?.username,
	});

	const sessionId = options?.sessionId || `cs_test_${Date.now()}`;

	const userId = typeof account.userId === 'string' ? createUserID(BigInt(account.userId)) : account.userId;

	await createTestPayment(harness, userId, sessionId, {
		priceId: options?.priceId,
		productType: options?.productType,
		status: options?.status,
		isGift: options?.isGift,
	});

	return {account, sessionId};
}

export async function setUserPremium(
	harness: ApiTestHarness,
	userId: UserID,
	premiumType: number,
	options?: {
		premiumUntil?: Date | null;
		premiumSince?: Date | null;
		stripeCustomerId?: string | null;
		stripeSubscriptionId?: string | null;
		premiumBillingCycle?: string | null;
		premiumWillCancel?: boolean;
	},
): Promise<void> {
	await createBuilder(harness, '')
		.patch(`/test/users/${userId}/premium`)
		.body({
			premium_type: premiumType,
			premium_until: options?.premiumUntil?.toISOString() || null,
			premium_since: options?.premiumSince?.toISOString() || null,
			stripe_customer_id: options?.stripeCustomerId || null,
			stripe_subscription_id: options?.stripeSubscriptionId || null,
			premium_billing_cycle: options?.premiumBillingCycle || null,
			premium_will_cancel: options?.premiumWillCancel || false,
		})
		.execute();
}

export async function createTestGiftCode(
	harness: ApiTestHarness,
	code: string,
	createdByUserId: UserID,
	options?: {
		durationMonths?: number;
		redeemedByUserId?: UserID | null;
		redeemedAt?: Date | null;
		paymentIntentId?: string | null;
		checkoutSessionId?: string | null;
	},
): Promise<void> {
	await createBuilder(harness, '')
		.post('/test/gift-codes')
		.body({
			code,
			created_by_user_id: createdByUserId,
			duration_months: options?.durationMonths || 1,
			redeemed_by_user_id: options?.redeemedByUserId || null,
			redeemed_at: options?.redeemedAt?.toISOString() || null,
			stripe_payment_intent_id: options?.paymentIntentId || null,
			checkout_session_id: options?.checkoutSessionId || null,
		})
		.execute();
}

export function mockStripeWebhookSecret(secret = 'whsec_test'): void {
	Object.defineProperty(Config.stripe, 'webhookSecret', {
		get: () => secret,
		configurable: true,
	});
}

export function restoreStripeWebhookSecret(): void {
	delete (Config.stripe as {webhookSecret?: string}).webhookSecret;
}

export {
	createCheckoutCompletedEvent,
	createInvoicePaidEvent,
	createInvoicePaymentFailedEvent,
	createSubscriptionDeletedEvent,
	createSubscriptionUpdatedEvent,
} from '@fluxer/api/src/test/msw/handlers/StripeApiHandlers';
