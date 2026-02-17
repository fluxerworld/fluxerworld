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

import {calculateDistance, parseCoordinate} from '@fluxer/api/src/utils/GeoUtils';
import type {VoiceRegionAvailability} from '@fluxer/api/src/voice/VoiceModel';

export interface VoiceRegionPreference {
	regionId: string | null;
	mode: 'explicit' | 'automatic';
}

export function resolveVoiceRegionPreference({
	preferredRegionId,
	accessibleRegions,
	availableRegions,
	defaultRegionId,
}: {
	preferredRegionId: string | null;
	accessibleRegions: Array<VoiceRegionAvailability>;
	availableRegions: Array<VoiceRegionAvailability>;
	defaultRegionId: string | null;
}): VoiceRegionPreference {
	const accessibleRegionIds = new Set(accessibleRegions.map((region) => region.id));

	if (preferredRegionId) {
		if (accessibleRegionIds.has(preferredRegionId)) {
			return {regionId: preferredRegionId, mode: 'explicit'};
		}
		return {regionId: null, mode: 'automatic'};
	}

	if (defaultRegionId && accessibleRegionIds.has(defaultRegionId)) {
		return {regionId: defaultRegionId, mode: 'automatic'};
	}

	const defaultRegion =
		accessibleRegions.find((region) => region.isDefault) ?? availableRegions.find((region) => region.isDefault) ?? null;
	if (defaultRegion) {
		return {regionId: defaultRegion.id, mode: 'automatic'};
	}

	const fallbackRegion = accessibleRegions[0] ?? availableRegions[0] ?? null;
	return {regionId: fallbackRegion ? fallbackRegion.id : null, mode: 'automatic'};
}

export function selectVoiceRegionId({
	preferredRegionId,
	mode,
	accessibleRegions,
	availableRegions,
	latitude,
	longitude,
}: {
	preferredRegionId: string | null;
	mode: VoiceRegionPreference['mode'];
	accessibleRegions: Array<VoiceRegionAvailability>;
	availableRegions: Array<VoiceRegionAvailability>;
	latitude?: string;
	longitude?: string;
}): string | null {
	if (mode === 'automatic' && accessibleRegions.length > 0) {
		const closestRegionId = findClosestRegionId(latitude, longitude, accessibleRegions);
		if (closestRegionId) {
			return closestRegionId;
		}
	}

	if (preferredRegionId) {
		return preferredRegionId;
	}

	const accessibleFallback = accessibleRegions[0];
	if (accessibleFallback) {
		return accessibleFallback.id;
	}

	return availableRegions[0]?.id ?? null;
}

function findClosestRegionId(
	latitude: string | undefined,
	longitude: string | undefined,
	accessibleRegions: Array<VoiceRegionAvailability>,
): string | null {
	const userLat = parseCoordinate(latitude);
	const userLon = parseCoordinate(longitude);

	if (userLat === null || userLon === null) {
		return null;
	}

	let closestRegion: string | null = null;
	let minDistance = Number.POSITIVE_INFINITY;

	for (const region of accessibleRegions) {
		const distance = calculateDistance(userLat, userLon, region.latitude, region.longitude);
		if (distance < minDistance) {
			minDistance = distance;
			closestRegion = region.id;
		}
	}

	return closestRegion;
}
