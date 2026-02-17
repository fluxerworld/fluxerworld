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

import type {DateInput} from '@fluxer/date_utils/src/DateTypes';

export function parseDate(input: DateInput): Date {
	if (input instanceof Date) {
		if (Number.isNaN(input.getTime())) {
			return new Date();
		}
		return input;
	}
	if (typeof input === 'string') {
		const date = new Date(input);
		if (Number.isNaN(date.getTime())) {
			return new Date();
		}
		return date;
	}
	if (input == null || Number.isNaN(input)) {
		return new Date();
	}
	return new Date(input);
}

export function isValidDate(input: DateInput): boolean {
	if (input instanceof Date) {
		return !Number.isNaN(input.getTime());
	}
	if (typeof input === 'string') {
		return !Number.isNaN(new Date(input).getTime());
	}
	if (typeof input === 'number') {
		return !Number.isNaN(input) && Number.isFinite(input);
	}
	return false;
}

export function extractDatePart(isoString: string): string {
	const parts = isoString.split('T');
	const datePart = parts[0];
	if (datePart) {
		return datePart;
	}
	return isoString;
}

export function extractTimePart(isoString: string): string {
	const parts = isoString.split('T');
	if (parts.length !== 2) {
		return isoString;
	}

	const timePart = parts[1];
	if (!timePart) {
		return isoString;
	}
	let timeClean = timePart.split('.')[0] ?? timePart;
	timeClean = timeClean.replace('Z', '');

	const timeParts = timeClean.split(':');
	if (timeParts.length >= 2) {
		const [hour, minute] = timeParts;
		return `${hour}:${minute}`;
	}

	return isoString;
}
