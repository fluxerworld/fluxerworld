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
import type {DiscoveryApplicationResponse} from '@fluxer/schema/src/domains/guild/GuildDiscoverySchemas';
import type {z} from 'zod';

type DiscoveryApplicationResponseType = z.infer<typeof DiscoveryApplicationResponse>;

export async function listDiscoveryApplications(
	config: Config,
	session: Session,
	status: string,
	limit?: number,
): Promise<ApiResult<Array<DiscoveryApplicationResponseType>>> {
	const client = new ApiClient(config, session);
	return await client.get<Array<DiscoveryApplicationResponseType>>('/admin/discovery/applications', {
		status,
		limit: limit ?? 25,
	});
}

export async function approveDiscoveryApplication(
	config: Config,
	session: Session,
	guildId: string,
	reason?: string,
): Promise<ApiResult<DiscoveryApplicationResponseType>> {
	const client = new ApiClient(config, session);
	return await client.post<DiscoveryApplicationResponseType>(
		`/admin/discovery/applications/${guildId}/approve`,
		reason ? {reason} : {},
	);
}

export async function rejectDiscoveryApplication(
	config: Config,
	session: Session,
	guildId: string,
	reason: string,
): Promise<ApiResult<DiscoveryApplicationResponseType>> {
	const client = new ApiClient(config, session);
	return await client.post<DiscoveryApplicationResponseType>(`/admin/discovery/applications/${guildId}/reject`, {
		reason,
	});
}

export async function removeFromDiscovery(
	config: Config,
	session: Session,
	guildId: string,
	reason: string,
): Promise<ApiResult<DiscoveryApplicationResponseType>> {
	const client = new ApiClient(config, session);
	return await client.post<DiscoveryApplicationResponseType>(`/admin/discovery/guilds/${guildId}/remove`, {reason});
}
