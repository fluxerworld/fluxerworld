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

import type Stripe from 'stripe';

export function getPrimarySubscriptionItem(subscription: Stripe.Subscription): Stripe.SubscriptionItem | null {
	const items = subscription.items?.data ?? [];
	if (items.length === 0) {
		return null;
	}

	const recurringItem = items.find((item) => Boolean(item.price?.recurring));
	return recurringItem ?? items[0];
}

export function getSubscriptionItemPeriodEndUnix(item: Stripe.SubscriptionItem | null): number | null {
	return item?.current_period_end ?? null;
}

export function getSubscriptionItemPeriodEnd(item: Stripe.SubscriptionItem | null): Date | null {
	const periodEnd = getSubscriptionItemPeriodEndUnix(item);
	return periodEnd == null ? null : new Date(periodEnd * 1000);
}

export function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription): Date | null {
	const items = subscription.items?.data ?? [];
	if (items.length === 0) {
		return null;
	}

	let latestPeriodEnd: number | null = null;
	for (const item of items) {
		if (item.current_period_end == null) {
			continue;
		}
		if (latestPeriodEnd == null || item.current_period_end > latestPeriodEnd) {
			latestPeriodEnd = item.current_period_end;
		}
	}

	return latestPeriodEnd == null ? null : new Date(latestPeriodEnd * 1000);
}
