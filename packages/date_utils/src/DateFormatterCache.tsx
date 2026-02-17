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

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function buildCacheKey(locale: string, options: Intl.DateTimeFormatOptions): string {
	return `${locale}:${JSON.stringify(options)}`;
}

export function getDateFormatter(locale: string, options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
	const key = buildCacheKey(locale, options);
	const cached = formatterCache.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const formatter = new Intl.DateTimeFormat(locale, options);
	formatterCache.set(key, formatter);
	return formatter;
}
