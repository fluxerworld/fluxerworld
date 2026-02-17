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

import type {Donor} from '@fluxer/api/src/donation/models/Donor';
import type {DonorMagicLinkToken} from '@fluxer/api/src/donation/models/DonorMagicLinkToken';

export abstract class IDonationRepository {
	abstract findDonorByEmail(email: string): Promise<Donor | null>;

	abstract findDonorByStripeCustomerId(customerId: string): Promise<Donor | null>;

	abstract findDonorByStripeSubscriptionId(subscriptionId: string): Promise<Donor | null>;

	abstract upsertDonor(donor: Donor): Promise<void>;

	abstract createDonor(data: {
		email: string;
		stripeCustomerId: string | null;
		businessName?: string | null;
		taxId?: string | null;
		taxIdType?: string | null;
		stripeSubscriptionId: string | null;
		subscriptionAmountCents: number | null;
		subscriptionCurrency: string | null;
		subscriptionInterval: string | null;
		subscriptionCurrentPeriodEnd: Date | null;
		subscriptionCancelAt?: Date | null;
	}): Promise<Donor>;

	abstract updateDonorSubscription(
		email: string,
		data: {
			stripeCustomerId: string | null;
			businessName?: string | null;
			taxId?: string | null;
			taxIdType?: string | null;
			stripeSubscriptionId: string | null;
			subscriptionAmountCents: number | null;
			subscriptionCurrency: string | null;
			subscriptionInterval: string | null;
			subscriptionCurrentPeriodEnd: Date | null;
			subscriptionCancelAt?: Date | null;
		},
	): Promise<{applied: boolean; donor: Donor | null}>;

	abstract cancelDonorSubscription(email: string): Promise<{applied: boolean}>;

	abstract createMagicLinkToken(token: DonorMagicLinkToken): Promise<void>;

	abstract findMagicLinkToken(token: string): Promise<DonorMagicLinkToken | null>;

	abstract markMagicLinkTokenUsed(token: string, usedAt: Date): Promise<void>;

	abstract invalidateTokensForEmail(email: string): Promise<void>;
}
