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

import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';

const logger = new Logger('Discovery');

export interface DiscoveryGuild {
	id: string;
	name: string;
	icon: string | null;
	description: string | null;
	category_type: number;
	member_count: number;
	online_count: number;
	features: Array<string>;
	verification_level: number;
}

interface DiscoverySearchResponse {
	guilds: Array<DiscoveryGuild>;
	total: number;
}

interface DiscoveryCategory {
	id: number;
	name: string;
}

export async function searchGuilds(params: {
	query?: string;
	category?: number;
	sort_by?: string;
	limit: number;
	offset: number;
}): Promise<DiscoverySearchResponse> {
	const query: Record<string, string> = {
		limit: String(params.limit),
		offset: String(params.offset),
	};
	if (params.query) {
		query.query = params.query;
	}
	if (params.category !== undefined) {
		query.category = String(params.category);
	}
	if (params.sort_by) {
		query.sort_by = params.sort_by;
	}
	const response = await http.get<DiscoverySearchResponse>({
		url: Endpoints.DISCOVERY_GUILDS,
		query,
	});
	return response.body;
}

export async function getCategories(): Promise<Array<DiscoveryCategory>> {
	const response = await http.get<Array<DiscoveryCategory>>({
		url: Endpoints.DISCOVERY_CATEGORIES,
	});
	return response.body;
}

export async function joinGuild(guildId: string): Promise<void> {
	await http.post({
		url: Endpoints.DISCOVERY_JOIN(guildId),
	});
	logger.info('Joined guild via discovery', {guildId});
}
