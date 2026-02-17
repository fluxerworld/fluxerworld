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

import {requireAdminACL} from '@fluxer/api/src/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {AdminRateLimitConfigs} from '@fluxer/api/src/rate_limit_configs/AdminRateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {PurgeGuildAssetsRequest, PurgeGuildAssetsResponseSchema} from '@fluxer/schema/src/domains/admin/AdminSchemas';

export function AssetAdminController(app: HonoApp) {
	app.post(
		'/admin/assets/purge',
		RateLimitMiddleware(AdminRateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.ASSET_PURGE),
		Validator('json', PurgeGuildAssetsRequest),
		OpenAPI({
			operationId: 'purge_guild_assets',
			summary: 'Purge guild assets',
			responseSchema: PurgeGuildAssetsResponseSchema,
			statusCode: 200,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Delete and clean up all assets belonging to a guild, including icons, banners, and other media. This is a destructive operation used for cleanup during guild management or compliance actions.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.purgeGuildAssets(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);
}
