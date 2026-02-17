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

import {requireSudoMode} from '@fluxer/api/src/auth/services/SudoVerificationService';
import {createGuildID, createRoleID, createUserID} from '@fluxer/api/src/BrandedTypes';
import {LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {SudoModeMiddleware} from '@fluxer/api/src/middleware/SudoModeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {SudoVerificationSchema} from '@fluxer/schema/src/domains/auth/AuthSchemas';
import {
	GuildIdParam,
	GuildIdUserIdParam,
	GuildIdUserIdRoleIdParam,
} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {GuildBanResponse, GuildMemberResponse} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import {
	GuildBanCreateRequest,
	GuildMemberListQuery,
	GuildMemberUpdateRequest,
	GuildTransferOwnershipRequest,
	MyGuildMemberUpdateRequest,
} from '@fluxer/schema/src/domains/guild/GuildRequestSchemas';
import {GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {z} from 'zod';

export function GuildMemberController(app: HonoApp) {
	app.get(
		'/guilds/:guild_id/members',
		RateLimitMiddleware(RateLimitConfigs.GUILD_MEMBERS),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('query', GuildMemberListQuery),
		OpenAPI({
			operationId: 'list_guild_members',
			summary: 'List guild members',
			responseSchema: z.array(GuildMemberResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'List guild members. Supports pagination with limit and after cursor. Returns member information for the specified guild.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const {limit, after} = ctx.req.valid('query');
			const requestCache = ctx.get('requestCache');
			return ctx.json(
				await ctx.get('guildService').getMembers({
					userId,
					guildId,
					limit,
					after: after != null ? createUserID(after) : undefined,
					requestCache,
				}),
			);
		},
	);

	app.get(
		'/guilds/:guild_id/members/@me',
		RateLimitMiddleware(RateLimitConfigs.GUILD_MEMBERS),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'get_current_guild_member',
			summary: 'Get current user guild member',
			responseSchema: GuildMemberResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Get current user guild member. Returns the member information for the authenticated user in the specified guild.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const requestCache = ctx.get('requestCache');
			return ctx.json(await ctx.get('guildService').getMember({userId, targetId: userId, guildId, requestCache}));
		},
	);

	app.get(
		'/guilds/:guild_id/members/:user_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_MEMBERS),
		LoginRequired,
		Validator('param', GuildIdUserIdParam),
		OpenAPI({
			operationId: 'get_guild_member',
			summary: 'Get guild member by user ID',
			responseSchema: GuildMemberResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Get guild member by user ID. Returns member information including roles, nickname, and join date for the specified user in the guild.',
		}),
		async (ctx) => {
			const {guild_id, user_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const targetId = createUserID(user_id);
			const guildId = createGuildID(guild_id);
			const requestCache = ctx.get('requestCache');
			return ctx.json(await ctx.get('guildService').getMember({userId, targetId, guildId, requestCache}));
		},
	);

	app.patch(
		'/guilds/:guild_id/members/@me',
		RateLimitMiddleware(RateLimitConfigs.GUILD_MEMBER_UPDATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', MyGuildMemberUpdateRequest),
		OpenAPI({
			operationId: 'update_current_guild_member',
			summary: 'Update current user guild member',
			responseSchema: GuildMemberResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description: 'Update current user guild member. User can modify their own nickname within the guild.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const requestCache = ctx.get('requestCache');
			const data = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			const result = await ctx
				.get('guildService')
				.updateMember({userId, targetId: userId, guildId, data, requestCache}, auditLogReason);
			return ctx.json(result);
		},
	);

	app.patch(
		'/guilds/:guild_id/members/:user_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_MEMBER_UPDATE),
		LoginRequired,
		Validator('param', GuildIdUserIdParam),
		Validator('json', GuildMemberUpdateRequest),
		OpenAPI({
			operationId: 'update_guild_member',
			summary: 'Update guild member',
			responseSchema: GuildMemberResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Update guild member. Requires manage_members permission. Can modify member nickname, voice state, and other member properties.',
		}),
		async (ctx) => {
			const {guild_id, user_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const targetId = createUserID(user_id);
			const guildId = createGuildID(guild_id);
			const data = ctx.req.valid('json');
			const requestCache = ctx.get('requestCache');
			const auditLogReason = ctx.get('auditLogReason') ?? null;

			const result = await ctx
				.get('guildService')
				.updateMember({userId, targetId, guildId, data, requestCache}, auditLogReason);
			return ctx.json(result);
		},
	);

	app.delete(
		'/guilds/:guild_id/members/:user_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_MEMBER_REMOVE),
		LoginRequired,
		Validator('param', GuildIdUserIdParam),
		OpenAPI({
			operationId: 'remove_guild_member',
			summary: 'Remove guild member',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description: 'Remove guild member. Requires kick_members permission. Removes the specified user from the guild.',
		}),
		async (ctx) => {
			const {guild_id, user_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const targetId = createUserID(user_id);
			const guildId = createGuildID(guild_id);
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			await ctx.get('guildService').removeMember({userId, targetId, guildId}, auditLogReason);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/guilds/:guild_id/transfer-ownership',
		RateLimitMiddleware(RateLimitConfigs.GUILD_UPDATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		SudoModeMiddleware,
		Validator('json', GuildTransferOwnershipRequest.merge(SudoVerificationSchema)),
		OpenAPI({
			operationId: 'transfer_guild_ownership',
			summary: 'Transfer guild ownership',
			responseSchema: GuildResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Transfer guild ownership. Only current owner can transfer. Requires sudo mode verification (MFA). Transfers all guild permissions to a new owner.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const userId = user.id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'));
			const {new_owner_id} = body;
			const newOwnerId = createUserID(new_owner_id);
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			return ctx.json(await ctx.get('guildService').transferOwnership({userId, guildId, newOwnerId}, auditLogReason));
		},
	);

	app.get(
		'/guilds/:guild_id/bans',
		RateLimitMiddleware(RateLimitConfigs.GUILD_MEMBERS),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_guild_bans',
			summary: 'List guild bans',
			responseSchema: z.array(GuildBanResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'List guild bans. Requires ban_members permission. Returns all banned users for the guild including ban reasons and expiry times.',
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const requestCache = ctx.get('requestCache');
			return ctx.json(await ctx.get('guildService').listBans({userId, guildId, requestCache}));
		},
	);

	app.put(
		'/guilds/:guild_id/bans/:user_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_MEMBER_REMOVE),
		LoginRequired,
		Validator('param', GuildIdUserIdParam),
		Validator('json', GuildBanCreateRequest),
		OpenAPI({
			operationId: 'ban_guild_member',
			summary: 'Ban guild member',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Ban guild member. Requires ban_members permission. Prevents user from joining; optionally deletes recent messages and sets ban expiry duration.',
		}),
		async (ctx) => {
			const {guild_id, user_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const targetId = createUserID(user_id);
			const guildId = createGuildID(guild_id);
			const {delete_message_days, reason, ban_duration_seconds} = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;

			await ctx.get('guildService').banMember(
				{
					userId,
					guildId,
					targetId,
					deleteMessageDays: delete_message_days,
					reason: reason ?? undefined,
					banDurationSeconds: ban_duration_seconds,
				},
				auditLogReason,
			);

			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/guilds/:guild_id/bans/:user_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_MEMBER_REMOVE),
		LoginRequired,
		Validator('param', GuildIdUserIdParam),
		OpenAPI({
			operationId: 'unban_guild_member',
			summary: 'Unban guild member',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Unban guild member. Requires ban_members permission. Removes ban and allows user to rejoin the guild.',
		}),
		async (ctx) => {
			const {guild_id, user_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const targetId = createUserID(user_id);
			const guildId = createGuildID(guild_id);
			const auditLogReason = ctx.get('auditLogReason') ?? null;

			await ctx.get('guildService').unbanMember({userId, guildId, targetId}, auditLogReason);

			return ctx.body(null, 204);
		},
	);

	app.put(
		'/guilds/:guild_id/members/:user_id/roles/:role_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_MEMBER_ROLE_ADD),
		LoginRequired,
		Validator('param', GuildIdUserIdRoleIdParam),
		OpenAPI({
			operationId: 'add_guild_member_role',
			summary: 'Add role to guild member',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Add role to guild member. Requires manage_roles permission. Grants the specified role to the user in the guild.',
		}),
		async (ctx) => {
			const {guild_id, user_id, role_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const targetId = createUserID(user_id);
			const guildId = createGuildID(guild_id);
			const roleId = createRoleID(role_id);
			const requestCache = ctx.get('requestCache');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			await ctx.get('guildService').addMemberRole({userId, targetId, guildId, roleId, requestCache}, auditLogReason);
			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/guilds/:guild_id/members/:user_id/roles/:role_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_MEMBER_ROLE_REMOVE),
		LoginRequired,
		Validator('param', GuildIdUserIdRoleIdParam),
		OpenAPI({
			operationId: 'remove_guild_member_role',
			summary: 'Remove role from guild member',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
			description:
				'Remove role from guild member. Requires manage_roles permission. Revokes the specified role from the user in the guild.',
		}),
		async (ctx) => {
			const {guild_id, user_id, role_id} = ctx.req.valid('param');
			const userId = ctx.get('user').id;
			const targetId = createUserID(user_id);
			const guildId = createGuildID(guild_id);
			const roleId = createRoleID(role_id);
			const requestCache = ctx.get('requestCache');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			await ctx.get('guildService').removeMemberRole({userId, targetId, guildId, roleId, requestCache}, auditLogReason);
			return ctx.body(null, 204);
		},
	);
}
