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
	GuildMemoryStatsResponse,
	NodeStatsResponse,
	ReloadAllGuildsResponse,
} from '@fluxer/schema/src/domains/admin/AdminSchemas';

export async function getGuildMemoryStats(
	config: Config,
	session: Session,
	limit: number = 25,
): Promise<ApiResult<GuildMemoryStatsResponse>> {
	const client = new ApiClient(config, session);
	return client.post<GuildMemoryStatsResponse>('/admin/gateway/memory-stats', {limit});
}

export async function reloadAllGuilds(
	config: Config,
	session: Session,
	guildIds: Array<string>,
): Promise<ApiResult<ReloadAllGuildsResponse>> {
	const client = new ApiClient(config, session);
	return client.post<ReloadAllGuildsResponse>('/admin/gateway/reload-all', {guild_ids: guildIds});
}

export async function getNodeStats(config: Config, session: Session): Promise<ApiResult<NodeStatsResponse>> {
	const client = new ApiClient(config, session);
	return client.get<NodeStatsResponse>('/admin/gateway/stats');
}
