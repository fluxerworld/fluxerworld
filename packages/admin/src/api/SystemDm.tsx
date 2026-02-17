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
import type {ListSystemDmJobsResponse, SystemDmJobResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';

export async function createSystemDmJob(
	config: Config,
	session: Session,
	content: string,
	registrationStart?: string,
	registrationEnd?: string,
	excludedGuildIds: Array<string> = [],
): Promise<ApiResult<SystemDmJobResponse>> {
	const client = new ApiClient(config, session);
	const body: JsonObject = {
		content,
		...(registrationStart ? {registration_start: registrationStart} : {}),
		...(registrationEnd ? {registration_end: registrationEnd} : {}),
		...(excludedGuildIds.length > 0 ? {excluded_guild_ids: excludedGuildIds} : {}),
	};

	return client.post<SystemDmJobResponse>('/admin/system-dm-jobs', body);
}

export async function listSystemDmJobs(
	config: Config,
	session: Session,
	limit: number = 25,
	beforeJobId?: string,
): Promise<ApiResult<ListSystemDmJobsResponse>> {
	const client = new ApiClient(config, session);
	return client.get<ListSystemDmJobsResponse>('/admin/system-dm-jobs', {
		limit,
		before_job_id: beforeJobId,
	});
}

export async function approveSystemDmJob(
	config: Config,
	session: Session,
	jobId: string,
): Promise<ApiResult<SystemDmJobResponse>> {
	const client = new ApiClient(config, session);
	return client.post<SystemDmJobResponse>(`/admin/system-dm-jobs/${jobId}/approve`, {});
}
