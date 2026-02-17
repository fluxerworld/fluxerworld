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
import {requireAdminACL} from '@fluxer/api/src/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {GetProcessMemoryStatsRequest} from '@fluxer/schema/src/domains/admin/AdminGuildSchemas';
import {
	GuildMemoryStatsResponse,
	NodeStatsResponse,
	ReloadAllGuildsResponse,
	ReloadGuildsRequest,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';

export function GatewayAdminController(app: HonoApp) {
	app.post(
		'/admin/gateway/memory-stats',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.GATEWAY_MEMORY_STATS),
		Validator('json', GetProcessMemoryStatsRequest),
		OpenAPI({
			operationId: 'get_guild_memory_statistics',
			summary: 'Get guild memory statistics',
			description: 'Returns heap and resident memory usage per guild. Requires GATEWAY_MEMORY_STATS permission.',
			responseSchema: GuildMemoryStatsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.getGuildMemoryStats(body.limit));
		},
	);

	app.post(
		'/admin/gateway/reload-all',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GATEWAY_RELOAD),
		requireAdminACL(AdminACLs.GATEWAY_RELOAD_ALL),
		Validator('json', ReloadGuildsRequest),
		OpenAPI({
			operationId: 'reload_all_specified_guilds',
			summary: 'Reload specified guilds',
			description:
				'Reconnects to the database and re-syncs guild state. Used for recovery after data inconsistencies. Requires GATEWAY_RELOAD_ALL permission.',
			responseSchema: ReloadAllGuildsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const body = ctx.req.valid('json');
			const guildIds = body.guild_ids.map((id) => createGuildID(id));
			return ctx.json(await adminService.reloadAllGuilds(guildIds));
		},
	);

	app.get(
		'/admin/gateway/stats',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.GATEWAY_MEMORY_STATS),
		OpenAPI({
			operationId: 'get_gateway_node_statistics',
			summary: 'Get gateway node statistics',
			description:
				'Returns uptime, process memory, and guild count. Used to monitor gateway health and performance. Requires GATEWAY_MEMORY_STATS permission.',
			responseSchema: NodeStatsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			return ctx.json(await adminService.getNodeStats());
		},
	);
}
