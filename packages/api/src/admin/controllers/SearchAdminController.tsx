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
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {SearchGuildsRequest} from '@fluxer/schema/src/domains/admin/AdminGuildSchemas';
import {
	GetIndexRefreshStatusRequest,
	IndexRefreshStatusResponse,
	RefreshSearchIndexRequest,
	RefreshSearchIndexResponse,
	SearchGuildsResponse,
	SearchUsersResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import {SearchUsersRequest} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';

export function SearchAdminController(app: HonoApp) {
	app.post(
		'/admin/guilds/search',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.GUILD_LOOKUP),
		Validator('json', SearchGuildsRequest),
		OpenAPI({
			operationId: 'search_guilds',
			summary: 'Search guilds',
			description:
				'Searches guilds by name, ID, and other criteria. Supports full-text search and filtering. Requires GUILD_LOOKUP permission.',
			responseSchema: SearchGuildsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.searchGuilds(body));
		},
	);

	app.post(
		'/admin/users/search',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.USER_LOOKUP),
		Validator('json', SearchUsersRequest),
		OpenAPI({
			operationId: 'search_users',
			summary: 'Search users',
			description:
				'Searches users by username, email, ID, and other criteria. Supports full-text search and filtering by account status. Requires USER_LOOKUP permission.',
			responseSchema: SearchUsersResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.searchUsers(body));
		},
	);

	app.post(
		'/admin/search/refresh-index',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.GUILD_LOOKUP),
		Validator('json', RefreshSearchIndexRequest),
		OpenAPI({
			operationId: 'refresh_search_index',
			summary: 'Refresh search index',
			description:
				'Trigger full or partial search index rebuild. Creates background job to reindex guilds and users. Returns job ID for status tracking. Requires GUILD_LOOKUP permission.',
			responseSchema: RefreshSearchIndexResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.refreshSearchIndex(body, adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/search/refresh-status',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.GUILD_LOOKUP),
		Validator('json', GetIndexRefreshStatusRequest),
		OpenAPI({
			operationId: 'get_search_index_refresh_status',
			summary: 'Get search index refresh status',
			description:
				'Polls status of a search index refresh job. Returns completion percentage and current phase. Requires GUILD_LOOKUP permission.',
			responseSchema: IndexRefreshStatusResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.getIndexRefreshStatus(body.job_id));
		},
	);
}
