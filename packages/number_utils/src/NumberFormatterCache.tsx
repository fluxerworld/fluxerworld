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

const numberFormatterCache = new Map<string, Intl.NumberFormat>();

export function getNumberFormatter(
	locale: string,
	numberFormatOptions: Intl.NumberFormatOptions = {},
): Intl.NumberFormat {
	const cacheKey = buildFormatterCacheKey(locale, numberFormatOptions);
	const cachedFormatter = numberFormatterCache.get(cacheKey);
	if (cachedFormatter !== undefined) {
		return cachedFormatter;
	}

	const formatter = new Intl.NumberFormat(locale, numberFormatOptions);
	numberFormatterCache.set(cacheKey, formatter);
	return formatter;
}

function buildFormatterCacheKey(locale: string, numberFormatOptions: Intl.NumberFormatOptions): string {
	const optionEntries = Object.entries(numberFormatOptions)
		.filter(([, value]) => value !== undefined)
		.sort(([left], [right]) => left.localeCompare(right));
	const optionKey = optionEntries.map(([key, value]) => `${key}:${String(value)}`).join('|');
	return `${locale}|${optionKey}`;
}
