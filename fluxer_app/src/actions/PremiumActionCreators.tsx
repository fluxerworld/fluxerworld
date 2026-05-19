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

import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import type {PriceIdsResponse} from '@fluxer/schema/src/domains/premium/PremiumSchemas';

const logger = new Logger('Premium');

export type PriceIds = PriceIdsResponse;

export async function fetchPriceIds(countryCode?: string): Promise<PriceIds> {
	try {
		const response = await http.get<PriceIds>({
			url: Endpoints.PREMIUM_PRICE_IDS,
			query: countryCode ? {country_code: countryCode} : undefined,
		});
		logger.debug('Price IDs fetched', response.body);
		return response.body;
	} catch (error) {
		logger.error('Price IDs fetch failed', error);
		throw error;
	}
}

export async function createCustomerPortalSession(): Promise<string> {
	try {
		const response = await http.post<{url: string}>(Endpoints.PREMIUM_CUSTOMER_PORTAL);
		logger.info('Customer portal session created');
		return response.body.url;
	} catch (error) {
		logger.error('Customer portal session creation failed', error);
		throw error;
	}
}

export type CheckoutPlan = 'monthly' | 'yearly' | 'gift_1_month' | 'gift_1_year';

export async function createCheckoutSession(plan: CheckoutPlan): Promise<string> {
	try {
		const isGift = plan === 'gift_1_month' || plan === 'gift_1_year';
		const url = isGift ? Endpoints.POLAR_CHECKOUT_GIFT : Endpoints.POLAR_CHECKOUT_SUBSCRIPTION;
		const body = isGift
			? {duration: plan === 'gift_1_month' ? '1_month' : '1_year'}
			: {billing_cycle: plan === 'monthly' ? 'monthly' : 'yearly'};
		const response = await http.post<{url: string}>(url, body);
		logger.info('Checkout session created', {plan});
		return response.body.url;
	} catch (error) {
		logger.error('Checkout session creation failed', error);
		throw error;
	}
}

export async function cancelSubscriptionAtPeriodEnd(): Promise<void> {
	try {
		await http.post({url: Endpoints.PREMIUM_CANCEL_SUBSCRIPTION});
		logger.info('Subscription set to cancel at period end');
	} catch (error) {
		logger.error('Failed to cancel subscription at period end', error);
		throw error;
	}
}

export async function reactivateSubscription(): Promise<void> {
	try {
		await http.post({url: Endpoints.PREMIUM_REACTIVATE_SUBSCRIPTION});
		logger.info('Subscription reactivated');
	} catch (error) {
		logger.error('Failed to reactivate subscription', error);
		throw error;
	}
}

export async function rejoinVisionaryGuild(): Promise<void> {
	try {
		await http.post({url: Endpoints.PREMIUM_VISIONARY_REJOIN});
		logger.info('Visionary guild rejoin requested');
	} catch (error) {
		logger.error('Failed to rejoin Visionary guild', error);
		throw error;
	}
}

export async function rejoinOperatorGuild(): Promise<void> {
	try {
		await http.post({url: Endpoints.PREMIUM_OPERATOR_REJOIN});
		logger.info('Operator guild rejoin requested');
	} catch (error) {
		logger.error('Failed to rejoin Operator guild', error);
		throw error;
	}
}
