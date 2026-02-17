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
import type {Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import type {
	IndexRefreshStatusResponse,
	RefreshSearchIndexResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';

export async function refreshSearchIndex(
	config: Config,
	session: Session,
	indexType: string,
	reason?: string,
): Promise<ApiResult<RefreshSearchIndexResponse>> {
	return refreshSearchIndexWithGuild(config, session, indexType, undefined, reason);
}

export async function refreshSearchIndexWithGuild(
	config: Config,
	session: Session,
	indexType: string,
	guildId?: string,
	reason?: string,
): Promise<ApiResult<RefreshSearchIndexResponse>> {
	const client = new ApiClient(config, session);
	const body: Record<string, string> = {
		index_type: indexType,
		...(guildId ? {guild_id: guildId} : {}),
	};
	return client.post<RefreshSearchIndexResponse>('/admin/search/refresh-index', body, reason);
}

export async function getIndexRefreshStatus(
	config: Config,
	session: Session,
	jobId: string,
): Promise<ApiResult<IndexRefreshStatusResponse>> {
	const client = new ApiClient(config, session);
	return client.post<IndexRefreshStatusResponse>('/admin/search/refresh-status', {job_id: jobId});
}
