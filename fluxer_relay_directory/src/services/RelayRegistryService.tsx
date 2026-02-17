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

import {randomUUID} from 'node:crypto';
import type {IRelayRepository, RelayInfo} from '@app/repositories/RelayRepository';
import type {GeoLocation, IGeoSelectionService, RelayWithDistance} from '@app/services/GeoSelectionService';

export interface RegisterRelayRequest {
	name: string;
	url: string;
	latitude: number;
	longitude: number;
	region: string;
	capacity: number;
	public_key: string;
}

export interface IRelayRegistryService {
	registerRelay(request: RegisterRelayRequest): RelayInfo;
	getRelay(id: string): RelayInfo | null;
	getRelayStatus(id: string): RelayInfo | null;
	listRelays(clientLocation?: GeoLocation, limit?: number): Array<RelayInfo | RelayWithDistance>;
	updateRelayHeartbeat(id: string): void;
	removeRelay(id: string): void;
}

export class RelayRegistryService implements IRelayRegistryService {
	private readonly repository: IRelayRepository;
	private readonly geoService: IGeoSelectionService;

	constructor(repository: IRelayRepository, geoService: IGeoSelectionService) {
		this.repository = repository;
		this.geoService = geoService;
	}

	registerRelay(request: RegisterRelayRequest): RelayInfo {
		const now = new Date().toISOString();
		const relay: RelayInfo = {
			id: randomUUID(),
			name: request.name,
			url: request.url,
			latitude: request.latitude,
			longitude: request.longitude,
			region: request.region,
			capacity: request.capacity,
			current_connections: 0,
			public_key: request.public_key,
			registered_at: now,
			last_seen_at: now,
			healthy: true,
			failed_checks: 0,
		};

		this.repository.saveRelay(relay);
		return relay;
	}

	getRelay(id: string): RelayInfo | null {
		return this.repository.getRelay(id);
	}

	getRelayStatus(id: string): RelayInfo | null {
		return this.repository.getRelay(id);
	}

	listRelays(clientLocation?: GeoLocation, limit?: number): Array<RelayInfo | RelayWithDistance> {
		const healthyRelays = this.repository.getHealthyRelays();

		if (!clientLocation) {
			return limit ? healthyRelays.slice(0, limit) : healthyRelays;
		}

		if (limit) {
			return this.geoService.selectNearestRelays(healthyRelays, clientLocation, limit);
		}

		return this.geoService.sortByProximity(healthyRelays, clientLocation);
	}

	updateRelayHeartbeat(id: string): void {
		this.repository.updateRelayLastSeen(id);
	}

	removeRelay(id: string): void {
		this.repository.removeRelay(id);
	}
}
