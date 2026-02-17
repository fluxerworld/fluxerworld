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

import {createChannelID, createMemeID, createMessageID} from '@fluxer/api/src/BrandedTypes';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {ChannelIdMessageIdParam, MemeIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	CreateFavoriteMemeBodySchema,
	CreateFavoriteMemeFromUrlBodySchema,
	FavoriteMemeListResponse,
	FavoriteMemeResponse,
	UpdateFavoriteMemeBodySchema,
} from '@fluxer/schema/src/domains/meme/MemeSchemas';

export function FavoriteMemeController(app: HonoApp) {
	app.get(
		'/users/@me/memes',
		RateLimitMiddleware(RateLimitConfigs.FAVORITE_MEME_LIST),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_favorite_memes',
			summary: 'List favorite memes',
			responseSchema: FavoriteMemeListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Saved Media'],
			description: 'Retrieves all memes saved as favorites by the authenticated user.',
		}),
		async (ctx) => {
			const memes = await ctx.get('favoriteMemeRequestService').listFavoriteMemes({
				userId: ctx.get('user').id,
			});
			return ctx.json(memes);
		},
	);

	app.post(
		'/users/@me/memes',
		RateLimitMiddleware(RateLimitConfigs.FAVORITE_MEME_CREATE_FROM_URL),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', CreateFavoriteMemeFromUrlBodySchema),
		OpenAPI({
			operationId: 'create_meme_from_url',
			summary: 'Create meme from URL',
			responseSchema: FavoriteMemeResponse,
			statusCode: 201,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Saved Media'],
			description: 'Saves a new meme to favorites from a provided URL.',
		}),
		async (ctx) => {
			const meme = await ctx.get('favoriteMemeRequestService').createFromUrl({
				user: ctx.get('user'),
				data: ctx.req.valid('json'),
			});
			return ctx.json(meme, 201);
		},
	);

	app.post(
		'/channels/:channel_id/messages/:message_id/memes',
		RateLimitMiddleware(RateLimitConfigs.FAVORITE_MEME_CREATE_FROM_MESSAGE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChannelIdMessageIdParam),
		Validator('json', CreateFavoriteMemeBodySchema),
		OpenAPI({
			operationId: 'create_meme_from_message',
			summary: 'Create meme from message',
			responseSchema: FavoriteMemeResponse,
			statusCode: 201,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Saved Media'],
			description: 'Saves a message attachment as a favorite meme.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const channelId = createChannelID(ctx.req.valid('param').channel_id);
			const messageId = createMessageID(ctx.req.valid('param').message_id);
			const meme = await ctx.get('favoriteMemeRequestService').createFromMessage({
				user,
				channelId,
				messageId,
				data: ctx.req.valid('json'),
			});
			return ctx.json(meme, 201);
		},
	);

	app.get(
		'/users/@me/memes/:meme_id',
		RateLimitMiddleware(RateLimitConfigs.FAVORITE_MEME_GET),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', MemeIdParam),
		OpenAPI({
			operationId: 'get_favorite_meme',
			summary: 'Get favorite meme',
			responseSchema: FavoriteMemeResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Saved Media'],
			description: 'Retrieves a specific favorite meme by ID.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const memeId = createMemeID(ctx.req.valid('param').meme_id);
			const meme = await ctx.get('favoriteMemeRequestService').getFavoriteMeme({
				userId: user.id,
				memeId,
			});
			return ctx.json(meme);
		},
	);

	app.patch(
		'/users/@me/memes/:meme_id',
		RateLimitMiddleware(RateLimitConfigs.FAVORITE_MEME_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', MemeIdParam),
		Validator('json', UpdateFavoriteMemeBodySchema),
		OpenAPI({
			operationId: 'update_favorite_meme',
			summary: 'Update favorite meme',
			responseSchema: FavoriteMemeResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Saved Media'],
			description: 'Updates details of a favorite meme.',
		}),
		async (ctx) => {
			const meme = await ctx.get('favoriteMemeRequestService').updateFavoriteMeme({
				user: ctx.get('user'),
				memeId: createMemeID(ctx.req.valid('param').meme_id),
				data: ctx.req.valid('json'),
			});
			return ctx.json(meme);
		},
	);

	app.delete(
		'/users/@me/memes/:meme_id',
		RateLimitMiddleware(RateLimitConfigs.FAVORITE_MEME_DELETE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', MemeIdParam),
		OpenAPI({
			operationId: 'delete_favorite_meme',
			summary: 'Delete favorite meme',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Saved Media'],
			description: "Removes a favorite meme from the authenticated user's collection.",
		}),
		async (ctx) => {
			await ctx.get('favoriteMemeRequestService').deleteFavoriteMeme({
				userId: ctx.get('user').id,
				memeId: createMemeID(ctx.req.valid('param').meme_id),
			});
			return ctx.body(null, 204);
		},
	);
}
