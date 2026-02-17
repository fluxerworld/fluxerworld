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

export type ConfigObject = Record<string, unknown>;

export function isPlainObject(value: unknown): value is ConfigObject {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deepMerge(target: ConfigObject, source: ConfigObject): ConfigObject {
	const result = {...target};

	for (const key in source) {
		const sourceValue = source[key];
		const targetValue = result[key];

		if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
			result[key] = deepMerge(targetValue, sourceValue);
		} else {
			result[key] = sourceValue;
		}
	}

	return result;
}
