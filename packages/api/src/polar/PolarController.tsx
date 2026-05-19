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

import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {UrlResponse, WebhookReceivedResponse} from '@fluxer/schema/src/domains/premium/PremiumSchemas';
import {z} from 'zod';

// Request bodies — kept minimal. Reuse Stripe's schema once existing
// frontend code stops passing Stripe-style price_ids.
const CreateSubscriptionCheckoutBody = z.object({
	billing_cycle: z.enum(['monthly', 'yearly']),
	success_url: z.string().url().optional(),
});
const CreateGiftCheckoutBody = z.object({
	duration: z.enum(['1_month', '1_year']),
	success_url: z.string().url().optional(),
});

// Polar redirects here after the user pays. Must be an existing route;
// `/channels/@me` is the SPA entry point — the user lands in the app,
// and our webhook (fired in parallel) has already granted premium by
// the time they arrive.
const DEFAULT_SUCCESS_URL = 'https://fluxer.world/channels/@me';

export function PolarController(app: HonoApp): void {
	// Polar webhook. Uses standardwebhooks format; signature is verified
	// inside PolarWebhookService.
	app.post(
		'/polar/webhook',
		OpenAPI({
			operationId: 'process_polar_webhook',
			summary: 'Process Polar webhook',
			description:
				'Handles incoming Polar webhook events for subscription lifecycle and order payments.',
			responseSchema: WebhookReceivedResponse,
			statusCode: 200,
			security: [],
			tags: 'Billing',
		}),
		async (ctx) => {
			const rawBody = await ctx.req.text();
			await ctx.get('polarWebhookService').handleWebhook({
				rawBody,
				headers: {
					id: ctx.req.header('webhook-id') ?? '',
					timestamp: ctx.req.header('webhook-timestamp') ?? '',
					signature: ctx.req.header('webhook-signature') ?? '',
				},
			});
			return ctx.json({received: true});
		},
	);

	// Create a subscription checkout session (monthly/yearly).
	app.post(
		'/polar/checkout/subscription',
		RateLimitMiddleware(RateLimitConfigs.STRIPE_CHECKOUT_SUBSCRIPTION),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'create_polar_subscription_checkout',
			summary: 'Create Polar subscription checkout',
			description: 'Initiates a Polar checkout session for a premium subscription.',
			responseSchema: UrlResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Billing',
		}),
		Validator('json', CreateSubscriptionCheckoutBody),
		async (ctx) => {
			const {billing_cycle, success_url} = ctx.req.valid('json');
			const user = ctx.get('user');
			const session = await ctx.get('polarCheckoutService').createSubscriptionCheckout({
				userId: user.id.toString(),
				userEmail: user.email ?? '',
				billingCycle: billing_cycle,
				successUrl: success_url ?? DEFAULT_SUCCESS_URL,
			});
			return ctx.json({url: session.url});
		},
	);

	// Create a gift checkout session (one-time).
	app.post(
		'/polar/checkout/gift',
		RateLimitMiddleware(RateLimitConfigs.STRIPE_CHECKOUT_GIFT),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'create_polar_gift_checkout',
			summary: 'Create Polar gift checkout',
			description: 'Initiates a Polar checkout session for a one-time premium gift purchase.',
			responseSchema: UrlResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Billing',
		}),
		Validator('json', CreateGiftCheckoutBody),
		async (ctx) => {
			const {duration, success_url} = ctx.req.valid('json');
			const user = ctx.get('user');
			const session = await ctx.get('polarCheckoutService').createGiftCheckout({
				userId: user.id.toString(),
				userEmail: user.email ?? '',
				duration,
				successUrl: success_url ?? DEFAULT_SUCCESS_URL,
			});
			return ctx.json({url: session.url});
		},
	);
}
