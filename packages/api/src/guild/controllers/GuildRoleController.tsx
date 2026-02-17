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

import {createGuildID, createRoleID} from '@fluxer/api/src/BrandedTypes';
import {LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {GuildIdParam, GuildIdRoleIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	GuildRoleCreateRequest,
	GuildRoleHoistPositionsRequest,
	GuildRolePositionsRequest,
	GuildRoleUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildRequestSchemas';
import {GuildRoleResponse} from '@fluxer/schema/src/domains/guild/GuildRoleSchemas';
import {z} from 'zod';

export function GuildRoleController(app: HonoApp) {
	app.get(
		'/guilds/:guild_id/roles',
		RateLimitMiddleware(RateLimitConfigs.GUILD_ROLE_LIST),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_guild_roles',
			summary: 'List guild roles',
			responseSchema: z.array(GuildRoleResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description: 'List guild roles. Returns all roles defined in the guild including their permissions and settings.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			return ctx.json(await ctx.get('guildService').listRoles({userId, guildId}));
		},
	);

	app.post(
		'/guilds/:guild_id/roles',
		RateLimitMiddleware(RateLimitConfigs.GUILD_ROLE_CREATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', GuildRoleCreateRequest),
		OpenAPI({
			operationId: 'create_guild_role',
			summary: 'Create guild role',
			responseSchema: GuildRoleResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Create guild role. Requires manage_roles permission. Creates a new role with specified name, permissions, and color.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const data = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			return ctx.json(await ctx.get('guildService').createRole({userId, guildId, data}, auditLogReason));
		},
	);

	app.patch(
		'/guilds/:guild_id/roles/hoist-positions',
		RateLimitMiddleware(RateLimitConfigs.GUILD_ROLE_HOIST_POSITIONS),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', GuildRoleHoistPositionsRequest),
		OpenAPI({
			operationId: 'update_role_hoist_positions',
			summary: 'Update role hoist positions',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Update role hoist positions. Requires manage_roles permission. Sets the display priority for hoisted (separated) roles in the member list.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const payload = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			await ctx.get('guildService').updateHoistPositions(
				{
					userId,
					guildId,
					updates: payload.map((item) => ({roleId: createRoleID(item.id), hoistPosition: item.hoist_position})),
				},
				auditLogReason,
			);
			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/guilds/:guild_id/roles/hoist-positions',
		RateLimitMiddleware(RateLimitConfigs.GUILD_ROLE_HOIST_POSITIONS_RESET),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'reset_role_hoist_positions',
			summary: 'Reset role hoist positions',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Reset role hoist positions. Requires manage_roles permission. Clears all hoist position assignments for roles in the guild.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			await ctx.get('guildService').resetHoistPositions({userId, guildId}, auditLogReason);
			return ctx.body(null, 204);
		},
	);

	app.patch(
		'/guilds/:guild_id/roles/:role_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_ROLE_UPDATE),
		LoginRequired,
		Validator('param', GuildIdRoleIdParam),
		Validator('json', GuildRoleUpdateRequest),
		OpenAPI({
			operationId: 'update_guild_role',
			summary: 'Update guild role',
			responseSchema: GuildRoleResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Update guild role. Requires manage_roles permission. Modifies role name, permissions, color, and other settings.',
		}),
		async (ctx) => {
			const {guild_id, role_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const guildId = createGuildID(guild_id);
			const roleId = createRoleID(role_id);
			const data = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			return ctx.json(await ctx.get('guildService').updateRole({userId, guildId, roleId, data}, auditLogReason));
		},
	);

	app.patch(
		'/guilds/:guild_id/roles',
		RateLimitMiddleware(RateLimitConfigs.GUILD_ROLE_POSITIONS),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', GuildRolePositionsRequest),
		OpenAPI({
			operationId: 'update_guild_role_positions',
			summary: 'Update role positions',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Update role positions. Requires manage_roles permission. Reorders roles to change their hierarchy and permission precedence.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const payload = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			await ctx.get('guildService').updateRolePositions(
				{
					userId,
					guildId,
					updates: payload.map((item) => ({roleId: createRoleID(item.id), position: item.position})),
				},
				auditLogReason,
			);
			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/guilds/:guild_id/roles/:role_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_ROLE_DELETE),
		LoginRequired,
		Validator('param', GuildIdRoleIdParam),
		OpenAPI({
			operationId: 'delete_guild_role',
			summary: 'Delete guild role',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description: 'Delete guild role. Requires manage_roles permission. Permanently removes the role from the guild.',
		}),
		async (ctx) => {
			const {guild_id, role_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const guildId = createGuildID(guild_id);
			const roleId = createRoleID(role_id);
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			await ctx.get('guildService').deleteRole({userId, guildId, roleId}, auditLogReason);
			return ctx.body(null, 204);
		},
	);
}
