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

import {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {createStringType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const CreateCheckoutSessionRequest = z.object({
	price_id: createStringType().describe('The Stripe price ID for the subscription plan'),
});

export type CreateCheckoutSessionRequest = z.infer<typeof CreateCheckoutSessionRequest>;

export const GiftCodeResponse = z.object({
	code: z.string().describe('The unique gift code string'),
	duration_months: z.number().int().describe('Duration of the subscription gift in months'),
	redeemed: z.boolean().describe('Whether the gift code has been redeemed'),
	created_by: z
		.lazy(() => UserPartialResponse)
		.nullish()
		.describe('The user who created the gift code'),
});

export type GiftCodeResponse = z.infer<typeof GiftCodeResponse>;

export const GiftCodeMetadataResponse = z.object({
	code: z.string().describe('The unique gift code string'),
	duration_months: z.number().int().describe('Duration of the subscription gift in months'),
	created_at: z.iso.datetime().describe('Timestamp when the gift code was created'),
	created_by: z.lazy(() => UserPartialResponse).describe('The user who created the gift code'),
	redeemed_at: z.iso.datetime().nullish().describe('Timestamp when the gift code was redeemed'),
	redeemed_by: z
		.lazy(() => UserPartialResponse)
		.nullish()
		.describe('The user who redeemed the gift code'),
});

export type GiftCodeMetadataResponse = z.infer<typeof GiftCodeMetadataResponse>;
