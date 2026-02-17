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

import {createStringType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const WebhookReceivedResponse = z.object({
	received: z.boolean().describe('Whether the webhook was successfully received'),
});
export type WebhookReceivedResponse = z.infer<typeof WebhookReceivedResponse>;

export const UrlResponse = z.object({
	url: z.string().describe('The URL to redirect to'),
});
export type UrlResponse = z.infer<typeof UrlResponse>;

export const PriceIdsResponse = z.object({
	monthly: z.string().nullish().describe('Stripe price ID for the monthly subscription'),
	yearly: z.string().nullish().describe('Stripe price ID for the yearly subscription'),
	gift_1_month: z.string().nullish().describe('Stripe price ID for the 1 month gift'),
	gift_1_year: z.string().nullish().describe('Stripe price ID for the 1 year gift'),
	currency: z.enum(['USD', 'EUR']).describe('Currency for the prices'),
});
export type PriceIdsResponse = z.infer<typeof PriceIdsResponse>;

export const PriceIdsQueryRequest = z.object({
	country_code: createStringType(2, 2).optional().describe('Two-letter country code for regional pricing'),
});
export type PriceIdsQueryRequest = z.infer<typeof PriceIdsQueryRequest>;
