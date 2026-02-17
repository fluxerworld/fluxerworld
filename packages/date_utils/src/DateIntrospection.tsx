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

import {getDateFormatter} from '@fluxer/date_utils/src/DateFormatterCache';
import type {DateFieldType} from '@fluxer/date_utils/src/DateTypes';

export function getSystemTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getDateFieldOrder(locale: string): Array<DateFieldType> {
	const formatter = getDateFormatter(locale, {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});

	const parts = formatter.formatToParts(new Date(2000, 0, 1));
	const order: Array<DateFieldType> = [];

	for (const part of parts) {
		if (part.type === 'month' && !order.includes('month')) {
			order.push('month');
		} else if (part.type === 'day' && !order.includes('day')) {
			order.push('day');
		} else if (part.type === 'year' && !order.includes('year')) {
			order.push('year');
		}
	}

	return order;
}

export function getMonthNames(locale: string, format: 'long' | 'short' = 'long'): Array<string> {
	return Array.from({length: 12}, (_, index) => {
		const monthDate = new Date(2000, index, 1);
		return getDateFormatter(locale, {month: format}).format(monthDate);
	});
}
