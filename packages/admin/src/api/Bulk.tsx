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
import type {BulkOperationResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';
import type {z} from 'zod';

type BulkOperationResponseType = z.infer<typeof BulkOperationResponse>;

export async function bulkUpdateUserFlags(
	config: Config,
	session: Session,
	user_ids: Array<string>,
	add_flags: Array<string>,
	remove_flags: Array<string>,
	audit_log_reason?: string,
): Promise<ApiResult<BulkOperationResponseType>> {
	const client = new ApiClient(config, session);
	return client.post<BulkOperationResponseType>(
		'/admin/bulk/update-user-flags',
		{
			user_ids,
			add_flags,
			remove_flags,
		},
		audit_log_reason,
	);
}

export async function bulkUpdateGuildFeatures(
	config: Config,
	session: Session,
	guild_ids: Array<string>,
	add_features: Array<string>,
	remove_features: Array<string>,
	audit_log_reason?: string,
): Promise<ApiResult<BulkOperationResponseType>> {
	const client = new ApiClient(config, session);
	return client.post<BulkOperationResponseType>(
		'/admin/bulk/update-guild-features',
		{
			guild_ids,
			add_features,
			remove_features,
		},
		audit_log_reason,
	);
}

export async function bulkAddGuildMembers(
	config: Config,
	session: Session,
	guild_id: string,
	user_ids: Array<string>,
	audit_log_reason?: string,
): Promise<ApiResult<BulkOperationResponseType>> {
	const client = new ApiClient(config, session);
	return client.post<BulkOperationResponseType>(
		'/admin/bulk/add-guild-members',
		{
			guild_id,
			user_ids,
		},
		audit_log_reason,
	);
}

export async function bulkScheduleUserDeletion(
	config: Config,
	session: Session,
	user_ids: Array<string>,
	reason_code: number,
	days_until_deletion: number,
	public_reason?: string,
	audit_log_reason?: string,
): Promise<ApiResult<BulkOperationResponseType>> {
	const client = new ApiClient(config, session);
	const body: JsonObject = {
		user_ids,
		reason_code,
		days_until_deletion,
		...(public_reason ? {public_reason} : {}),
	};
	return client.post<BulkOperationResponseType>('/admin/bulk/schedule-user-deletion', body, audit_log_reason);
}
