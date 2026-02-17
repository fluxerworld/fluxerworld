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

type Nullish<T> = T | null;

export interface DonorRow {
	email: string;
	stripe_customer_id: Nullish<string>;
	business_name: Nullish<string>;
	tax_id: Nullish<string>;
	tax_id_type: Nullish<string>;
	stripe_subscription_id: Nullish<string>;
	subscription_amount_cents: Nullish<number>;
	subscription_currency: Nullish<string>;
	subscription_interval: Nullish<string>;
	subscription_current_period_end: Nullish<Date>;
	subscription_cancel_at: Nullish<Date>;
	created_at: Date;
	updated_at: Date;
	version: number;
}

export interface DonorByStripeCustomerIdRow {
	stripe_customer_id: string;
	email: string;
}

export interface DonorByStripeSubscriptionIdRow {
	stripe_subscription_id: string;
	email: string;
}

export interface DonorMagicLinkTokenRow {
	token_: string;
	donor_email: string;
	expires_at: Date;
	used_at: Nullish<Date>;
}

export interface DonorMagicLinkTokenByEmailRow {
	donor_email: string;
	token_: string;
}

export const DONOR_COLUMNS = [
	'email',
	'stripe_customer_id',
	'business_name',
	'tax_id',
	'tax_id_type',
	'stripe_subscription_id',
	'subscription_amount_cents',
	'subscription_currency',
	'subscription_interval',
	'subscription_current_period_end',
	'subscription_cancel_at',
	'created_at',
	'updated_at',
	'version',
] as const satisfies ReadonlyArray<keyof DonorRow>;

export const DONOR_BY_STRIPE_CUSTOMER_ID_COLUMNS = ['stripe_customer_id', 'email'] as const satisfies ReadonlyArray<
	keyof DonorByStripeCustomerIdRow
>;

export const DONOR_BY_STRIPE_SUBSCRIPTION_ID_COLUMNS = [
	'stripe_subscription_id',
	'email',
] as const satisfies ReadonlyArray<keyof DonorByStripeSubscriptionIdRow>;

export const DONOR_MAGIC_LINK_TOKEN_COLUMNS = [
	'token_',
	'donor_email',
	'expires_at',
	'used_at',
] as const satisfies ReadonlyArray<keyof DonorMagicLinkTokenRow>;

export const DONOR_MAGIC_LINK_TOKEN_BY_EMAIL_COLUMNS = ['donor_email', 'token_'] as const satisfies ReadonlyArray<
	keyof DonorMagicLinkTokenByEmailRow
>;
