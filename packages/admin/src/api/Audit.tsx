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
import type {AuditLogsListResponseSchema} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {z} from 'zod';

type AuditLogsListResponse = z.infer<typeof AuditLogsListResponseSchema>;

export interface SearchAuditLogsParams {
	query: string | undefined;
	admin_user_id: string | undefined;
	target_id: string | undefined;
	limit: number;
	offset: number;
}

export async function searchAuditLogs(
	config: Config,
	session: Session,
	params: SearchAuditLogsParams,
): Promise<ApiResult<AuditLogsListResponse>> {
	const client = new ApiClient(config, session);
	const body: JsonObject = {
		limit: params.limit,
		offset: params.offset,
		...(params.query && params.query !== '' ? {query: params.query} : {}),
		...(params.admin_user_id && params.admin_user_id !== '' ? {admin_user_id: params.admin_user_id} : {}),
		...(params.target_id && params.target_id !== '' ? {target_id: params.target_id} : {}),
	};

	return client.post<AuditLogsListResponse>('/admin/audit-logs/search', body);
}
