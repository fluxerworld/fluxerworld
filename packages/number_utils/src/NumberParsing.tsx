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

import {DEFAULT_NUMBER_FALLBACK} from '@fluxer/number_utils/src/NumberConstants';
import type {NumberInput} from '@fluxer/number_utils/src/NumberTypes';

export function parseNumberInput(value: NumberInput, fallbackValue: number = DEFAULT_NUMBER_FALLBACK): number {
	if (typeof value === 'number') {
		if (Number.isFinite(value)) {
			return value;
		}
		return fallbackValue;
	}

	if (typeof value === 'string') {
		const trimmedValue = value.trim();
		if (trimmedValue === '') {
			return fallbackValue;
		}

		const parsedValue = Number(trimmedValue);
		if (Number.isFinite(parsedValue)) {
			return parsedValue;
		}
	}

	return fallbackValue;
}
