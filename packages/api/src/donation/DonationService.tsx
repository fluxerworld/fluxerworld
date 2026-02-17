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

import type {IDonationService} from '@fluxer/api/src/donation/IDonationService';
import type {DonationCheckoutService} from '@fluxer/api/src/donation/services/DonationCheckoutService';
import type {DonationMagicLinkService} from '@fluxer/api/src/donation/services/DonationMagicLinkService';

export class DonationService implements IDonationService {
	constructor(
		private magicLinkService: DonationMagicLinkService,
		private checkoutService: DonationCheckoutService,
	) {}

	async requestMagicLink(email: string): Promise<void> {
		return this.magicLinkService.sendMagicLink(email);
	}

	async validateMagicLinkToken(token: string): Promise<{email: string; stripeCustomerId: string | null}> {
		return this.magicLinkService.validateToken(token);
	}

	async createDonationCheckout(params: {
		email: string;
		amountCents: number;
		currency: 'usd' | 'eur';
		interval: 'month' | 'year' | null;
	}): Promise<string> {
		return this.checkoutService.createCheckout(params);
	}

	async createDonorPortalSession(stripeCustomerId: string): Promise<string> {
		return this.checkoutService.createPortalSession(stripeCustomerId);
	}
}
