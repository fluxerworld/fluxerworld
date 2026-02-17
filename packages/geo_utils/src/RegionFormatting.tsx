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

import {normalizeRegionCode} from '@fluxer/geo_utils/src/RegionCodeValidation';
import {resolveRegionDisplayName, resolveRegionDisplayNames} from '@fluxer/geo_utils/src/RegionDisplayNameResolver';

export interface RegionDisplayNameOptions {
	locale?: string;
	fallbackToRegionCode?: boolean;
}

function applyRegionCodeFallback(
	regionCode: string,
	displayName: string | undefined,
	options?: RegionDisplayNameOptions,
): string | undefined {
	if (displayName) {
		return displayName;
	}
	if (!options?.fallbackToRegionCode) {
		return undefined;
	}

	const normalizedRegionCode = normalizeRegionCode(regionCode);
	if (normalizedRegionCode) {
		return normalizedRegionCode;
	}

	const trimmedRegionCode = regionCode.trim();
	return trimmedRegionCode.length > 0 ? trimmedRegionCode : undefined;
}

export function getRegionDisplayName(regionCode: string, options?: RegionDisplayNameOptions): string | undefined {
	const displayName = resolveRegionDisplayName(regionCode, options?.locale);
	return applyRegionCodeFallback(regionCode, displayName, options);
}

export function getRegionDisplayNames(
	regionCodes: ReadonlyArray<string>,
	options?: RegionDisplayNameOptions,
): Array<string | undefined> {
	const displayNames = resolveRegionDisplayNames(regionCodes, options?.locale);

	return displayNames.map((displayName, index) => {
		const regionCode = regionCodes[index] ?? '';
		return applyRegionCodeFallback(regionCode, displayName, options);
	});
}
