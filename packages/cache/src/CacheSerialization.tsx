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

import type {CacheLogger} from '@fluxer/cache/src/CacheProviderTypes';

export function safeJsonParse<T>(value: string, logger?: CacheLogger): T | null {
	try {
		return JSON.parse(value);
	} catch (error) {
		if (logger) {
			const truncatedValue = value.length > 200 ? `${value.substring(0, 200)}...` : value;
			const errorMessage = error instanceof Error ? error.message : String(error);
			logger.error({errorMessage, value: truncatedValue}, '[CacheProvider] JSON parse error');
		}
		return null;
	}
}

export function serializeValue<T>(value: T): string {
	return JSON.stringify(value);
}
