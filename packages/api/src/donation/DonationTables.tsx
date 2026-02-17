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

import {defineTable} from '@fluxer/api/src/database/Cassandra';
import {
	DONOR_BY_STRIPE_CUSTOMER_ID_COLUMNS,
	DONOR_BY_STRIPE_SUBSCRIPTION_ID_COLUMNS,
	DONOR_COLUMNS,
	DONOR_MAGIC_LINK_TOKEN_BY_EMAIL_COLUMNS,
	DONOR_MAGIC_LINK_TOKEN_COLUMNS,
	type DonorByStripeCustomerIdRow,
	type DonorByStripeSubscriptionIdRow,
	type DonorMagicLinkTokenByEmailRow,
	type DonorMagicLinkTokenRow,
	type DonorRow,
} from '@fluxer/api/src/database/types/DonationTypes';

export const Donors = defineTable<DonorRow, 'email'>({
	name: 'donors',
	columns: DONOR_COLUMNS,
	primaryKey: ['email'],
});

export const DonorsByStripeCustomerId = defineTable<
	DonorByStripeCustomerIdRow,
	'stripe_customer_id' | 'email',
	'stripe_customer_id'
>({
	name: 'donors_by_stripe_customer_id',
	columns: DONOR_BY_STRIPE_CUSTOMER_ID_COLUMNS,
	primaryKey: ['stripe_customer_id', 'email'],
	partitionKey: ['stripe_customer_id'],
});

export const DonorsByStripeSubscriptionId = defineTable<
	DonorByStripeSubscriptionIdRow,
	'stripe_subscription_id' | 'email',
	'stripe_subscription_id'
>({
	name: 'donors_by_stripe_subscription_id',
	columns: DONOR_BY_STRIPE_SUBSCRIPTION_ID_COLUMNS,
	primaryKey: ['stripe_subscription_id', 'email'],
	partitionKey: ['stripe_subscription_id'],
});

export const DonorMagicLinkTokens = defineTable<DonorMagicLinkTokenRow, 'token_'>({
	name: 'donor_magic_link_tokens',
	columns: DONOR_MAGIC_LINK_TOKEN_COLUMNS,
	primaryKey: ['token_'],
});

export const DonorMagicLinkTokensByEmail = defineTable<DonorMagicLinkTokenByEmailRow, 'donor_email' | 'token_'>({
	name: 'donor_magic_link_tokens_by_email',
	columns: DONOR_MAGIC_LINK_TOKEN_BY_EMAIL_COLUMNS,
	primaryKey: ['donor_email', 'token_'],
});
