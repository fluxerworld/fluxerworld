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

import {MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, MS_PER_SECOND} from '@fluxer/date_utils/src/DateConstants';
import {parseDate} from '@fluxer/date_utils/src/DateParsing';
import type {DateInput} from '@fluxer/date_utils/src/DateTypes';

export function isSameDay(date1: DateInput, date2?: DateInput): boolean {
	const d1 = parseDate(date1);
	const d2 = date2 != null ? parseDate(date2) : new Date();
	return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

export function isYesterday(date: DateInput, now?: Date): boolean {
	const nowDate = now ?? new Date();
	const yesterday = new Date(nowDate);
	yesterday.setDate(yesterday.getDate() - 1);
	return isSameDay(date, yesterday);
}

export function getDaysBetween(date1: DateInput, date2: DateInput): number {
	const d1 = parseDate(date1);
	const d2 = parseDate(date2);
	const d1Start = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
	const d2Start = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
	return Math.round((d1Start.getTime() - d2Start.getTime()) / MS_PER_DAY);
}

export function getDaysDiff(date1: DateInput, date2: DateInput): number {
	return Math.floor((parseDate(date1).getTime() - parseDate(date2).getTime()) / MS_PER_DAY);
}

export function getHoursDiff(date1: DateInput, date2: DateInput): number {
	return Math.floor((parseDate(date1).getTime() - parseDate(date2).getTime()) / MS_PER_HOUR);
}

export function getMinutesDiff(date1: DateInput, date2: DateInput): number {
	return Math.floor((parseDate(date1).getTime() - parseDate(date2).getTime()) / MS_PER_MINUTE);
}

export function getSecondsDiff(date1: DateInput, date2: DateInput): number {
	return Math.floor((parseDate(date1).getTime() - parseDate(date2).getTime()) / MS_PER_SECOND);
}
