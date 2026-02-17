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
import {createGuildID} from '@fluxer/api/src/BrandedTypes';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {requireOAuth2ScopeForBearer} from '@fluxer/api/src/middleware/OAuth2ScopeMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {SudoModeMiddleware} from '@fluxer/api/src/middleware/SudoModeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {EnabledToggleRequest, GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';
import {
	GuildCreateRequest,
	GuildDeleteRequest,
	GuildListQuery,
	GuildUpdateRequest,
	GuildVanityURLUpdateRequest,
	GuildVanityURLUpdateResponse,
} from '@fluxer/schema/src/domains/guild/GuildRequestSchemas';
import {GuildResponse, GuildVanityURLResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {z} from 'zod';

export function GuildBaseController(app: HonoApp) {
	app.post(
		'/guilds',
		RateLimitMiddleware(RateLimitConfigs.GUILD_CREATE),
		Validator('json', GuildCreateRequest),
		LoginRequired,
		OpenAPI({
			operationId: 'create_guild',
			summary: 'Create guild',
			description: 'Only authenticated users can create guilds.',
			responseSchema: GuildResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const data = ctx.req.valid('json');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			return ctx.json(await ctx.get('guildService').createGuild({user, data}, auditLogReason));
		},
	);

	app.get(
		'/users/@me/guilds',
		RateLimitMiddleware(RateLimitConfigs.GUILD_LIST),
		requireOAuth2ScopeForBearer('guilds'),
		LoginRequired,
		Validator('query', GuildListQuery),
		OpenAPI({
			operationId: 'list_guilds',
			summary: 'List current user guilds',
			description: 'Requires guilds OAuth scope if using bearer token. Returns all guilds the user is a member of.',
			responseSchema: z.array(GuildResponse),
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const {before, after, limit, with_counts} = ctx.req.valid('query');
			return ctx.json(
				await ctx.get('guildService').getUserGuilds(userId, {
					before: before != null ? createGuildID(before) : undefined,
					after: after != null ? createGuildID(after) : undefined,
					limit,
					withCounts: with_counts,
				}),
			);
		},
	);

	app.delete(
		'/users/@me/guilds/:guild_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_LEAVE),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'leave_guild',
			summary: 'Leave guild',
			description: 'Removes the current user from the specified guild membership.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			await ctx.get('guildService').leaveGuild({userId, guildId}, auditLogReason);
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/guilds/:guild_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_GET),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'get_guild',
			summary: 'Get guild information',
			description: 'User must be a member of the guild to access this endpoint.',
			responseSchema: GuildResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			return ctx.json(await ctx.get('guildService').getGuild({userId, guildId}));
		},
	);

	app.patch(
		'/guilds/:guild_id',
		RateLimitMiddleware(RateLimitConfigs.GUILD_UPDATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		SudoModeMiddleware,
		Validator('json', GuildUpdateRequest),
		OpenAPI({
			operationId: 'update_guild',
			summary: 'Update guild settings',
			description:
				'Requires manage_guild permission. Updates guild name, description, icon, banner, and other configuration options.',
			responseSchema: GuildResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const data = ctx.req.valid('json');
			if (data.mfa_level !== undefined) {
				const user = ctx.get('user');
				await requireSudoMode(ctx, user, data, ctx.get('authService'), ctx.get('authMfaService'));
			}
			const requestCache = ctx.get('requestCache');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			return ctx.json(await ctx.get('guildService').updateGuild({userId, guildId, data, requestCache}, auditLogReason));
		},
	);

	app.post(
		'/guilds/:guild_id/delete',
		RateLimitMiddleware(RateLimitConfigs.GUILD_DELETE),
		LoginRequired,
		Validator('param', GuildIdParam),
		SudoModeMiddleware,
		Validator('json', GuildDeleteRequest),
		OpenAPI({
			operationId: 'delete_guild',
			summary: 'Delete guild',
			description:
				'Only guild owner can delete. Requires sudo mode verification (MFA). Permanently deletes the guild and all associated data.',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'));
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			await ctx.get('guildService').deleteGuild({user, guildId}, auditLogReason);
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/guilds/:guild_id/vanity-url',
		RateLimitMiddleware(RateLimitConfigs.GUILD_VANITY_URL_GET),
		LoginRequired,
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'get_guild_vanity_url',
			summary: 'Get guild vanity URL',
			description: 'Returns the custom invite code for the guild if configured.',
			responseSchema: GuildVanityURLResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			return ctx.json(await ctx.get('guildService').getVanityURL({userId, guildId}));
		},
	);

	app.patch(
		'/guilds/:guild_id/vanity-url',
		RateLimitMiddleware(RateLimitConfigs.GUILD_VANITY_URL_PATCH),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', GuildIdParam),
		Validator('json', GuildVanityURLUpdateRequest),
		OpenAPI({
			operationId: 'update_guild_vanity_url',
			summary: 'Update guild vanity URL',
			description:
				'Only default users can set vanity URLs. Requires manage_guild permission. Sets or removes a custom invite code.',
			responseSchema: GuildVanityURLUpdateResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const {code} = ctx.req.valid('json');
			const requestCache = ctx.get('requestCache');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			const {code: newCode} = await ctx
				.get('guildService')
				.updateVanityURL({userId, guildId, code: code ?? null, requestCache}, auditLogReason);
			return ctx.json({code: newCode});
		},
	);

	app.patch(
		'/guilds/:guild_id/text-channel-flexible-names',
		RateLimitMiddleware(RateLimitConfigs.GUILD_UPDATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', EnabledToggleRequest),
		OpenAPI({
			operationId: 'toggle_text_channel_flexible_names',
			summary: 'Toggle text channel flexible names',
			description: 'Requires manage_guild permission. Allows or disables flexible naming for text channels.',
			responseSchema: GuildResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const {enabled} = ctx.req.valid('json');
			const requestCache = ctx.get('requestCache');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			return ctx.json(
				await ctx
					.get('guildService')
					.updateTextChannelFlexibleNamesFeature({userId, guildId, enabled, requestCache}, auditLogReason),
			);
		},
	);

	app.patch(
		'/guilds/:guild_id/detached-banner',
		RateLimitMiddleware(RateLimitConfigs.GUILD_UPDATE),
		LoginRequired,
		Validator('param', GuildIdParam),
		Validator('json', EnabledToggleRequest),
		OpenAPI({
			operationId: 'toggle_detached_banner',
			summary: 'Toggle detached banner',
			description: 'Requires manage_guild permission. Enables or disables independent banner display configuration.',
			responseSchema: GuildResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Guilds'],
		}),
		async (ctx) => {
			const userId = ctx.get('user').id;
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			const {enabled} = ctx.req.valid('json');
			const requestCache = ctx.get('requestCache');
			const auditLogReason = ctx.get('auditLogReason') ?? null;
			return ctx.json(
				await ctx
					.get('guildService')
					.updateDetachedBannerFeature({userId, guildId, enabled, requestCache}, auditLogReason),
			);
		},
	);
}
