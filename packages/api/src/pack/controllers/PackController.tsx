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

import {createGuildID} from '@fluxer/api/src/BrandedTypes';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {PackIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	PackCreateRequest,
	PackDashboardResponse,
	PackSummaryResponse,
	PackTypeParam,
	PackUpdateRequest,
} from '@fluxer/schema/src/domains/pack/PackSchemas';

export function PackController(app: HonoApp) {
	app.get(
		'/packs',
		RateLimitMiddleware(RateLimitConfigs.PACKS_LIST),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_user_packs',
			summary: 'List user packs',
			description:
				'Returns a dashboard view containing all emoji and sticker packs created by or owned by the authenticated user. This includes pack metadata such as name, description, type, and cover image.',
			responseSchema: PackDashboardResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const response = await ctx.get('packRequestService').listUserPacks({
				userId: ctx.get('user').id,
			});
			return ctx.json(response);
		},
	);

	app.post(
		'/packs/:pack_type',
		RateLimitMiddleware(RateLimitConfigs.PACKS_CREATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', PackTypeParam),
		Validator('json', PackCreateRequest),
		OpenAPI({
			operationId: 'create_pack',
			summary: 'Create pack',
			description:
				'Creates a new emoji or sticker pack owned by the authenticated user. The pack type is specified in the path parameter and can be either "emoji" or "sticker". Returns the newly created pack with its metadata.',
			responseSchema: PackSummaryResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const response = await ctx.get('packRequestService').createPack({
				user: ctx.get('user'),
				type: ctx.req.valid('param').pack_type,
				data: ctx.req.valid('json'),
			});
			return ctx.json(response);
		},
	);

	app.patch(
		'/packs/:pack_id',
		RateLimitMiddleware(RateLimitConfigs.PACKS_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', PackIdParam),
		Validator('json', PackUpdateRequest),
		OpenAPI({
			operationId: 'update_pack',
			summary: 'Update pack',
			description:
				'Updates the metadata for an existing pack owned by the authenticated user. Allowed modifications include name, description, and cover image. Returns the updated pack with all current metadata.',
			responseSchema: PackSummaryResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			const response = await ctx.get('packRequestService').updatePack({
				userId: ctx.get('user').id,
				packId: createGuildID(ctx.req.valid('param').pack_id),
				data: ctx.req.valid('json'),
			});
			return ctx.json(response);
		},
	);

	app.delete(
		'/packs/:pack_id',
		RateLimitMiddleware(RateLimitConfigs.PACKS_DELETE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', PackIdParam),
		OpenAPI({
			operationId: 'delete_pack',
			summary: 'Delete pack',
			description:
				'Permanently deletes a pack owned by the authenticated user along with all emojis or stickers contained within it. This action cannot be undone and will remove all associated assets.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			await ctx.get('packRequestService').deletePack({
				userId: ctx.get('user').id,
				packId: createGuildID(ctx.req.valid('param').pack_id),
			});
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/packs/:pack_id/install',
		RateLimitMiddleware(RateLimitConfigs.PACKS_INSTALL),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', PackIdParam),
		OpenAPI({
			operationId: 'install_pack',
			summary: 'Install pack',
			description:
				"Installs a pack to the authenticated user's collection, making its emojis or stickers available for use. The pack must be publicly accessible or owned by the user.",
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			await ctx.get('packRequestService').installPack({
				userId: ctx.get('user').id,
				packId: createGuildID(ctx.req.valid('param').pack_id),
			});
			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/packs/:pack_id/install',
		RateLimitMiddleware(RateLimitConfigs.PACKS_INSTALL),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', PackIdParam),
		OpenAPI({
			operationId: 'uninstall_pack',
			summary: 'Uninstall pack',
			description:
				"Uninstalls a pack from the authenticated user's collection, removing access to its emojis or stickers. This does not delete the pack itself, only removes it from the user's installed list.",
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Packs'],
		}),
		async (ctx) => {
			await ctx.get('packRequestService').uninstallPack({
				userId: ctx.get('user').id,
				packId: createGuildID(ctx.req.valid('param').pack_id),
			});
			return ctx.body(null, 204);
		},
	);
}
