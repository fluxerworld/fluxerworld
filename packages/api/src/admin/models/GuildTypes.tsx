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

import {mapGuildFeatures} from '@fluxer/api/src/guild/GuildFeatureUtils';
import type {Guild} from '@fluxer/api/src/models/Guild';
import type {GuildAdminResponse, ListUserGuildsResponse} from '@fluxer/schema/src/domains/admin/AdminGuildSchemas';

export function mapGuildToAdminResponse(guild: Guild): GuildAdminResponse {
	return {
		id: guild.id.toString(),
		name: guild.name,
		features: mapGuildFeatures(guild.features),
		owner_id: guild.ownerId.toString(),
		icon: guild.iconHash,
		banner: guild.bannerHash,
		member_count: guild.memberCount,
	};
}

export function mapGuildsToAdminResponse(guilds: Array<Guild>): ListUserGuildsResponse {
	return {
		guilds: [
			...guilds.map((guild) => {
				return {
					id: guild.id.toString(),
					name: guild.name,
					features: mapGuildFeatures(guild.features),
					owner_id: guild.ownerId.toString(),
					icon: guild.iconHash,
					banner: guild.bannerHash,
					member_count: guild.memberCount,
				};
			}),
		],
	};
}
