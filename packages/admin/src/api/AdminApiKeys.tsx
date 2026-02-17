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
import type {CreateAdminApiKeyResponse, ListAdminApiKeyResponse} from '@fluxer/schema/src/domains/admin/AdminSchemas';

export async function createApiKey(
	config: Config,
	session: Session,
	name: string,
	acls: Array<string>,
): Promise<ApiResult<CreateAdminApiKeyResponse>> {
	const client = new ApiClient(config, session);
	return client.post<CreateAdminApiKeyResponse>('/admin/api-keys', {name, acls});
}

export async function listApiKeys(
	config: Config,
	session: Session,
): Promise<ApiResult<Array<ListAdminApiKeyResponse>>> {
	const client = new ApiClient(config, session);
	return client.get<Array<ListAdminApiKeyResponse>>('/admin/api-keys');
}

export async function revokeApiKey(config: Config, session: Session, key_id: string): Promise<ApiResult<void>> {
	const client = new ApiClient(config, session);
	return client.deleteVoid(`/admin/api-keys/${key_id}`);
}
