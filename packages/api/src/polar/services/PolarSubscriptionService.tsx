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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {PolarService} from '@fluxer/api/src/polar/PolarService';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';

interface PolarCustomerSession {
	token: string;
	customer_portal_url: string;
	expires_at: string;
}

/**
 * Manages the lifecycle of existing subscriptions for premium users.
 * Mirrors StripeSubscriptionService.
 *
 * Polar API:
 *  - PATCH /v1/subscriptions/{id} { cancel_at_period_end: true } → schedule cancel
 *  - PATCH /v1/subscriptions/{id} { cancel_at_period_end: false } → reactivate
 *  - POST /v1/customer-sessions/ { customer_id } → returns portal URL/token
 */
export class PolarSubscriptionService {
	constructor(
		private readonly polar: PolarService,
		private readonly userRepository: IUserRepository,
	) {}

	/**
	 * Schedule the user's active subscription to cancel at the end of the
	 * current billing period. Reads the provider subscription id from
	 * user.stripeSubscriptionId (reused as the provider-neutral "current
	 * payment subscription id" field during migration).
	 */
	async cancelForUser(userId: UserID): Promise<void> {
		const subscriptionId = await this.resolveSubscriptionId(userId);
		if (!subscriptionId) throw new Error('No active subscription for user');
		await this.polar.request('PATCH', `/subscriptions/${subscriptionId}`, {
			cancel_at_period_end: true,
		});
	}

	async reactivateForUser(userId: UserID): Promise<void> {
		const subscriptionId = await this.resolveSubscriptionId(userId);
		if (!subscriptionId) throw new Error('No subscription to reactivate');
		await this.polar.request('PATCH', `/subscriptions/${subscriptionId}`, {
			cancel_at_period_end: false,
		});
	}

	/**
	 * Return a hosted customer-portal URL. Polar accepts either a
	 * customer_id or customer_external_id; we use external_id since the
	 * Fluxer user id is what we set at checkout time. If the user has
	 * never purchased through Polar, the API returns 422 "Customer does
	 * not exist" — translate that to null so the controller can return
	 * a cleaner 404.
	 */
	async getCustomerPortalUrlForUser(userId: UserID): Promise<string | null> {
		try {
			const res = await this.polar.request<PolarCustomerSession>('POST', '/customer-sessions/', {
				customer_external_id: userId.toString(),
			});
			return res.customer_portal_url;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			if (msg.includes('Customer does not exist')) return null;
			throw err;
		}
	}

	private async resolveSubscriptionId(userId: UserID): Promise<string | null> {
		const user = await this.userRepository.findUnique(userId);
		return user?.stripeSubscriptionId ?? null;
	}
}
