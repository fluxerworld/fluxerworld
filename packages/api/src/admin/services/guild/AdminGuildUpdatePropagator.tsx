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

import type {GuildID} from '@fluxer/api/src/BrandedTypes';
import {mapGuildToGuildResponse} from '@fluxer/api/src/guild/GuildModel';
import type {IGuildDiscoveryRepository} from '@fluxer/api/src/guild/repositories/GuildDiscoveryRepository';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import {Logger} from '@fluxer/api/src/Logger';
import type {Guild} from '@fluxer/api/src/models/Guild';
import {getGuildSearchService} from '@fluxer/api/src/SearchFactory';
import type {GuildDiscoveryContext} from '@fluxer/api/src/search/guild/GuildSearchSerializer';
import {GuildFeatures} from '@fluxer/constants/src/GuildConstants';

interface AdminGuildUpdatePropagatorDeps {
	gatewayService: IGatewayService;
	discoveryRepository: IGuildDiscoveryRepository;
}

export class AdminGuildUpdatePropagator {
	constructor(private readonly deps: AdminGuildUpdatePropagatorDeps) {}

	async dispatchGuildUpdate(guildId: GuildID, updatedGuild: Guild): Promise<void> {
		const {gatewayService, discoveryRepository} = this.deps;
		await gatewayService.dispatchGuild({
			guildId,
			event: 'GUILD_UPDATE',
			data: mapGuildToGuildResponse(updatedGuild),
		});

		const guildSearchService = getGuildSearchService();
		if (guildSearchService) {
			let discoveryContext: GuildDiscoveryContext | undefined;
			if (updatedGuild.features.has(GuildFeatures.DISCOVERABLE)) {
				const discoveryRow = await discoveryRepository.findByGuildId(guildId);
				if (discoveryRow) {
					discoveryContext = {
						description: discoveryRow.description,
						categoryId: discoveryRow.category_type,
					};
				}
			}
			await guildSearchService.updateGuild(updatedGuild, discoveryContext).catch((error) => {
				Logger.error({guildId, error}, 'Failed to update guild in search after admin update');
			});
		}
	}
}
