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

import type {RelayInfo} from '@app/repositories/RelayRepository';

const EARTH_RADIUS_KM = 6371;

export interface GeoLocation {
	latitude: number;
	longitude: number;
}

export interface RelayWithDistance extends RelayInfo {
	distance_km: number;
}

export interface IGeoSelectionService {
	calculateDistance(from: GeoLocation, to: GeoLocation): number;
	sortByProximity(relays: Array<RelayInfo>, clientLocation: GeoLocation): Array<RelayWithDistance>;
	selectNearestRelays(relays: Array<RelayInfo>, clientLocation: GeoLocation, limit: number): Array<RelayWithDistance>;
}

export class GeoSelectionService implements IGeoSelectionService {
	calculateDistance(from: GeoLocation, to: GeoLocation): number {
		const lat1Rad = this.toRadians(from.latitude);
		const lat2Rad = this.toRadians(to.latitude);
		const deltaLat = this.toRadians(to.latitude - from.latitude);
		const deltaLon = this.toRadians(to.longitude - from.longitude);

		const a =
			Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
			Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		return EARTH_RADIUS_KM * c;
	}

	sortByProximity(relays: Array<RelayInfo>, clientLocation: GeoLocation): Array<RelayWithDistance> {
		const relaysWithDistance: Array<RelayWithDistance> = relays.map((relay) => ({
			...relay,
			distance_km: this.calculateDistance(clientLocation, {
				latitude: relay.latitude,
				longitude: relay.longitude,
			}),
		}));

		relaysWithDistance.sort((a, b) => a.distance_km - b.distance_km);

		return relaysWithDistance;
	}

	selectNearestRelays(relays: Array<RelayInfo>, clientLocation: GeoLocation, limit: number): Array<RelayWithDistance> {
		const sorted = this.sortByProximity(relays, clientLocation);
		return sorted.slice(0, limit);
	}

	private toRadians(degrees: number): number {
		return degrees * (Math.PI / 180);
	}
}
