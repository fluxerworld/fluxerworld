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
import {createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createStripeApiHandlers} from '@fluxer/api/src/test/msw/handlers/StripeApiHandlers';
import {server} from '@fluxer/api/src/test/msw/server';
import {createBuilder} from '@fluxer/api/src/test/TestRequestBuilder';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {UserFlags, UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

const MOCK_CUSTOMER_ID = 'cus_test_existing';

const MOCK_PRICES = {
	monthlyUsd: 'price_monthly_usd',
	monthlyEur: 'price_monthly_eur',
	yearlyUsd: 'price_yearly_usd',
	yearlyEur: 'price_yearly_eur',
	gift1MonthUsd: 'price_gift_1_month_usd',
	gift1MonthEur: 'price_gift_1_month_eur',
	gift1YearUsd: 'price_gift_1_year_usd',
	gift1YearEur: 'price_gift_1_year_eur',
};

interface UrlResponse {
	url: string;
}

interface PriceIdsResponse {
	currency: string;
	monthly: string | null;
	yearly: string | null;
	gift_1_month: string | null;
	gift_1_year: string | null;
}

describe('StripeCheckoutService', () => {
	let harness: Awaited<ReturnType<typeof createApiTestHarness>>;
	let stripeHandlers: ReturnType<typeof createStripeApiHandlers>;
	let originalPrices: typeof Config.stripe.prices | undefined;

	beforeAll(async () => {
		harness = await createApiTestHarness();
		originalPrices = Config.stripe.prices;
		Config.stripe.prices = MOCK_PRICES;

		stripeHandlers = createStripeApiHandlers();
	});

	beforeEach(async () => {
		await harness.reset();
		stripeHandlers.reset();
		server.use(...stripeHandlers.handlers);
	});

	afterAll(async () => {
		await harness.shutdown();
		Config.stripe.prices = originalPrices;
	});

	describe('POST /stripe/checkout/subscription', () => {
		test('creates monthly subscription checkout session', async () => {
			const account = await createTestAccount(harness);

			const response = await createBuilder<UrlResponse>(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.execute();

			expect(response.url).toMatch(/^https:\/\/checkout\.stripe\.com/);

			expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(1);
			const session = stripeHandlers.spies.createdCheckoutSessions[0];
			expect(session?.mode).toBe('subscription');
			expect(session?.line_items).toHaveLength(1);
			expect(session?.line_items?.[0]?.price).toBe(MOCK_PRICES.monthlyUsd);
		});

		test('creates yearly subscription checkout session', async () => {
			const account = await createTestAccount(harness);

			const response = await createBuilder<UrlResponse>(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.yearlyUsd})
				.execute();

			expect(response.url).toMatch(/^https:\/\/checkout\.stripe\.com/);

			const session = stripeHandlers.spies.createdCheckoutSessions[0];
			expect(session?.mode).toBe('subscription');
		});

		test('creates stripe customer if user does not have one', async () => {
			const account = await createTestAccount(harness);

			await createBuilder<UrlResponse>(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.execute();

			expect(stripeHandlers.spies.createdCustomers).toHaveLength(1);
			expect(stripeHandlers.spies.createdCustomers[0]?.id).toMatch(/^cus_test_new_/);
		});

		test('uses existing stripe customer if user has one', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({stripe_customer_id: MOCK_CUSTOMER_ID})
				.execute();

			await createBuilder<UrlResponse>(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.execute();

			const session = stripeHandlers.spies.createdCheckoutSessions[0];
			expect(session?.customer).toBe(MOCK_CUSTOMER_ID);
		});

		test('includes correct success and cancel URLs', async () => {
			const account = await createTestAccount(harness);

			await createBuilder<UrlResponse>(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.execute();

			const session = stripeHandlers.spies.createdCheckoutSessions[0];
			expect(session?.success_url).toBe(`${Config.endpoints.webApp}/premium-callback?status=success`);
			expect(session?.cancel_url).toBe(`${Config.endpoints.webApp}/premium-callback?status=cancel`);
		});

		test('rejects unknown price ID', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: 'price_unknown'})
				.expect(400, APIErrorCodes.STRIPE_INVALID_PRODUCT)
				.execute();
		});

		test('rejects when lifetime user tries to buy recurring subscription', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.LIFETIME,
					premium_lifetime_sequence: 1,
				})
				.execute();

			await createBuilder(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.expect(403, APIErrorCodes.PREMIUM_PURCHASE_BLOCKED)
				.execute();
		});

		test('rejects unauthenticated requests', async () => {
			await createBuilder(harness, '')
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.expect(401)
				.execute();
		});
	});

	describe('POST /stripe/checkout/gift', () => {
		test('creates gift 1 month checkout session', async () => {
			const account = await createTestAccount(harness);

			const response = await createBuilder<UrlResponse>(harness, account.token)
				.post('/stripe/checkout/gift')
				.body({price_id: MOCK_PRICES.gift1MonthUsd})
				.execute();

			expect(response.url).toMatch(/^https:\/\/checkout\.stripe\.com/);

			const session = stripeHandlers.spies.createdCheckoutSessions[0];
			expect(session?.mode).toBe('payment');
		});

		test('creates gift 1 year checkout session', async () => {
			const account = await createTestAccount(harness);

			const response = await createBuilder<UrlResponse>(harness, account.token)
				.post('/stripe/checkout/gift')
				.body({price_id: MOCK_PRICES.gift1YearUsd})
				.execute();

			expect(response.url).toMatch(/^https:\/\/checkout\.stripe\.com/);
		});

		test('allows lifetime user to buy gift subscriptions', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({
					premium_type: UserPremiumTypes.LIFETIME,
					premium_lifetime_sequence: 1,
				})
				.execute();

			const response = await createBuilder<UrlResponse>(harness, account.token)
				.post('/stripe/checkout/gift')
				.body({price_id: MOCK_PRICES.gift1MonthUsd})
				.execute();

			expect(response.url).toMatch(/^https:\/\/checkout\.stripe\.com/);
		});

		test('rejects non-gift price ID via gift endpoint', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post('/stripe/checkout/gift')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.expect(400, APIErrorCodes.STRIPE_INVALID_PRODUCT_CONFIGURATION)
				.execute();
		});
	});

	describe('POST /premium/customer-portal', () => {
		test('creates customer portal session for user with stripe customer ID', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({stripe_customer_id: MOCK_CUSTOMER_ID})
				.execute();

			const response = await createBuilder<UrlResponse>(harness, account.token)
				.post('/premium/customer-portal')
				.execute();

			expect(response.url).toMatch(/^https:\/\/billing\.stripe\.com/);
			expect(stripeHandlers.spies.createdPortalSessions).toHaveLength(1);
			expect(stripeHandlers.spies.createdPortalSessions[0]?.customer).toBe(MOCK_CUSTOMER_ID);
		});

		test('includes correct return URL', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({stripe_customer_id: MOCK_CUSTOMER_ID})
				.execute();

			await createBuilder<UrlResponse>(harness, account.token).post('/premium/customer-portal').execute();

			const session = stripeHandlers.spies.createdPortalSessions[0];
			expect(session?.return_url).toBe(`${Config.endpoints.webApp}/premium-callback?status=closed-billing-portal`);
		});

		test('rejects when user has no stripe customer ID', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.post('/premium/customer-portal')
				.expect(400, APIErrorCodes.STRIPE_NO_PURCHASE_HISTORY)
				.execute();
		});

		test('rejects unauthenticated requests', async () => {
			await createBuilder(harness, '').post('/premium/customer-portal').expect(401).execute();
		});
	});

	describe('GET /premium/price-ids', () => {
		test('returns USD prices for non-EEA country', async () => {
			const response = await createBuilder<PriceIdsResponse>(harness, '')
				.get('/premium/price-ids?country_code=US')
				.execute();

			expect(response.currency).toBe('USD');
			expect(response.monthly).toBe(MOCK_PRICES.monthlyUsd);
			expect(response.yearly).toBe(MOCK_PRICES.yearlyUsd);
			expect(response.gift_1_month).toBe(MOCK_PRICES.gift1MonthUsd);
			expect(response.gift_1_year).toBe(MOCK_PRICES.gift1YearUsd);
		});

		test('returns EUR prices for EEA country', async () => {
			const response = await createBuilder<PriceIdsResponse>(harness, '')
				.get('/premium/price-ids?country_code=DE')
				.execute();

			expect(response.currency).toBe('EUR');
			expect(response.monthly).toBe(MOCK_PRICES.monthlyEur);
			expect(response.yearly).toBe(MOCK_PRICES.yearlyEur);
			expect(response.gift_1_month).toBe(MOCK_PRICES.gift1MonthEur);
			expect(response.gift_1_year).toBe(MOCK_PRICES.gift1YearEur);
		});

		test('returns USD prices when country code is not provided', async () => {
			const response = await createBuilder<PriceIdsResponse>(harness, '').get('/premium/price-ids').execute();

			expect(response.currency).toBe('USD');
			expect(response.monthly).toBe(MOCK_PRICES.monthlyUsd);
		});

		test('handles various EEA countries correctly', async () => {
			const eeaCountries = ['FR', 'IT', 'ES', 'NL', 'PL', 'NO', 'SE'];

			for (const country of eeaCountries) {
				const response = await createBuilder<PriceIdsResponse>(harness, '')
					.get(`/premium/price-ids?country_code=${country}`)
					.execute();
				expect(response.currency).toBe('EUR');
			}
		});
	});

	describe('validateUserCanPurchase', () => {
		test('allows normal user to purchase', async () => {
			const account = await createTestAccount(harness);

			const response = await createBuilder<UrlResponse>(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.execute();

			expect(response.url).toMatch(/^https:\/\/checkout\.stripe\.com/);
		});

		test('rejects unclaimed accounts', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token).post(`/test/users/${account.userId}/unclaim`).body(null).execute();

			await createBuilder(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.expect(400, APIErrorCodes.UNCLAIMED_ACCOUNT_CANNOT_MAKE_PURCHASES)
				.execute();
		});

		test('rejects when PREMIUM_PURCHASE_DISABLED flag is set', async () => {
			const account = await createTestAccount(harness);

			await createBuilder(harness, account.token)
				.patch(`/test/users/${account.userId}/flags`)
				.body({flags: UserFlags.PREMIUM_PURCHASE_DISABLED.toString()})
				.execute();

			await createBuilder(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.expect(403, APIErrorCodes.PREMIUM_PURCHASE_BLOCKED)
				.execute();
		});

		test('rejects within 30 days of first refund', async () => {
			const account = await createTestAccount(harness);
			const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({first_refund_at: twentyDaysAgo.toISOString()})
				.execute();

			await createBuilder(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.expect(403, APIErrorCodes.PREMIUM_PURCHASE_BLOCKED)
				.execute();
		});

		test('allows purchase exactly 30 days after first refund', async () => {
			const account = await createTestAccount(harness);
			const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({first_refund_at: thirtyDaysAgo.toISOString()})
				.execute();

			const response = await createBuilder<UrlResponse>(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.execute();

			expect(response.url).toMatch(/^https:\/\/checkout\.stripe\.com/);
		});

		test('allows purchase more than 30 days after first refund', async () => {
			const account = await createTestAccount(harness);
			const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);

			await createBuilder(harness, account.token)
				.post(`/test/users/${account.userId}/premium`)
				.body({first_refund_at: fortyDaysAgo.toISOString()})
				.execute();

			const response = await createBuilder<UrlResponse>(harness, account.token)
				.post('/stripe/checkout/subscription')
				.body({price_id: MOCK_PRICES.monthlyUsd})
				.execute();

			expect(response.url).toMatch(/^https:\/\/checkout\.stripe\.com/);
		});
	});
});
