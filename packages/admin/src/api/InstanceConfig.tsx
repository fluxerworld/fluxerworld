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
	InstanceConfigResponse,
	InstanceConfigUpdateRequest,
	SnowflakeReservationEntry,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';

export async function getInstanceConfig(config: Config, session: Session): Promise<ApiResult<InstanceConfigResponse>> {
	const client = new ApiClient(config, session);
	return client.post<InstanceConfigResponse>('/admin/instance-config/get', {});
}

export async function updateInstanceConfig(
	config: Config,
	session: Session,
	update: InstanceConfigUpdateRequest,
): Promise<ApiResult<InstanceConfigResponse>> {
	const client = new ApiClient(config, session);
	return client.post<InstanceConfigResponse>('/admin/instance-config/update', update as JsonObject);
}

export async function listSnowflakeReservations(
	config: Config,
	session: Session,
): Promise<ApiResult<Array<SnowflakeReservationEntry>>> {
	const client = new ApiClient(config, session);
	const result = await client.post<{reservations: Array<SnowflakeReservationEntry>}>(
		'/admin/snowflake-reservations/list',
		{},
	);
	if (result.ok) {
		return {ok: true, data: result.data.reservations};
	}
	return result;
}

export async function addSnowflakeReservation(
	config: Config,
	session: Session,
	email: string,
	snowflake: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/snowflake-reservations/add', {email, snowflake});
}

export async function deleteSnowflakeReservation(
	config: Config,
	session: Session,
	email: string,
): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.postVoid('/admin/snowflake-reservations/delete', {email});
}
