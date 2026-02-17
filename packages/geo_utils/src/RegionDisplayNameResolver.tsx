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

import {Locales} from '@fluxer/constants/src/Locales';
import {normalizeRegionCode} from '@fluxer/geo_utils/src/RegionCodeValidation';

const DISPLAY_NAME_TYPE: Intl.DisplayNamesOptions['type'] = 'region';
const DISPLAY_NAME_FALLBACK: Intl.DisplayNamesOptions['fallback'] = 'none';

const displayNamesByLocale = new Map<string, Intl.DisplayNames>();

function resolveLocale(locale?: string): string {
	const trimmedLocale = locale?.trim();
	if (trimmedLocale && trimmedLocale.length > 0) {
		return trimmedLocale;
	}

	return Locales.EN_US;
}

function getDisplayNames(locale?: string): Intl.DisplayNames {
	const localeCode = resolveLocale(locale);
	const cachedDisplayNames = displayNamesByLocale.get(localeCode);
	if (cachedDisplayNames) {
		return cachedDisplayNames;
	}

	const displayNames = new Intl.DisplayNames([localeCode], {
		type: DISPLAY_NAME_TYPE,
		fallback: DISPLAY_NAME_FALLBACK,
	});
	displayNamesByLocale.set(localeCode, displayNames);
	return displayNames;
}

function resolveRegionDisplayNameFromFormatter(
	regionCode: string,
	displayNames: Intl.DisplayNames,
): string | undefined {
	const normalizedRegionCode = normalizeRegionCode(regionCode);
	if (!normalizedRegionCode) {
		return undefined;
	}

	return displayNames.of(normalizedRegionCode) ?? undefined;
}

export function resolveRegionDisplayName(regionCode: string, locale?: string): string | undefined {
	const displayNames = getDisplayNames(locale);
	return resolveRegionDisplayNameFromFormatter(regionCode, displayNames);
}

export function resolveRegionDisplayNames(
	regionCodes: ReadonlyArray<string>,
	locale?: string,
): Array<string | undefined> {
	const displayNames = getDisplayNames(locale);
	return regionCodes.map((regionCode) => resolveRegionDisplayNameFromFormatter(regionCode, displayNames));
}
