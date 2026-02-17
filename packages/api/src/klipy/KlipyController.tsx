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
import {Logger} from '@fluxer/api/src/Logger';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp, HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {MissingAccessError} from '@fluxer/errors/src/domains/core/MissingAccessError';
import {
	KlipyFeaturedResponse,
	KlipyGifResponse,
	KlipyLocaleQuery,
	KlipyRegisterShareRequest,
	KlipySearchQuery,
} from '@fluxer/schema/src/domains/klipy/KlipySchemas';
import type {Context} from 'hono';
import {createMiddleware} from 'hono/factory';
import {z} from 'zod';

const klipyApiKeyRequiredMiddleware = createMiddleware<HonoEnv>(async (_ctx, next) => {
	if (!Config.klipy.apiKey) {
		Logger.debug('KLIPY API key is missing');
		throw new MissingAccessError();
	}
	await next();
});

function getCountry(ctx: Context<HonoEnv>): string {
	return ctx.req.header('CF-IPCountry') || 'US';
}

export function KlipyController(app: HonoApp) {
	app.get(
		'/klipy/search',
		RateLimitMiddleware(RateLimitConfigs.KLIPY_SEARCH),
		klipyApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'search_klipy_gifs',
			summary: 'Search KLIPY GIFs',
			responseSchema: z.array(KlipyGifResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['KLIPY'],
			description: 'Searches KLIPY for GIFs matching the given query string and locale.',
		}),
		Validator('query', KlipySearchQuery),
		async (ctx) => {
			const {q, locale} = ctx.req.valid('query');
			return ctx.json(await ctx.get('klipyService').search({q, locale, country: getCountry(ctx)}));
		},
	);

	app.get(
		'/klipy/featured',
		RateLimitMiddleware(RateLimitConfigs.KLIPY_FEATURED),
		klipyApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_klipy_featured',
			summary: 'Get featured KLIPY GIFs',
			responseSchema: KlipyFeaturedResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['KLIPY'],
			description: 'Retrieves currently featured GIFs from KLIPY based on user locale.',
		}),
		Validator('query', KlipyLocaleQuery),
		async (ctx) => {
			return ctx.json(
				await ctx.get('klipyService').getFeatured({locale: ctx.req.valid('query').locale, country: getCountry(ctx)}),
			);
		},
	);

	app.get(
		'/klipy/trending-gifs',
		RateLimitMiddleware(RateLimitConfigs.KLIPY_TRENDING),
		klipyApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_klipy_trending_gifs',
			summary: 'Get trending KLIPY GIFs',
			responseSchema: z.array(KlipyGifResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['KLIPY'],
			description: 'Retrieves trending GIFs from KLIPY based on user locale and popularity.',
		}),
		Validator('query', KlipyLocaleQuery),
		async (ctx) => {
			return ctx.json(
				await ctx.get('klipyService').getTrendingGifs({
					locale: ctx.req.valid('query').locale,
					country: getCountry(ctx),
				}),
			);
		},
	);

	app.post(
		'/klipy/register-share',
		RateLimitMiddleware(RateLimitConfigs.KLIPY_REGISTER_SHARE),
		klipyApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'register_klipy_gif_share',
			summary: 'Register KLIPY GIF share',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['KLIPY'],
			description: 'Registers a shared GIF with KLIPY to track usage and analytics.',
		}),
		Validator('json', KlipyRegisterShareRequest),
		async (ctx) => {
			const {id, q, locale} = ctx.req.valid('json');
			await ctx.get('klipyService').registerShare({id, q: q ?? '', locale, country: getCountry(ctx)});
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/klipy/suggest',
		RateLimitMiddleware(RateLimitConfigs.KLIPY_SUGGEST),
		klipyApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_klipy_search_suggestions',
			summary: 'Get KLIPY search suggestions',
			responseSchema: z.array(z.string()),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['KLIPY'],
			description: 'Returns search term suggestions from KLIPY based on the partial query provided.',
		}),
		Validator('query', KlipySearchQuery),
		async (ctx) => {
			const {q, locale} = ctx.req.valid('query');
			return ctx.json(await ctx.get('klipyService').suggest({q, locale}));
		},
	);
}
