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

import {
	createDonationCheckoutBuilder,
	createValidCheckoutBody,
	DONATION_AMOUNTS,
	DONATION_CURRENCIES,
	DONATION_INTERVALS,
	TEST_DONOR_EMAIL,
} from '@fluxer/api/src/donation/tests/DonationTestUtils';
import {createApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createStripeApiHandlers} from '@fluxer/api/src/test/msw/handlers/StripeApiHandlers';
import {server} from '@fluxer/api/src/test/msw/server';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import {afterAll, beforeAll, beforeEach, describe, expect, test} from 'vitest';

describe('POST /donations/checkout', () => {
	let harness: Awaited<ReturnType<typeof createApiTestHarness>>;
	let stripeHandlers: ReturnType<typeof createStripeApiHandlers>;

	beforeAll(async () => {
		harness = await createApiTestHarness();
		stripeHandlers = createStripeApiHandlers();
	});

	afterAll(async () => {
		await harness.shutdown();
	});

	beforeEach(async () => {
		await harness.resetData();
		stripeHandlers.reset();
		server.use(...stripeHandlers.handlers);
	});

	test('creates checkout session with valid params', async () => {
		const response = await createDonationCheckoutBuilder(harness).body(createValidCheckoutBody()).expect(200).execute();

		expect(response.url).toContain('https://');
		expect(response.url).toContain('checkout.stripe.com');
		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(1);
	});

	test('passes customer email to stripe', async () => {
		await createDonationCheckoutBuilder(harness)
			.body(createValidCheckoutBody({email: TEST_DONOR_EMAIL}))
			.expect(200)
			.execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(1);
		const session = stripeHandlers.spies.createdCheckoutSessions[0];
		expect(session?.customer_email).toBe(TEST_DONOR_EMAIL);
	});

	test('sets subscription mode', async () => {
		await createDonationCheckoutBuilder(harness).body(createValidCheckoutBody()).expect(200).execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(1);
		const session = stripeHandlers.spies.createdCheckoutSessions[0];
		expect(session?.mode).toBe('subscription');
	});

	test('rejects amount below minimum', async () => {
		await createDonationCheckoutBuilder(harness)
			.body(
				createValidCheckoutBody({
					amount_cents: DONATION_AMOUNTS.BELOW_MINIMUM,
				}),
			)
			.expect(400, APIErrorCodes.INVALID_FORM_BODY)
			.execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});

	test('rejects amount above maximum', async () => {
		await createDonationCheckoutBuilder(harness)
			.body(
				createValidCheckoutBody({
					amount_cents: DONATION_AMOUNTS.ABOVE_MAXIMUM,
				}),
			)
			.expect(400, APIErrorCodes.INVALID_FORM_BODY)
			.execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});

	test('accepts minimum amount', async () => {
		const response = await createDonationCheckoutBuilder(harness)
			.body(
				createValidCheckoutBody({
					amount_cents: DONATION_AMOUNTS.MINIMUM,
				}),
			)
			.expect(200)
			.execute();

		expect(response.url).toContain('https://');
		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(1);
	});

	test('accepts maximum amount', async () => {
		const response = await createDonationCheckoutBuilder(harness)
			.body(
				createValidCheckoutBody({
					amount_cents: DONATION_AMOUNTS.MAXIMUM,
				}),
			)
			.expect(200)
			.execute();

		expect(response.url).toContain('https://');
		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(1);
	});

	test('accepts EUR currency', async () => {
		const response = await createDonationCheckoutBuilder(harness)
			.body(
				createValidCheckoutBody({
					currency: DONATION_CURRENCIES.EUR,
				}),
			)
			.expect(200)
			.execute();

		expect(response.url).toBeDefined();
		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(1);
	});

	test('accepts USD currency', async () => {
		const response = await createDonationCheckoutBuilder(harness)
			.body(
				createValidCheckoutBody({
					currency: DONATION_CURRENCIES.USD,
				}),
			)
			.expect(200)
			.execute();

		expect(response.url).toBeDefined();
		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(1);
	});

	test('accepts monthly interval', async () => {
		const response = await createDonationCheckoutBuilder(harness)
			.body(
				createValidCheckoutBody({
					interval: DONATION_INTERVALS.MONTH,
				}),
			)
			.expect(200)
			.execute();

		expect(response.url).toBeDefined();
		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(1);
	});

	test('accepts yearly interval', async () => {
		const response = await createDonationCheckoutBuilder(harness)
			.body(
				createValidCheckoutBody({
					interval: DONATION_INTERVALS.YEAR,
				}),
			)
			.expect(200)
			.execute();

		expect(response.url).toBeDefined();
		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(1);
	});

	test('rejects invalid email', async () => {
		await createDonationCheckoutBuilder(harness)
			.body(
				createValidCheckoutBody({
					email: 'not-an-email',
				}),
			)
			.expect(400)
			.execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});

	test('rejects empty email', async () => {
		await createDonationCheckoutBuilder(harness)
			.body(
				createValidCheckoutBody({
					email: '',
				}),
			)
			.expect(400)
			.execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});

	test('rejects missing email field', async () => {
		const body = createValidCheckoutBody();
		const {email: _, ...bodyWithoutEmail} = body;

		await createDonationCheckoutBuilder(harness).body(bodyWithoutEmail).expect(400).execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});

	test('rejects missing amount_cents field', async () => {
		const body = createValidCheckoutBody();
		const {amount_cents: _, ...bodyWithoutAmount} = body;

		await createDonationCheckoutBuilder(harness).body(bodyWithoutAmount).expect(400).execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});

	test('rejects missing currency field', async () => {
		const body = createValidCheckoutBody();
		const {currency: _, ...bodyWithoutCurrency} = body;

		await createDonationCheckoutBuilder(harness).body(bodyWithoutCurrency).expect(400).execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});

	test('rejects missing interval field', async () => {
		const body = createValidCheckoutBody();
		const {interval: _, ...bodyWithoutInterval} = body;

		await createDonationCheckoutBuilder(harness).body(bodyWithoutInterval).expect(400).execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});

	test('rejects invalid currency', async () => {
		await createDonationCheckoutBuilder(harness)
			.body({
				...createValidCheckoutBody(),
				currency: 'gbp',
			})
			.expect(400)
			.execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});

	test('rejects invalid interval', async () => {
		await createDonationCheckoutBuilder(harness)
			.body({
				...createValidCheckoutBody(),
				interval: 'week',
			})
			.expect(400)
			.execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});

	test('rejects non-integer amount', async () => {
		await createDonationCheckoutBuilder(harness)
			.body({
				...createValidCheckoutBody(),
				amount_cents: 25.5,
			})
			.expect(400)
			.execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});

	test('rejects negative amount', async () => {
		await createDonationCheckoutBuilder(harness)
			.body({
				...createValidCheckoutBody(),
				amount_cents: -500,
			})
			.expect(400)
			.execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});

	test('rejects zero amount', async () => {
		await createDonationCheckoutBuilder(harness)
			.body({
				...createValidCheckoutBody(),
				amount_cents: 0,
			})
			.expect(400)
			.execute();

		expect(stripeHandlers.spies.createdCheckoutSessions).toHaveLength(0);
	});
});
