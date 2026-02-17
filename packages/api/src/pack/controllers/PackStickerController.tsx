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
import {PackIdParam, PackIdStickerIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
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

export function PackStickerController(app: HonoApp) {
	app.post(
		'/packs/stickers/:pack_id',
		RateLimitMiddleware(RateLimitConfigs.PACKS_STICKER_CREATE),
		LoginRequired,
		Validator('param', PackIdParam),
		Validator('json', GuildStickerCreateRequest),
		OpenAPI({
			operationId: 'create_pack_sticker',
			summary: 'Create pack sticker',
			description:
				'Creates a new sticker within the specified pack. Requires the pack ID in the path and sticker metadata (name, description, tags, and image data) in the request body. Returns the newly created sticker with its generated ID.',
			responseSchema: GuildStickerResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const packId = createGuildID(ctx.req.valid('param').pack_id);
			const {name, description, tags, image} = ctx.req.valid('json');
			const user = ctx.get('user');
			const sticker = await ctx.get('packService').createPackSticker({user, packId, name, description, tags, image});
			return ctx.json(sticker);
		},
	);

	app.post(
		'/packs/stickers/:pack_id/bulk',
		RateLimitMiddleware(RateLimitConfigs.PACKS_STICKER_BULK_CREATE),
		LoginRequired,
		Validator('param', PackIdParam),
		Validator('json', GuildStickerBulkCreateRequest),
		OpenAPI({
			operationId: 'bulk_create_pack_stickers',
			summary: 'Bulk create pack stickers',
			description:
				'Creates multiple stickers within the specified pack in a single bulk operation. Accepts an array of sticker definitions, each containing name, description, tags, and image data. Returns a response containing all successfully created stickers.',
			responseSchema: GuildStickerBulkCreateResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const packId = createGuildID(ctx.req.valid('param').pack_id);
			const {stickers} = ctx.req.valid('json');
			const user = ctx.get('user');
			const result = await ctx.get('packService').bulkCreatePackStickers({user, packId, stickers});

			return ctx.json(result);
		},
	);

	app.get(
		'/packs/stickers/:pack_id',
		RateLimitMiddleware(RateLimitConfigs.PACKS_STICKERS_LIST),
		LoginRequired,
		Validator('param', PackIdParam),
		OpenAPI({
			operationId: 'list_pack_stickers',
			summary: 'List pack stickers',
			description:
				'Returns a list of all stickers contained within the specified pack, including sticker metadata and creator information. Results include sticker ID, name, description, tags, image URL, and the user who created each sticker.',
			responseSchema: GuildStickerWithUserListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const packId = createGuildID(ctx.req.valid('param').pack_id);
			const userId = ctx.get('user').id;
			const requestCache = ctx.get('requestCache');
			return ctx.json(await ctx.get('packService').getPackStickers({userId, packId, requestCache}));
		},
	);

	app.patch(
		'/packs/stickers/:pack_id/:sticker_id',
		RateLimitMiddleware(RateLimitConfigs.PACKS_STICKER_UPDATE),
		LoginRequired,
		Validator('param', PackIdStickerIdParam),
		Validator('json', GuildStickerUpdateRequest),
		OpenAPI({
			operationId: 'update_pack_sticker',
			summary: 'Update pack sticker',
			description:
				'Updates the name, description, or tags of an existing sticker within the specified pack. Requires both pack ID and sticker ID in the path parameters. Returns the updated sticker with its new metadata and all existing fields.',
			responseSchema: GuildStickerResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const {pack_id, sticker_id} = ctx.req.valid('param');
			const packId = createGuildID(pack_id);
			const stickerId = createStickerID(sticker_id);
			const {name, description, tags} = ctx.req.valid('json');
			return ctx.json(
				await ctx
					.get('packService')
					.updatePackSticker({userId: ctx.get('user').id, packId, stickerId, name, description, tags}),
			);
		},
	);

	app.delete(
		'/packs/stickers/:pack_id/:sticker_id',
		RateLimitMiddleware(RateLimitConfigs.PACKS_STICKER_DELETE),
		LoginRequired,
		Validator('param', PackIdStickerIdParam),
		Validator('query', PurgeQuery),
		OpenAPI({
			operationId: 'delete_pack_sticker',
			summary: 'Delete pack sticker',
			description:
				'Permanently deletes a sticker from the specified pack. Requires both pack ID and sticker ID in the path parameters. Accepts an optional "purge" query parameter to control whether associated assets are immediately deleted.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const {pack_id, sticker_id} = ctx.req.valid('param');
			const packId = createGuildID(pack_id);
			const stickerId = createStickerID(sticker_id);
			const {purge = false} = ctx.req.valid('query');

			await ctx.get('packService').deletePackSticker({
				userId: ctx.get('user').id,
				packId,
				stickerId,
				purge,
			});

			return ctx.body(null, 204);
		},
	);
}
