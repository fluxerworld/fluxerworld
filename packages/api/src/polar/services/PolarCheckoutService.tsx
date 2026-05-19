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

import {Config} from '@fluxer/api/src/Config';
import type {PolarService} from '@fluxer/api/src/polar/PolarService';

interface PolarCheckoutResponse {
	id: string;
	url: string;
	[k: string]: unknown;
}

/**
 * Creates Polar checkout sessions. Mirrors StripeCheckoutService — one
 * method per flow so the controller-side code path is a 1:1 rename.
 *
 * Polar API: POST /v1/checkouts/ with { products: [product_id], customer_external_id, success_url }.
 * Returns { id, url } where url is the hosted checkout page.
 */
export class PolarCheckoutService {
	constructor(private readonly polar: PolarService) {}

	async createSubscriptionCheckout(params: {
		userId: string;
		userEmail: string;
		billingCycle: 'monthly' | 'yearly';
		successUrl: string;
	}): Promise<{id: string; url: string}> {
		const products = Config.polar.products;
		const productId =
			params.billingCycle === 'monthly'
				? products.monthlySubscription
				: products.yearlySubscription;
		const res = await this.polar.request<PolarCheckoutResponse>('POST', '/checkouts/', {
			products: [productId],
			customer_external_id: params.userId,
			customer_email: params.userEmail,
			success_url: params.successUrl,
			// metadata lets us correlate on webhook
			metadata: {
				fluxer_user_id: params.userId,
				kind: 'subscription',
				billing_cycle: params.billingCycle,
			},
		});
		return {id: res.id, url: res.url};
	}

	async createGiftCheckout(params: {
		userId: string;
		userEmail: string;
		duration: '1_month' | '1_year';
		successUrl: string;
	}): Promise<{id: string; url: string}> {
		const products = Config.polar.products;
		const productId =
			params.duration === '1_month' ? products.gift1Month : products.gift1Year;
		const res = await this.polar.request<PolarCheckoutResponse>('POST', '/checkouts/', {
			products: [productId],
			customer_external_id: params.userId,
			customer_email: params.userEmail,
			success_url: params.successUrl,
			metadata: {
				fluxer_user_id: params.userId,
				kind: 'gift',
				duration: params.duration,
			},
		});
		return {id: res.id, url: res.url};
	}
}
