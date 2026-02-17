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

import type {ApiTestHarness} from '@fluxer/api/src/test/ApiTestHarness';
import {createBuilderWithoutAuth, type TestRequestBuilder} from '@fluxer/api/src/test/TestRequestBuilder';

export interface DonationTestEmailRecord {
	to: string;
	type: string;
	timestamp: string;
	metadata: Record<string, string>;
}

export async function listDonationTestEmails(
	harness: ApiTestHarness,
	params?: {recipient?: string},
): Promise<Array<DonationTestEmailRecord>> {
	const query = params?.recipient ? `?recipient=${encodeURIComponent(params.recipient)}` : '';
	const response = await createBuilderWithoutAuth<{emails: Array<DonationTestEmailRecord>}>(harness)
		.get(`/test/emails${query}`)
		.execute();
	return response.emails;
}

export async function clearDonationTestEmails(harness: ApiTestHarness): Promise<void> {
	await createBuilderWithoutAuth(harness).delete('/test/emails').expect(204).execute();
}

export const TEST_DONOR_EMAIL = 'donor@test.com';
export const TEST_DONOR_EMAIL_ALT = 'donor-alt@test.com';
export const TEST_MAGIC_LINK_TOKEN = 'a'.repeat(64);
export const TEST_INVALID_TOKEN = 'invalid-token-too-short';

export const DONATION_AMOUNTS = {
	MINIMUM: 500,
	BELOW_MINIMUM: 100,
	STANDARD: 2500,
	ABOVE_MAXIMUM: 200000,
	MAXIMUM: 100000,
} as const;

export const DONATION_CURRENCIES = {
	USD: 'usd',
	EUR: 'eur',
} as const;

export const DONATION_INTERVALS = {
	MONTH: 'month',
	YEAR: 'year',
} as const;

export interface DonationCheckoutRequestBody {
	email: string;
	amount_cents: number;
	currency: 'usd' | 'eur';
	interval: 'month' | 'year';
}

export interface DonationCheckoutResponse {
	url: string;
}

export interface DonationRequestLinkBody {
	email: string;
}

export function createDonationRequestLinkBuilder(harness: ApiTestHarness): TestRequestBuilder<void> {
	return createBuilderWithoutAuth<void>(harness).post('/donations/request-link');
}

export function createDonationCheckoutBuilder(harness: ApiTestHarness): TestRequestBuilder<DonationCheckoutResponse> {
	return createBuilderWithoutAuth<DonationCheckoutResponse>(harness).post('/donations/checkout');
}

export function createDonationManageBuilder(harness: ApiTestHarness, token: string): TestRequestBuilder<void> {
	return createBuilderWithoutAuth<void>(harness).get(`/donations/manage?token=${encodeURIComponent(token)}`);
}

export function createValidCheckoutBody(overrides?: Partial<DonationCheckoutRequestBody>): DonationCheckoutRequestBody {
	return {
		email: TEST_DONOR_EMAIL,
		amount_cents: DONATION_AMOUNTS.STANDARD,
		currency: DONATION_CURRENCIES.USD,
		interval: DONATION_INTERVALS.MONTH,
		...overrides,
	};
}

export function createUniqueEmail(prefix = 'donation'): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
}
