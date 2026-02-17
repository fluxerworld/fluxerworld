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
	AuditLogsListResponseSchema,
	ListAuditLogsRequest,
	SearchAuditLogsRequest,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';

export function AuditLogAdminController(app: HonoApp) {
	app.post(
		'/admin/audit-logs',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_AUDIT_LOG),
		requireAdminACL(AdminACLs.AUDIT_LOG_VIEW),
		Validator('json', ListAuditLogsRequest),
		OpenAPI({
			operationId: 'list_audit_logs',
			summary: 'List audit logs',
			responseSchema: AuditLogsListResponseSchema,
			statusCode: 200,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Retrieve a paginated list of audit logs with optional filtering by date range, action type, or actor. Used for tracking administrative operations and compliance auditing.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			return ctx.json(await adminService.listAuditLogs(ctx.req.valid('json')));
		},
	);

	app.post(
		'/admin/audit-logs/search',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_AUDIT_LOG),
		requireAdminACL(AdminACLs.AUDIT_LOG_VIEW),
		Validator('json', SearchAuditLogsRequest),
		OpenAPI({
			operationId: 'search_audit_logs',
			summary: 'Search audit logs',
			responseSchema: AuditLogsListResponseSchema,
			statusCode: 200,
			security: ['adminApiKey'],
			tags: ['Admin'],
			description:
				'Perform a full-text search across audit logs for specific events or changes. Allows targeted queries for compliance investigations or incident response.',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			return ctx.json(await adminService.searchAuditLogs(ctx.req.valid('json')));
		},
	);
}
