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
	TenorFeaturedResponse,
	TenorGifResponse,
	TenorLocaleQuery,
	TenorRegisterShareRequest,
	TenorSearchQuery,
} from '@fluxer/schema/src/domains/tenor/TenorSchemas';
import type {Context} from 'hono';
import {createMiddleware} from 'hono/factory';
import {z} from 'zod';

const tenorApiKeyRequiredMiddleware = createMiddleware<HonoEnv>(async (_ctx, next) => {
	if (!Config.tenor.apiKey) {
		Logger.debug('Tenor API key is missing');
		throw new MissingAccessError();
	}
	await next();
});

function getCountry(ctx: Context<HonoEnv>): string {
	return ctx.req.header('CF-IPCountry') || 'US';
}

export function TenorController(app: HonoApp) {
	app.get(
		'/tenor/search',
		RateLimitMiddleware(RateLimitConfigs.TENOR_SEARCH),
		tenorApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'search_tenor_gifs',
			summary: 'Search Tenor GIFs',
			responseSchema: z.array(TenorGifResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Tenor'],
			description: 'Searches Tenor for GIFs matching the given query string and locale.',
		}),
		Validator('query', TenorSearchQuery),
		async (ctx) => {
			const {q, locale} = ctx.req.valid('query');
			return ctx.json(await ctx.get('tenorService').search({q, locale, country: getCountry(ctx)}));
		},
	);

	app.get(
		'/tenor/featured',
		RateLimitMiddleware(RateLimitConfigs.TENOR_FEATURED),
		tenorApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_tenor_featured',
			summary: 'Get featured Tenor GIFs',
			responseSchema: TenorFeaturedResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Tenor'],
			description: 'Retrieves currently featured GIFs from Tenor based on user locale.',
		}),
		Validator('query', TenorLocaleQuery),
		async (ctx) => {
			return ctx.json(
				await ctx.get('tenorService').getFeatured({locale: ctx.req.valid('query').locale, country: getCountry(ctx)}),
			);
		},
	);

	app.get(
		'/tenor/trending-gifs',
		RateLimitMiddleware(RateLimitConfigs.TENOR_TRENDING),
		tenorApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_tenor_trending_gifs',
			summary: 'Get trending Tenor GIFs',
			responseSchema: z.array(TenorGifResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Tenor'],
			description: 'Retrieves trending/featured GIFs from Tenor based on user locale and popularity.',
		}),
		Validator('query', TenorLocaleQuery),
		async (ctx) => {
			return ctx.json(
				await ctx.get('tenorService').getTrendingGifs({
					locale: ctx.req.valid('query').locale,
					country: getCountry(ctx),
				}),
			);
		},
	);

	app.post(
		'/tenor/register-share',
		RateLimitMiddleware(RateLimitConfigs.TENOR_REGISTER_SHARE),
		tenorApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'register_tenor_gif_share',
			summary: 'Register Tenor GIF share',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Tenor'],
			description: 'Registers a shared GIF with Tenor to help tune search results.',
		}),
		Validator('json', TenorRegisterShareRequest),
		async (ctx) => {
			const {id, q, locale} = ctx.req.valid('json');
			await ctx.get('tenorService').registerShare({id, q: q ?? '', locale, country: getCountry(ctx)});
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/tenor/suggest',
		RateLimitMiddleware(RateLimitConfigs.TENOR_SUGGEST),
		tenorApiKeyRequiredMiddleware,
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_tenor_search_suggestions',
			summary: 'Get Tenor search suggestions',
			responseSchema: z.array(z.string()),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Tenor'],
			description: 'Returns search term suggestions from Tenor based on the partial query provided.',
		}),
		Validator('query', TenorSearchQuery),
		async (ctx) => {
			const {q, locale} = ctx.req.valid('query');
			return ctx.json(await ctx.get('tenorService').suggest({q, locale}));
		},
	);
}
