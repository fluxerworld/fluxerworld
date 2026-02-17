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

import {createGuildID, createUserID} from '@fluxer/api/src/BrandedTypes';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {GuildAuditLogListQuery, GuildAuditLogListResponse} from '@fluxer/schema/src/domains/guild/GuildAuditLogSchemas';

export function GuildAuditLogController(app: HonoApp) {
	app.get(
		'/guilds/:guild_id/audit-logs',
		RateLimitMiddleware(RateLimitConfigs.GUILD_AUDIT_LOGS),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', GuildIdParam),
		Validator('query', GuildAuditLogListQuery),
		OpenAPI({
			operationId: 'list_guild_audit_logs',
			summary: 'List guild audit logs',
			responseSchema: GuildAuditLogListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'List guild audit logs. Only default users can access. Requires view_audit_logs permission. Returns guild activity history with pagination and action filtering.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const query = ctx.req.valid('query');

			const requestCache = ctx.get('requestCache');
			const response = await ctx.get('guildService').listGuildAuditLogs({
				userId,
				guildId,
				requestCache,
				limit: query.limit ?? undefined,
				beforeLogId: query.before ?? undefined,
				afterLogId: query.after ?? undefined,
				filterUserId: query.user_id ? createUserID(query.user_id) : undefined,
				actionType: query.action_type,
			});

			return ctx.json(response);
		},
	);
}
