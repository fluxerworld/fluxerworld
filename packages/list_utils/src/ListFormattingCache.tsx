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

import type {ResolvedListFormatterConfig} from '@fluxer/list_utils/src/ListFormattingTypes';

const formatterCache = new Map<string, Intl.ListFormat>();

export function getCachedListFormatter(config: ResolvedListFormatterConfig): Intl.ListFormat {
	const cacheKey = `${config.locale}:${config.style}:${config.type}`;
	const cachedFormatter = formatterCache.get(cacheKey);
	if (cachedFormatter != null) {
		return cachedFormatter;
	}

	const formatter = new Intl.ListFormat(config.locale, {
		style: config.style,
		type: config.type,
	});

	formatterCache.set(cacheKey, formatter);
	return formatter;
}
