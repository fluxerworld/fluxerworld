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

import {createReportID} from '@fluxer/api/src/BrandedTypes';
import {requireAdminACL} from '@fluxer/api/src/middleware/AdminMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {AdminACLs} from '@fluxer/constants/src/AdminACLs';
import {
	ListReportsRequest,
	ListReportsResponse,
	ReportAdminResponseSchema,
	ResolveReportRequest,
	ResolveReportResponse,
	SearchReportsRequest,
	SearchReportsResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import {ReportIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';

export function ReportAdminController(app: HonoApp) {
	app.post(
		'/admin/reports/list',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.REPORT_VIEW),
		Validator('json', ListReportsRequest),
		OpenAPI({
			operationId: 'list_reports',
			summary: 'List reports',
			description:
				'Lists user and content reports with optional status filtering and pagination. Requires REPORT_VIEW permission.',
			responseSchema: ListReportsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const {status, limit, offset} = ctx.req.valid('json');
			return ctx.json(await adminService.listReports(status ?? 0, limit, offset));
		},
	);

	app.get(
		'/admin/reports/:report_id',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.REPORT_VIEW),
		Validator('param', ReportIdParam),
		OpenAPI({
			operationId: 'get_report',
			summary: 'Get report details',
			description:
				'Retrieves detailed information about a specific report including content, reporter, and reason. Requires REPORT_VIEW permission.',
			responseSchema: ReportAdminResponseSchema,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const {report_id} = ctx.req.valid('param');
			const report = await adminService.getReport(createReportID(report_id));
			return ctx.json(report);
		},
	);

	app.post(
		'/admin/reports/resolve',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.REPORT_RESOLVE),
		Validator('json', ResolveReportRequest),
		OpenAPI({
			operationId: 'resolve_report',
			summary: 'Resolve report',
			description:
				'Closes and resolves a report with optional public comment. Marks report as handled and creates audit log entry. Requires REPORT_RESOLVE permission.',
			responseSchema: ResolveReportResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const adminUserId = ctx.get('adminUserId');
			const auditLogReason = ctx.get('auditLogReason');
			const {report_id, public_comment} = ctx.req.valid('json');
			return ctx.json(
				await adminService.resolveReport(
					createReportID(report_id),
					adminUserId,
					public_comment || null,
					auditLogReason,
				),
			);
		},
	);

	app.post(
		'/admin/reports/search',
		RateLimitMiddleware(RateLimitConfigs.ADMIN_LOOKUP),
		requireAdminACL(AdminACLs.REPORT_VIEW),
		Validator('json', SearchReportsRequest),
		OpenAPI({
			operationId: 'search_reports',
			summary: 'Search reports',
			description:
				'Searches and filters reports by user, content, reason, and status criteria. Supports full-text search and advanced filtering. Requires REPORT_VIEW permission.',
			responseSchema: SearchReportsResponse,
			statusCode: 200,
			security: 'adminApiKey',
			tags: 'Admin',
		}),
		async (ctx) => {
			const adminService = ctx.get('adminService');
			const body = ctx.req.valid('json');
			return ctx.json(await adminService.searchReports(body));
		},
	);
}
