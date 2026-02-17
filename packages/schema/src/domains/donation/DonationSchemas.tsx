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

import {z} from 'zod';

export const DonationRequestLinkRequest = z.object({
	email: z.email().max(254).describe('Email address to send the magic link to'),
});
export type DonationRequestLinkRequest = z.infer<typeof DonationRequestLinkRequest>;

export const DonationManageQuery = z.object({
	token: z.string().length(64).describe('Magic link token for donor authentication'),
});
export type DonationManageQuery = z.infer<typeof DonationManageQuery>;

export const DonationCheckoutRequest = z.object({
	email: z.email().max(254).describe('Donor email address'),
	amount_cents: z.number().int().min(500).max(100000).describe('Donation amount in cents (500-100000)'),
	currency: z.enum(['usd', 'eur']).describe('Currency for the donation'),
	interval: z.enum(['month', 'year']).nullable().describe('Billing interval (null for one-time donation)'),
});
export type DonationCheckoutRequest = z.infer<typeof DonationCheckoutRequest>;

export const DonationCheckoutResponse = z.object({
	url: z.url().describe('Stripe checkout URL to redirect the user to'),
});
export type DonationCheckoutResponse = z.infer<typeof DonationCheckoutResponse>;
