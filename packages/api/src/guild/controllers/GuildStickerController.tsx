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

import {createGuildID, createStickerID} from '@fluxer/api/src/BrandedTypes';
import {LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {GuildIdParam, GuildIdStickerIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {PurgeQuery} from '@fluxer/schema/src/domains/common/CommonQuerySchemas';
import {
	GuildStickerBulkCreateResponse,
	GuildStickerResponse,
	GuildStickerWithUserListResponse,
} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import {
	GuildStickerBulkCreateRequest,
	GuildStickerCreateRequest,
	GuildStickerUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildRequestSchemas';

export function GuildStickerController(app: HonoApp) {
	app.post(
		'/guilds/:guild_id/stickers',
		RateLimitMiddleware(RateLimitConfigs.GUILD_STICKER_CREATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', GuildStickerCreateRequest),
		OpenAPI({
			operationId: 'create_guild_sticker',
			summary: 'Create guild sticker',
			responseSchema: GuildStickerResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Create guild sticker. Requires manage_emojis permission. Uploads a new sticker with name, description, and tags.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const {name, description, tags, image} = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			const sticker = await ctx
				.get('guildService')
				.createSticker({user, guildId, name, description, tags, image}, auditLogReason);
			return ctx.json(sticker);
		},
	);

	app.post(
		'/guilds/:guild_id/stickers/bulk',
		RateLimitMiddleware(RateLimitConfigs.GUILD_STICKER_BULK_CREATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', GuildStickerBulkCreateRequest),
		OpenAPI({
			operationId: 'bulk_create_guild_stickers',
			summary: 'Bulk create guild stickers',
			responseSchema: GuildStickerBulkCreateResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Bulk create guild stickers. Requires manage_emojis permission. Creates multiple stickers in a single request for efficiency.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const {stickers} = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			const result = await ctx.get('guildService').bulkCreateStickers({user, guildId, stickers}, auditLogReason);

			return ctx.json(result);
		},
	);

	app.get(
		'/guilds/:guild_id/stickers',
		RateLimitMiddleware(RateLimitConfigs.GUILD_STICKERS_LIST),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_guild_stickers',
			summary: 'List guild stickers',
			responseSchema: GuildStickerWithUserListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'List guild stickers. Returns all custom stickers for the guild including metadata about creators, descriptions, and tags.',
		}),
		async (ctx) => {
			const {guild_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const guildId = createGuildID(guild_id);
			const requestCache = ctx.get('requestCache');
			return ctx.json(await ctx.get('guildService').getStickers({userId, guildId, requestCache}));
		},
	);

	app.patch(
		'/guilds/:guild_id/stickers/:sticker_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_STICKER_UPDATE),
		LoginRequired,
		Validator('param', GuildIdStickerIdParam),
		Validator('json', GuildStickerUpdateRequest),
		OpenAPI({
			operationId: 'update_guild_sticker',
			summary: 'Update guild sticker',
			responseSchema: GuildStickerResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Update guild sticker. Requires manage_emojis permission. Updates sticker name, description, or tags.',
		}),
		async (ctx) => {
			const {guild_id, sticker_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const guildId = createGuildID(guild_id);
			const stickerId = createStickerID(sticker_id);
			const {name, description, tags} = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			return ctx.json(
				await ctx
					.get('guildService')
					.updateSticker({userId, guildId, stickerId, name, description, tags}, auditLogReason),
			);
		},
	);

	app.delete(
		'/guilds/:guild_id/stickers/:sticker_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_STICKER_DELETE),
		LoginRequired,
		Validator('param', GuildIdStickerIdParam),
		Validator('query', PurgeQuery),
		OpenAPI({
			operationId: 'delete_guild_sticker',
			summary: 'Delete guild sticker',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Delete guild sticker. Requires manage_emojis permission. Removes a sticker from the guild; optionally purges all references.',
		}),
		async (ctx) => {
			const {guild_id, sticker_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const guildId = createGuildID(guild_id);
			const stickerId = createStickerID(sticker_id);
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			const {purge = false} = ctx.req.valid('query');

			await ctx.get('guildService').deleteSticker({userId, guildId, stickerId, purge}, auditLogReason);

			return ctx.body(null, 204);
		},
	);
}
