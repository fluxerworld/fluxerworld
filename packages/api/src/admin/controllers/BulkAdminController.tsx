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
import {
	BulkAddGuildMembersRequest,
	BulkUpdateGuildFeaturesRequest,
} from '@fluxer/schema/src/domains/admin/AdminGuildSchemas';
import {BulkOperationResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import {
	BulkScheduleUserDeletionRequest,
	BulkUpdateUserFlagsRequest,
} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';

export function BulkAdminController(app: HonoApp) {
	app.post(
		'/admin/bulk/update-user-flags',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BULK_OPERATION),
		requireAdminACL(AdminACLs.BULK_UPDATE_USER_FLAGS),
		Validator('json', BulkUpdateUserFlagsRequest),
		OpenAPI({
			operationId: 'bulk_update_user_flags',
			summary: 'Bulk update user flags',
			description:
				'Modify user flags (e.g., verified, bot, system) for multiple users in a single operation. Used for mass account updates or corrections.',
			responseSchema: BulkOperationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.bulkUpdateUserFlags(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/bulk/update-guild-features',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BULK_OPERATION),
		requireAdminACL(AdminACLs.BULK_UPDATE_GUILD_FEATURES),
		Validator('json', BulkUpdateGuildFeaturesRequest),
		OpenAPI({
			operationId: 'bulk_update_guild_features',
			summary: 'Bulk update guild features',
			description:
				'Modify guild configuration and capabilities across multiple servers in a single operation. Includes feature flags, boost levels, and other guild attributes.',
			responseSchema: BulkOperationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.bulkUpdateGuildFeatures(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/bulk/add-guild-members',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BULK_OPERATION),
		requireAdminACL(AdminACLs.BULK_ADD_GUILD_MEMBERS),
		Validator('json', BulkAddGuildMembersRequest),
		OpenAPI({
			operationId: 'bulk_add_guild_members',
			summary: 'Bulk add guild members',
			description:
				'Add multiple users to guilds in a batch operation. Bypasses normal invitation flow for administrative account setup.',
			responseSchema: BulkOperationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.bulkAddGuildMembers(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);

	app.post(
		'/admin/bulk/schedule-user-deletion',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_BULK_OPERATION),
		requireAdminACL(AdminACLs.BULK_DELETE_USERS),
		Validator('json', BulkScheduleUserDeletionRequest),
		OpenAPI({
			operationId: 'schedule_bulk_user_deletion',
			summary: 'Schedule bulk user deletion',
			description:
				'Queue multiple users for deactivation/deletion with an optional grace period. Deletions are processed asynchronously according to retention policies.',
			responseSchema: BulkOperationResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			return ctx.json(await adminService.bulkScheduleUserDeletion(ctx.req.valid('json'), adminUserId, auditLogReason));
		},
	);
}
