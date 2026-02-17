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

import type {GuildID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {User} from '@fluxer/api/src/models/User';
import {mapPackToSummary} from '@fluxer/api/src/pack/PackModel';
import type {PackService} from '@fluxer/api/src/pack/PackService';
import type {
	PackCreateRequest,
	PackDashboardResponse,
	PackSummaryResponse,
	PackType,
	PackUpdateRequest,
} from '@fluxer/schema/src/domains/pack/PackSchemas';

interface PackListParams {
	userId: UserID;
}

interface PackCreateParams {
	user: User;
	type: PackType;
	data: PackCreateRequest;
}

interface PackUpdateParams {
	userId: UserID;
	packId: GuildID;
	data: PackUpdateRequest;
}

interface PackDeleteParams {
	userId: UserID;
	packId: GuildID;
}

export class PackRequestService {
	constructor(private readonly packService: PackService) {}

	async listUserPacks(params: PackListParams): Promise<PackDashboardResponse> {
		return this.packService.listUserPacks(params.userId);
	}

	async createPack(params: PackCreateParams): Promise<PackSummaryResponse> {
		const pack = await this.packService.createPack({
			user: params.user,
			type: params.type as 'emoji' | 'sticker',
			name: params.data.name,
			description: params.data.description ?? null,
		});
		return mapPackToSummary(pack);
	}

	async updatePack(params: PackUpdateParams): Promise<PackSummaryResponse> {
		const updated = await this.packService.updatePack({
			userId: params.userId,
			packId: params.packId,
			name: params.data.name,
			description: params.data.description,
		});
		return mapPackToSummary(updated);
	}

	async deletePack(params: PackDeleteParams): Promise<void> {
		await this.packService.deletePack(params.userId, params.packId);
	}

	async installPack(params: PackDeleteParams): Promise<void> {
		await this.packService.installPack(params.userId, params.packId);
	}

	async uninstallPack(params: PackDeleteParams): Promise<void> {
		await this.packService.uninstallPack(params.userId, params.packId);
	}
}
