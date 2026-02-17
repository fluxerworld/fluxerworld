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
import {AdminRateLimitConfigs} from '@fluxer/api/src/rate_limit_configs/AdminRateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {
	BanGuildMemberRequest,
	ClearGuildFieldsRequest,
	DeleteGuildRequest,
	ForceAddUserToGuildRequest,
	KickGuildMemberRequest,
	ListGuildMembersRequest,
	LookupGuildRequest,
	ReloadGuildRequest,
	ShutdownGuildRequest,
	TransferGuildOwnershipRequest,
	UpdateGuildFeaturesRequest,
	UpdateGuildNameRequest,
	UpdateGuildSettingsRequest,
	UpdateGuildVanityRequest,
} from '@fluxer/schema/src/domains/admin/AdminGuildSchemas';
import {
	GuildUpdateResponse,
	ListGuildEmojisResponse,
	ListGuildMembersResponse,
	ListGuildStickersResponse,
	LookupGuildResponse,
	SuccessResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import {GuildIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';

export function GuildAdminController(app: HonoApp) {
	app.post(
		'/admin/guilds/lookup',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.GUILD_LOOKUP),
		Validator('json', LookupGuildRequest),
		OpenAPI({
			operationId: 'lookup_guild',
			summary: 'Look up guild',
			description:
				'Retrieves complete guild details including metadata, settings, and statistics. Look up by guild ID or vanity slug. Requires GUILD_LOOKUP permission.',
			responseSchema: LookupGuildResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			return ctx.json(await adminService.lookupGuild(ctx.req.valid('json')));
		},
	);

	app.post(
		'/admin/guilds/list-members',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.GUILD_LIST_MEMBERS),
		Validator('json', ListGuildMembersRequest),
		OpenAPI({
			operationId: 'list_guild_members',
			summary: 'List guild members',
			description:
				'Lists all guild members with pagination. Returns member IDs, join dates, and roles. Requires GUILD_LIST_MEMBERS permission.',
			responseSchema: ListGuildMembersResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			return ctx.json(await adminService.listGuildMembers(ctx.req.valid('json')));
		},
	);

	app.get(
		'/admin/guilds/:guild_id/emojis',
		RateLimitMiddleware(AdminRateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.ASSET_PURGE),
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_guild_emojis',
			summary: 'List guild emojis',
			description:
				'Lists all custom emojis in a guild. Returns ID, name, and creation date. Used for asset inventory and purge operations. Requires ASSET_PURGE permission.',
			responseSchema: ListGuildEmojisResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			return ctx.json(await adminService.listGuildEmojis(guildId));
		},
	);

	app.get(
		'/admin/guilds/:guild_id/stickers',
		RateLimitMiddleware(AdminRateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.ASSET_PURGE),
		Validator('param', GuildIdParam),
		OpenAPI({
			operationId: 'list_guild_stickers',
			summary: 'List guild stickers',
			description:
				'Lists all stickers in a guild. Returns ID, name, and asset information. Used for asset inventory and purge operations. Requires ASSET_PURGE permission.',
			responseSchema: ListGuildStickersResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const guildId = createGuildID(ctx.req.valid('param').guild_id);
			return ctx.json(await adminService.listGuildStickers(guildId));
		},
	);

	app.post(
		'/admin/guilds/clear-fields',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.GUILD_UPDATE_SETTINGS),
		Validator('json', ClearGuildFieldsRequest),
		OpenAPI({
			operationId: 'clear_guild_fields',
			summary: 'Clear guild fields',
			description:
				'Clears specified optional guild fields such as icon, banner, or description. Logged to audit log. Requires GUILD_UPDATE_SETTINGS permission.',
			responseSchema: null,
			statusCode: 204,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			await adminService.clearGuildFields(ctx.req.valid('json'), adminUserId, auditLogReason);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/admin/guilds/update-features',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.GUILD_UPDATE_FEATURES),
		Validator('json', UpdateGuildFeaturesRequest),
		OpenAPI({
			operationId: 'update_guild_features',
			summary: 'Update guild features',
			description:
				'Enables or disables guild feature flags. Modifies verification levels and community settings. Changes are logged to audit log. Requires GUILD_UPDATE_FEATURES permission.',
			responseSchema: GuildUpdateResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const body = ctx.req.valid('json');
			const guildId = createGuildID(body.guild_id);
			return ctx.json(
				await adminService.updateGuildFeatures({
					guildId,
					addFeatures: body.add_features,
					removeFeatures: body.remove_features,
					adminUserId,
					auditLogReason,
				}),
			);
		},
	);

	app.post(
		'/admin/guilds/update-name',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.GUILD_UPDATE_NAME),
		Validator('json', UpdateGuildNameRequest),
		OpenAPI({
			operationId: 'update_guild_name',
			summary: 'Update guild name',
			description:
				'Changes a guild name. Used for removing inappropriate names or correcting display issues. Logged to audit log. Requires GUILD_UPDATE_NAME permission.',
			responseSchema: GuildUpdateResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.updateGuildName(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/guilds/update-settings',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.GUILD_UPDATE_SETTINGS),
		Validator('json', UpdateGuildSettingsRequest),
		OpenAPI({
			operationId: 'update_guild_settings',
			summary: 'Update guild settings',
			description:
				'Modifies guild configuration including description, region, language and other settings. Logged to audit log. Requires GUILD_UPDATE_SETTINGS permission.',
			responseSchema: GuildUpdateResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.updateGuildSettings(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/guilds/transfer-ownership',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.GUILD_TRANSFER_OWNERSHIP),
		Validator('json', TransferGuildOwnershipRequest),
		OpenAPI({
			operationId: 'transfer_guild_ownership',
			summary: 'Transfer guild ownership',
			description:
				'Transfers guild ownership to another user. Used when owner is inactive or for administrative recovery. Logged to audit log. Requires GUILD_TRANSFER_OWNERSHIP permission.',
			responseSchema: GuildUpdateResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.transferGuildOwnership(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/guilds/update-vanity',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.GUILD_UPDATE_VANITY),
		Validator('json', UpdateGuildVanityRequest),
		OpenAPI({
			operationId: 'update_guild_vanity',
			summary: 'Update guild vanity',
			description:
				'Updates a guild vanity URL slug. Sets custom short URL and prevents duplicate slugs. Logged to audit log. Requires GUILD_UPDATE_VANITY permission.',
			responseSchema: GuildUpdateResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.updateGuildVanity(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/guilds/force-add-user',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.GUILD_FORCE_ADD_MEMBER),
		Validator('json', ForceAddUserToGuildRequest),
		OpenAPI({
			operationId: 'force_add_user_to_guild',
			summary: 'Force add user to guild',
			description:
				'Forcefully adds a user to a guild. Bypasses normal invite flow for administrative account recovery. Logged to audit log. Requires GUILD_FORCE_ADD_MEMBER permission.',
			responseSchema: SuccessResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const requestCache = ctx.get('requestCache');
			return ctx.json(
				await adminService.forceAddUserToGuild({
					data: ctx.req.valid('json'),
					requestCache,
					adminUserId,
					auditLogReason,
				}),
			);
		},
	);

	app.post(
		'/admin/guilds/ban-member',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.GUILD_BAN_MEMBER),
		Validator('json', BanGuildMemberRequest),
		OpenAPI({
			operationId: 'ban_guild_member',
			summary: 'Ban guild member',
			description:
				'Permanently bans a user from a guild. Prevents user from joining. Logged to audit log. Requires GUILD_BAN_MEMBER permission.',
			responseSchema: null,
			statusCode: 204,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			await adminService.banGuildMember(ctx.req.valid('json'), adminUserId, auditLogReason);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/admin/guilds/kick-member',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.GUILD_KICK_MEMBER),
		Validator('json', KickGuildMemberRequest),
		OpenAPI({
			operationId: 'kick_guild_member',
			summary: 'Kick guild member',
			description:
				'Temporarily removes a user from a guild. User can rejoin. Logged to audit log. Requires GUILD_KICK_MEMBER permission.',
			responseSchema: null,
			statusCode: 204,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			await adminService.kickGuildMember(ctx.req.valid('json'), adminUserId, auditLogReason);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/admin/guilds/reload',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.GUILD_RELOAD),
		Validator('json', ReloadGuildRequest),
		OpenAPI({
			operationId: 'reload_guild',
			summary: 'Reload guild',
			description:
				'Reloads a single guild state from database. Used to recover from corruption or sync issues. Logged to audit log. Requires GUILD_RELOAD permission.',
			responseSchema: SuccessResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.reloadGuild(body.guild_id, adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/guilds/shutdown',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.GUILD_SHUTDOWN),
		Validator('json', ShutdownGuildRequest),
		OpenAPI({
			operationId: 'shutdown_guild',
			summary: 'Shutdown guild',
			description:
				'Shuts down and unloads a guild from the gateway. Guild data remains in database. Used for emergency resource cleanup. Logged to audit log. Requires GUILD_SHUTDOWN permission.',
			responseSchema: SuccessResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.shutdownGuild(body.guild_id, adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/guilds/delete',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_GUILD_MODIFY),
		requireAdminACL(AdminACLs.GUILD_DELETE),
		Validator('json', DeleteGuildRequest),
		OpenAPI({
			operationId: 'delete_guild',
			summary: 'Delete guild',
			description:
				'Permanently deletes a guild. Deletes all channels, messages, and settings. Irreversible operation. Logged to audit log. Requires GUILD_DELETE permission.',
			responseSchema: SuccessResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.deleteGuild(body.guild_id, adminUserId, auditLogReason));
		},
	);
}
