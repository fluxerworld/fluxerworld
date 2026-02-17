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

function isEmptyObject(value: object): boolean {
	return Object.keys(value).length === 0;
}

export function normalizeValidatorValue(value: unknown, isRoot = true): unknown {
	if (typeof value === 'string' && value === '') {
		return null;
	}

	if (Array.isArray(value)) {
		return value.map((item) => normalizeValidatorValue(item, false));
	}

	if (value !== null && typeof value === 'object') {
		if (!isRoot && isEmptyObject(value)) {
			return null;
		}

		const processedValue = Object.fromEntries(
			Object.entries(value).map(([key, nestedValue]) => [key, normalizeValidatorValue(nestedValue, false)]),
		);

		if (!isRoot && Object.values(processedValue).every((nestedValue) => nestedValue === null)) {
			return null;
		}

		return processedValue;
	}

	return value;
}
