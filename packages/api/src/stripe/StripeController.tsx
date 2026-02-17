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
import {mapGiftCodeToMetadataResponse, mapGiftCodeToResponse} from '@fluxer/api/src/stripe/StripeModel';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {StripeWebhookSignatureMissingError} from '@fluxer/errors/src/domains/payment/StripeWebhookSignatureMissingError';
import {GiftCodeParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	CreateCheckoutSessionRequest,
	GiftCodeMetadataResponse,
	GiftCodeResponse,
} from '@fluxer/schema/src/domains/premium/GiftCodeSchemas';
import {
	PriceIdsQueryRequest,
	PriceIdsResponse,
	UrlResponse,
	WebhookReceivedResponse,
} from '@fluxer/schema/src/domains/premium/PremiumSchemas';
import {z} from 'zod';

export function StripeController(app: HonoApp) {
	app.post(
		'/stripe/webhook',
		OpenAPI({
			operationId: 'process_stripe_webhook',
			summary: 'Process Stripe webhook',
			description: 'Handles incoming Stripe webhook events for payment processing and subscription management.',
			responseSchema: WebhookReceivedResponse,
			statusCode: 200,
			security: [],
			tags: 'Billing',
		}),
		async (ctx) => {
			const signature = ctx.req.header('stripe-signature');
			if (!signature) {
				throw new StripeWebhookSignatureMissingError();
			}
			const body = await ctx.req.text();
			await ctx.get('stripeService').handleWebhook({body, signature});
			return ctx.json({received: true});
		},
	);

	app.post(
		'/stripe/checkout/subscription',
		RateLimitMiddleware(RateLimitConfigs.STRIPE_CHECKOUT_SUBSCRIPTION),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'create_checkout_session',
			summary: 'Create checkout session',
			description: 'Initiates a Stripe checkout session for user subscription purchases.',
			responseSchema: UrlResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Billing',
		}),
		Validator('json', CreateCheckoutSessionRequest),
		async (ctx) => {
			const {price_id} = ctx.req.valid('json');
			const userId = ctx.get('user').id;
			const checkoutUrl = await ctx.get('stripeService').createCheckoutSession({
				userId,
				priceId: price_id,
				isGift: false,
			});
			return ctx.json({url: checkoutUrl});
		},
	);

	app.post(
		'/stripe/checkout/gift',
		RateLimitMiddleware(RateLimitConfigs.STRIPE_CHECKOUT_GIFT),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'create_gift_checkout_session',
			summary: 'Create gift checkout session',
			description: 'Creates a checkout session for purchasing premium gifts to send to other users.',
			responseSchema: UrlResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Billing',
		}),
		Validator('json', CreateCheckoutSessionRequest),
		async (ctx) => {
			const {price_id} = ctx.req.valid('json');
			const userId = ctx.get('user').id;
			const checkoutUrl = await ctx.get('stripeService').createCheckoutSession({
				userId,
				priceId: price_id,
				isGift: true,
			});
			return ctx.json({url: checkoutUrl});
		},
	);

	app.get(
		'/gifts/:code',
		RateLimitMiddleware(RateLimitConfigs.GIFT_CODE_GET),
		OpenAPI({
			operationId: 'get_gift_code',
			summary: 'Get gift code',
			description: 'Retrieves information about a gift code, including sender details and premium entitlements.',
			responseSchema: GiftCodeResponse,
			statusCode: 200,
			security: [],
			tags: 'Gifts',
		}),
		Validator('param', GiftCodeParam),
		async (ctx) => {
			const {code} = ctx.req.valid('param');
			const giftCode = await ctx.get('stripeService').getGiftCode(code);
			const response = await mapGiftCodeToResponse({
				giftCode,
				userCacheService: ctx.get('userCacheService'),
				requestCache: ctx.get('requestCache'),
				includeCreator: true,
			});
			return ctx.json(response);
		},
	);

	app.post(
		'/gifts/:code/redeem',
		RateLimitMiddleware(RateLimitConfigs.GIFT_CODE_REDEEM),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'redeem_gift_code',
			summary: 'Redeem gift code',
			description: 'Redeems a gift code for the authenticated user, applying premium benefits.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Gifts',
		}),
		Validator('param', GiftCodeParam),
		async (ctx) => {
			const {code} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			await ctx.get('stripeService').redeemGiftCode(userId, code);
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/users/@me/gifts',
		RateLimitMiddleware(RateLimitConfigs.GIFTS_LIST),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_user_gifts',
			summary: 'List user gifts',
			description: 'Lists all gift codes created by the authenticated user.',
			responseSchema: z.array(GiftCodeMetadataResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Users',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const gifts = await ctx.get('stripeService').getUserGifts(userId);
			const responses = await Promise.all(
				gifts.map((gift) =>
					mapGiftCodeToMetadataResponse({
						giftCode: gift,
						userCacheService: ctx.get('userCacheService'),
						requestCache: ctx.get('requestCache'),
					}),
				),
			);
			return ctx.json(responses);
		},
	);

	app.get(
		'/premium/price-ids',
		RateLimitMiddleware(RateLimitConfigs.STRIPE_PRICE_IDS),
		Validator('query', PriceIdsQueryRequest),
		OpenAPI({
			operationId: 'get_price_ids',
			summary: 'Get Stripe price IDs',
			description: 'Retrieves Stripe price IDs for premium subscriptions based on geographic location.',
			responseSchema: PriceIdsResponse,
			statusCode: 200,
			security: [],
			tags: 'Premium',
		}),
		async (ctx) => {
			const priceIds = await ctx.get('stripeService').getPriceIds(ctx.req.valid('query').country_code);
			return ctx.json(priceIds);
		},
	);

	app.post(
		'/premium/customer-portal',
		RateLimitMiddleware(RateLimitConfigs.STRIPE_CUSTOMER_PORTAL),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'create_customer_portal',
			summary: 'Create customer portal',
			description:
				'Creates a session URL for the authenticated user to manage their Stripe subscription via the customer portal.',
			responseSchema: UrlResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Premium',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const url = await ctx.get('stripeService').createCustomerPortalSession(userId);
			return ctx.json({url});
		},
	);

	app.post(
		'/premium/cancel-subscription',
		RateLimitMiddleware(RateLimitConfigs.STRIPE_SUBSCRIPTION_CANCEL),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'cancel_subscription',
			summary: 'Cancel subscription',
			description: "Cancels the authenticated user's premium subscription at the end of the current billing period.",
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Premium',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			await ctx.get('stripeService').cancelSubscriptionAtPeriodEnd(userId);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/premium/reactivate-subscription',
		RateLimitMiddleware(RateLimitConfigs.STRIPE_SUBSCRIPTION_REACTIVATE),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'reactivate_subscription',
			summary: 'Reactivate subscription',
			description: 'Reactivates a previously cancelled premium subscription for the authenticated user.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Premium',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			await ctx.get('stripeService').reactivateSubscription(userId);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/premium/visionary/rejoin',
		RateLimitMiddleware(RateLimitConfigs.STRIPE_VISIONARY_REJOIN),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'rejoin_visionary_guild',
			summary: 'Rejoin visionary guild',
			description: 'Adds the authenticated user back to the visionary community guild after premium re-subscription.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Premium',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			await ctx.get('stripeService').rejoinVisionariesGuild(userId);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/premium/operator/rejoin',
		RateLimitMiddleware(RateLimitConfigs.STRIPE_VISIONARY_REJOIN),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'rejoin_operator_guild',
			summary: 'Rejoin operator guild',
			description: 'Adds the authenticated user back to the operator community guild after premium re-subscription.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: 'Premium',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			await ctx.get('stripeService').rejoinOperatorsGuild(userId);
			return ctx.body(null, 204);
		},
	);
}
