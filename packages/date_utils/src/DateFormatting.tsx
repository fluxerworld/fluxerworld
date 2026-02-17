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

import {isSameDay} from '@fluxer/date_utils/src/DateComparison';
import {DEFAULT_LOCALE} from '@fluxer/date_utils/src/DateConstants';
import {getDateFormatter} from '@fluxer/date_utils/src/DateFormatterCache';
import {localeUses12Hour} from '@fluxer/date_utils/src/DateHourCycle';
import {parseDate} from '@fluxer/date_utils/src/DateParsing';
import type {DateInput} from '@fluxer/date_utils/src/DateTypes';

function resolveHour12(locale: string, hour12?: boolean): boolean {
	return hour12 ?? localeUses12Hour(locale);
}

export function formatDate(
	date: DateInput,
	options: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	},
	locale: string = DEFAULT_LOCALE,
): string {
	const dateObj = parseDate(date);
	if (Number.isNaN(dateObj.getTime())) {
		return String(date);
	}
	return getDateFormatter(locale, options).format(dateObj);
}

export function formatTimestamp(
	timestamp: string,
	locale: string = DEFAULT_LOCALE,
	options: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	},
): string {
	const date = parseDate(timestamp);
	if (Number.isNaN(date.getTime())) {
		return timestamp;
	}
	return getDateFormatter(locale, options).format(date);
}

export function getFormattedDateTime(timestamp: DateInput, locale: string = DEFAULT_LOCALE, hour12?: boolean): string {
	const date = parseDate(timestamp);
	return getDateFormatter(locale, {
		month: 'numeric',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: resolveHour12(locale, hour12),
	}).format(date);
}

export function getFormattedDateTimeInZone(
	isoString: string,
	timezone: string,
	locale: string = DEFAULT_LOCALE,
	hour12?: boolean,
): string {
	try {
		const date = new Date(isoString);
		if (Number.isNaN(date.getTime())) {
			return isoString;
		}
		return getDateFormatter(locale, {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: resolveHour12(locale, hour12),
			timeZone: timezone,
		}).format(date);
	} catch {
		return isoString;
	}
}

export function getFormattedShortDate(timestamp: DateInput, locale: string = DEFAULT_LOCALE): string {
	return getDateFormatter(locale, {month: 'short', day: 'numeric', year: 'numeric'}).format(parseDate(timestamp));
}

export function getFormattedLongDate(timestamp: DateInput, locale: string = DEFAULT_LOCALE): string {
	return getDateFormatter(locale, {month: 'long', day: 'numeric', year: 'numeric'}).format(parseDate(timestamp));
}

export function getFormattedTime(timestamp: DateInput, locale: string = DEFAULT_LOCALE, hour12?: boolean): string {
	return getDateFormatter(locale, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: resolveHour12(locale, hour12),
	}).format(parseDate(timestamp));
}

export function getFormattedCompactDateTime(
	timestamp: DateInput,
	locale: string = DEFAULT_LOCALE,
	hour12?: boolean,
): string {
	const date = parseDate(timestamp);
	const datePart = getDateFormatter('en-US', {month: 'numeric', day: 'numeric', year: '2-digit'}).format(date);
	const timePart = getDateFormatter(locale, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: resolveHour12(locale, hour12),
	}).format(date);
	return `${datePart}, ${timePart}`;
}

export function getFormattedFullDate(timestamp: DateInput, locale: string = DEFAULT_LOCALE): string {
	return getDateFormatter(locale, {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	}).format(parseDate(timestamp));
}

export function getFormattedDateTimeWithSeconds(
	timestamp: DateInput,
	locale: string = DEFAULT_LOCALE,
	hour12?: boolean,
): string {
	const date = parseDate(timestamp);
	const use12Hour = resolveHour12(locale, hour12);
	const datePart = getDateFormatter(locale, {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	}).format(date);
	const timePart = getDateFormatter(locale, {
		hour: 'numeric',
		minute: '2-digit',
		second: '2-digit',
		hour12: use12Hour,
	}).format(date);
	return `${datePart} ${timePart}`;
}

export function getRelativeDateString(
	timestamp: DateInput,
	locale: string = DEFAULT_LOCALE,
	hour12?: boolean,
	now?: Date,
): string {
	const date = parseDate(timestamp);
	const nowDate = now ?? new Date();
	const use12Hour = resolveHour12(locale, hour12);

	const timeString = getDateFormatter(locale, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: use12Hour,
	}).format(date);

	if (isSameDay(date, nowDate)) {
		return `Today at ${timeString}`;
	}
	const yesterday = new Date(nowDate);
	yesterday.setDate(yesterday.getDate() - 1);
	if (isSameDay(date, yesterday)) {
		return `Yesterday at ${timeString}`;
	}

	return getDateFormatter(locale, {
		month: 'numeric',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: use12Hour,
	}).format(date);
}

export function formatLastActive(date: DateInput, locale: string = DEFAULT_LOCALE): string {
	const dateObj = parseDate(date);
	if (Number.isNaN(dateObj.getTime())) {
		return String(date);
	}
	return getDateFormatter(locale, {dateStyle: 'medium', timeStyle: 'short'}).format(dateObj);
}

export function formatScheduledMessage(date: DateInput, locale: string = DEFAULT_LOCALE, timeZone?: string): string {
	const dateObj = parseDate(date);
	if (Number.isNaN(dateObj.getTime())) {
		return String(date);
	}
	return getDateFormatter(locale, {dateStyle: 'medium', timeStyle: 'short', timeZone}).format(dateObj);
}
