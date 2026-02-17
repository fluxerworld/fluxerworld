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
	AdminArchiveResponseSchema,
	DownloadUrlResponseSchema,
	ListArchivesResponseSchema,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {z} from 'zod';

export type Archive = z.infer<typeof AdminArchiveResponseSchema>;
export type ListArchivesResponse = z.infer<typeof ListArchivesResponseSchema>;
export type ArchiveDownloadUrlResponse = z.infer<typeof DownloadUrlResponseSchema>;

export async function triggerUserArchive(
	config: Config,
	session: Session,
	userId: string,
	reason?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/archives/user', {user_id: userId}, reason);
}

export async function triggerGuildArchive(
	config: Config,
	session: Session,
	guildId: string,
	reason?: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/archives/guild', {guild_id: guildId}, reason);
}

export async function listArchives(
	config: Config,
	session: Session,
	subjectType: string,
	subjectId?: string,
	includeExpired: boolean = false,
	requestedBy?: string,
): Promise<ApiResult<ListArchivesResponse>> {
	const client = new ApiClient(config, session);
	const body: JsonObject = {
		subject_type: subjectType,
		include_expired: includeExpired,
		...(subjectId ? {subject_id: subjectId} : {}),
		...(requestedBy ? {requested_by: requestedBy} : {}),
	};

	return client.post<ListArchivesResponse>('/admin/archives/list', body);
}

export async function getArchiveDownloadUrl(
	config: Config,
	session: Session,
	subjectType: string,
	subjectId: string,
	archiveId: string,
): Promise<ApiResult<ArchiveDownloadUrlResponse>> {
	const client = new ApiClient(config, session);
	return client.get<ArchiveDownloadUrlResponse>(`/admin/archives/${subjectType}/${subjectId}/${archiveId}/download`);
}
