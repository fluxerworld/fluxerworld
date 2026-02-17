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
import {PackIdEmojiIdParam, PackIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
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

export function PackEmojiController(app: HonoApp) {
	app.post(
		'/packs/emojis/:pack_id',
		RateLimitMiddleware(RateLimitConfigs.PACKS_EMOJI_CREATE),
		LoginRequired,
		Validator('param', PackIdParam),
		Validator('json', GuildEmojiCreateRequest),
		OpenAPI({
			operationId: 'create_pack_emoji',
			summary: 'Create pack emoji',
			description:
				'Creates a new emoji within the specified pack. Requires the pack ID in the path and emoji metadata (name and image data) in the request body. Returns the newly created emoji with its generated ID.',
			responseSchema: GuildEmojiResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const packId = createGuildID(ctx.req.valid('param').pack_id);
			const {name, image} = ctx.req.valid('json');
			const user = ctx.get('user');
			return ctx.json(await ctx.get('packService').createPackEmoji({user, packId, name, image}));
		},
	);

	app.post(
		'/packs/emojis/:pack_id/bulk',
		RateLimitMiddleware(RateLimitConfigs.PACKS_EMOJI_BULK_CREATE),
		LoginRequired,
		Validator('param', PackIdParam),
		Validator('json', GuildEmojiBulkCreateRequest),
		OpenAPI({
			operationId: 'bulk_create_pack_emojis',
			summary: 'Bulk create pack emojis',
			description:
				'Creates multiple emojis within the specified pack in a single bulk operation. Accepts an array of emoji definitions, each containing name and image data. Returns a response containing all successfully created emojis.',
			responseSchema: GuildEmojiBulkCreateResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const packId = createGuildID(ctx.req.valid('param').pack_id);
			const {emojis} = ctx.req.valid('json');
			const user = ctx.get('user');
			return ctx.json(await ctx.get('packService').bulkCreatePackEmojis({user, packId, emojis}));
		},
	);

	app.get(
		'/packs/emojis/:pack_id',
		RateLimitMiddleware(RateLimitConfigs.PACKS_EMOJIS_LIST),
		LoginRequired,
		Validator('param', PackIdParam),
		OpenAPI({
			operationId: 'list_pack_emojis',
			summary: 'List pack emojis',
			description:
				'Returns a list of all emojis contained within the specified pack, including emoji metadata and creator information. Results include emoji ID, name, image URL, and the user who created each emoji.',
			responseSchema: GuildEmojiWithUserListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const packId = createGuildID(ctx.req.valid('param').pack_id);
			const userId = ctx.get('user').id;
			const requestCache = ctx.get('requestCache');
			return ctx.json(await ctx.get('packService').getPackEmojis({userId, packId, requestCache}));
		},
	);

	app.patch(
		'/packs/emojis/:pack_id/:emoji_id',
		RateLimitMiddleware(RateLimitConfigs.PACKS_EMOJI_UPDATE),
		LoginRequired,
		Validator('param', PackIdEmojiIdParam),
		Validator('json', GuildEmojiUpdateRequest),
		OpenAPI({
			operationId: 'update_pack_emoji',
			summary: 'Update pack emoji',
			description:
				'Updates the name of an existing emoji within the specified pack. Requires both pack ID and emoji ID in the path parameters. Returns the updated emoji with its new name and all existing metadata.',
			responseSchema: GuildEmojiResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const {pack_id, emoji_id} = ctx.req.valid('param');
			const packId = createGuildID(pack_id);
			const emojiId = createEmojiID(emoji_id);
			const {name} = ctx.req.valid('json');
			return ctx.json(
				await ctx.get('packService').updatePackEmoji({userId: ctx.get('user').id, packId, emojiId, name}),
			);
		},
	);

	app.delete(
		'/packs/emojis/:pack_id/:emoji_id',
		RateLimitMiddleware(RateLimitConfigs.PACKS_EMOJI_DELETE),
		LoginRequired,
		Validator('param', PackIdEmojiIdParam),
		Validator('query', PurgeQuery),
		OpenAPI({
			operationId: 'delete_pack_emoji',
			summary: 'Delete pack emoji',
			description:
				'Permanently deletes an emoji from the specified pack. Requires both pack ID and emoji ID in the path parameters. Accepts an optional "purge" query parameter to control whether associated assets are immediately deleted.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const {pack_id, emoji_id} = ctx.req.valid('param');
			const packId = createGuildID(pack_id);
			const emojiId = createEmojiID(emoji_id);
			const purge = ctx.req.valid('query').purge ?? false;
			await ctx.get('packService').deletePackEmoji({
				userId: ctx.get('user').id,
				packId,
				emojiId,
				purge,
			});
			return ctx.body(null, 204);
		},
	);
}
