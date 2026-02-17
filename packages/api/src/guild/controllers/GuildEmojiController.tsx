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

import {createEmojiID, createGuildID} from '@fluxer/api/src/BrandedTypes';
import {LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {GuildIdEmojiIdParam, GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {PurgeQuery} from '@fluxer/schema/src/domains/common/CommonQuerySchemas';
import {
	GuildEmojiBulkCreateResponse,
	GuildEmojiResponse,
	GuildEmojiWithUserListResponse,
} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import {
	GuildEmojiBulkCreateRequest,
	GuildEmojiCreateRequest,
	GuildEmojiUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildRequestSchemas';

export function GuildEmojiController(app: HonoApp) {
	app.post(
		'/guilds/:guild_id/emojis',
		RateLimitMiddleware(RateLimitConfigs.GUILD_EMOJI_CREATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', GuildEmojiCreateRequest),
		OpenAPI({
			operationId: 'create_guild_emoji',
			summary: 'Create guild emoji',
			responseSchema: GuildEmojiResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Create guild emoji. Requires manage_emojis permission. Uploads and registers a new custom emoji for the guild.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const {name, image} = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			const emoji = await ctx.get('guildService').createEmoji({user, guildId, name, image}, auditLogReason);
			return ctx.json(emoji);
		},
	);

	app.post(
		'/guilds/:guild_id/emojis/bulk',
		RateLimitMiddleware(RateLimitConfigs.GUILD_EMOJI_BULK_CREATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', GuildEmojiBulkCreateRequest),
		OpenAPI({
			operationId: 'bulk_create_guild_emojis',
			summary: 'Bulk create guild emojis',
			responseSchema: GuildEmojiBulkCreateResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Bulk create guild emojis. Requires manage_emojis permission. Creates multiple emojis in a single request for efficiency.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const {emojis} = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			const result = await ctx.get('guildService').bulkCreateEmojis({user, guildId, emojis}, auditLogReason);

			return ctx.json(result);
		},
	);

	app.get(
		'/guilds/:guild_id/emojis',
		RateLimitMiddleware(RateLimitConfigs.GUILD_EMOJIS_LIST),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_guild_emojis',
			summary: 'List guild emojis',
			responseSchema: GuildEmojiWithUserListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'List guild emojis. Returns all custom emojis for the guild including metadata about creators and timestamps.',
		}),
		async (ctx) => {
			const {guild_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const guildId = createGuildID(guild_id);
			const requestCache = ctx.get('requestCache');
			return ctx.json(await ctx.get('guildService').getEmojis({userId, guildId, requestCache}));
		},
	);

	app.patch(
		'/guilds/:guild_id/emojis/:emoji_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_EMOJI_UPDATE),
		LoginRequired,
		Validator('param', GuildIdEmojiIdParam),
		Validator('json', GuildEmojiUpdateRequest),
		OpenAPI({
			operationId: 'update_guild_emoji',
			summary: 'Update guild emoji',
			responseSchema: GuildEmojiResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Update guild emoji. Requires manage_emojis permission. Renames or updates properties of an existing emoji.',
		}),
		async (ctx) => {
			const {guild_id, emoji_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const guildId = createGuildID(guild_id);
			const emojiId = createEmojiID(emoji_id);
			const {name} = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			const emoji = await ctx.get('guildService').updateEmoji({userId, guildId, emojiId, name}, auditLogReason);
			return ctx.json(emoji);
		},
	);

	app.delete(
		'/guilds/:guild_id/emojis/:emoji_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_EMOJI_DELETE),
		LoginRequired,
		Validator('param', GuildIdEmojiIdParam),
		Validator('query', PurgeQuery),
		OpenAPI({
			operationId: 'delete_guild_emoji',
			summary: 'Delete guild emoji',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Delete guild emoji. Requires manage_emojis permission. Removes a custom emoji from the guild; optionally purges all references.',
		}),
		async (ctx) => {
			const {guild_id, emoji_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const guildId = createGuildID(guild_id);
			const emojiId = createEmojiID(emoji_id);
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			const {purge = false} = ctx.req.valid('query');

			await ctx.get('guildService').deleteEmoji({userId, guildId, emojiId, purge}, auditLogReason);

			return ctx.body(null, 204);
		},
	);
}
