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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {ApiClient, type ApiResult} from '@fluxer/admin/src/api/Client';
import type {JsonObject} from '@fluxer/admin/src/api/JsonTypes';
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {
	ListReportsResponse,
	ReportAdminResponseSchema,
	SearchReportsResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {z} from 'zod';

export type Report = z.infer<typeof ReportAdminResponseSchema>;

export async function listReports(
	config: Config,
	session: Session,
	status: number,
	limit: number,
	offset?: number,
): Promise<ApiResult<z.infer<typeof ListReportsResponse>>> {
	const client = new ApiClient(config, session);
	const body: JsonObject = {
		status,
		limit,
		...(offset !== undefined ? {offset} : {}),
	};

	return client.post<z.infer<typeof ListReportsResponse>>('/admin/reports/list', body);
}

export async function resolveReport(
	config: Config,
	session: Session,
	reportId: string,
	publicComment?: string,
	auditLogReason?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	const body: JsonObject = {
		report_id: reportId,
		...(publicComment !== undefined ? {public_comment: publicComment} : {}),
	};
	return client.postVoid('/admin/reports/resolve', body, auditLogReason);
}

export async function searchReports(
	config: Config,
	session: Session,
	query?: string,
	statusFilter?: number,
	typeFilter?: number,
	categoryFilter?: string,
	limit: number = 25,
	offset: number = 0,
): Promise<ApiResult<z.infer<typeof SearchReportsResponse>>> {
	const client = new ApiClient(config, session);
	const body: JsonObject = {
		limit,
		offset,
		...(query && query !== '' ? {query} : {}),
		...(statusFilter !== undefined ? {status: statusFilter} : {}),
		...(typeFilter !== undefined ? {report_type: typeFilter} : {}),
		...(categoryFilter && categoryFilter !== '' ? {category: categoryFilter} : {}),
	};

	return client.post<z.infer<typeof SearchReportsResponse>>('/admin/reports/search', body);
}

export async function getReportDetail(config: Config, session: Session, reportId: string): Promise<ApiResult<Report>> {
	const client = new ApiClient(config, session);
	return client.get<Report>(`/admin/reports/${reportId}`);
}
