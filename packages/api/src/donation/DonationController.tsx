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
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {DonationRateLimitConfigs} from '@fluxer/api/src/rate_limit_configs/DonationRateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {
	DonationCheckoutRequest,
	DonationCheckoutResponse,
	DonationManageQuery,
	DonationRequestLinkRequest,
} from '@fluxer/schema/src/domains/donation/DonationSchemas';

export function DonationController(app: HonoApp) {
	app.post(
		'/donations/request-link',
		RateLimitMiddleware(DonationRateLimitConfigs.DONATION_REQUEST_LINK),
		OpenAPI({
			operationId: 'request_donation_magic_link',
			summary: 'Request donation management link',
			description: 'Sends a magic link email to the provided address for managing recurring donations.',
			responseSchema: null,
			statusCode: 204,
			security: [],
			tags: 'Donations',
		}),
		Validator('json', DonationRequestLinkRequest),
		async (ctx) => {
			const {email} = ctx.req.valid('json');
			await ctx.get('donationService').requestMagicLink(email);
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/donations/manage',
		RateLimitMiddleware(DonationRateLimitConfigs.DONATION_MANAGE),
		OpenAPI({
			operationId: 'manage_donation',
			summary: 'Manage donation subscription',
			description: 'Validates the magic link token and redirects to Stripe billing portal.',
			responseSchema: null,
			statusCode: 302,
			security: [],
			tags: 'Donations',
		}),
		Validator('query', DonationManageQuery),
		async (ctx) => {
			const {token} = ctx.req.valid('query');
			const {stripeCustomerId} = await ctx.get('donationService').validateMagicLinkToken(token);

			if (!stripeCustomerId) {
				return ctx.redirect(`${Config.endpoints.marketing}/donate`);
			}

			const portalUrl = await ctx.get('donationService').createDonorPortalSession(stripeCustomerId);
			return ctx.redirect(portalUrl);
		},
	);

	app.post(
		'/donations/checkout',
		RateLimitMiddleware(DonationRateLimitConfigs.DONATION_CHECKOUT),
		OpenAPI({
			operationId: 'create_donation_checkout',
			summary: 'Create donation checkout session',
			description: 'Creates a Stripe checkout session for a recurring donation.',
			responseSchema: DonationCheckoutResponse,
			statusCode: 200,
			security: [],
			tags: 'Donations',
		}),
		Validator('json', DonationCheckoutRequest),
		async (ctx) => {
			const body = ctx.req.valid('json');
			const url = await ctx.get('donationService').createDonationCheckout({
				email: body.email,
				amountCents: body.amount_cents,
				currency: body.currency,
				interval: body.interval,
			});
			return ctx.json({url});
		},
	);
}
