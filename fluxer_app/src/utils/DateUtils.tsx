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

import AccessibilityStore from '@app/stores/AccessibilityStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import {getCurrentLocale} from '@app/utils/LocaleUtils';
import {TimeFormatTypes} from '@fluxer/constants/src/UserConstants';
import {
	getFormattedCompactDateTime as getFormattedCompactDateTimeBase,
	getFormattedDateTime as getFormattedDateTimeBase,
	getFormattedDateTimeWithSeconds as getFormattedDateTimeWithSecondsBase,
	getFormattedFullDate as getFormattedFullDateBase,
	getFormattedShortDate as getFormattedShortDateBase,
	getFormattedTime as getFormattedTimeBase,
	getRelativeDateString as getRelativeDateStringBase,
} from '@fluxer/date_utils/src/DateFormatting';
import {localeUses12Hour} from '@fluxer/date_utils/src/DateHourCycle';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';

export function shouldUse12HourFormat(locale: string): boolean {
	const timeFormat = UserSettingsStore.getTimeFormat();
	switch (timeFormat) {
		case TimeFormatTypes.TWELVE_HOUR:
			return true;
		case TimeFormatTypes.TWENTY_FOUR_HOUR:
			return false;
		default: {
			const useBrowserLocale = AccessibilityStore.useBrowserLocaleForTimeFormat;
			const effectiveLocale = useBrowserLocale ? navigator.language : locale;
			return localeUses12Hour(effectiveLocale);
		}
	}
}

export function getRelativeDateString(timestamp: number | Date | string, i18n: I18n): string {
	const locale = getCurrentLocale();
	const hour12 = shouldUse12HourFormat(locale);
	const baseString = getRelativeDateStringBase(timestamp, locale, hour12);

	const date = new Date(
		typeof timestamp === 'string' || typeof timestamp === 'number' ? new Date(timestamp) : timestamp,
	);

	if (baseString.startsWith('Today at ')) {
		const timeString = getFormattedTimeBase(date, locale, hour12);
		return i18n._(msg`Today at ${timeString}`);
	}
	if (baseString.startsWith('Yesterday at ')) {
		const timeString = getFormattedTimeBase(date, locale, hour12);
		return i18n._(msg`Yesterday at ${timeString}`);
	}

	return baseString;
}

export function getFormattedDateTime(timestamp: number | Date | string): string {
	const locale = getCurrentLocale();
	const hour12 = shouldUse12HourFormat(locale);
	return getFormattedDateTimeBase(timestamp, locale, hour12);
}

export function getFormattedShortDate(timestamp: number | Date | string): string {
	const locale = getCurrentLocale();
	return getFormattedShortDateBase(timestamp, locale);
}

export function getFormattedTime(timestamp: number | Date | string): string {
	const locale = getCurrentLocale();
	const hour12 = shouldUse12HourFormat(locale);
	return getFormattedTimeBase(timestamp, locale, hour12);
}

export function getFormattedCompactDateTime(timestamp: number | Date | string): string {
	const locale = getCurrentLocale();
	const hour12 = shouldUse12HourFormat(locale);
	return getFormattedCompactDateTimeBase(timestamp, locale, hour12);
}

export function getFormattedFullDate(timestamp: number | Date | string): string {
	const locale = getCurrentLocale();
	return getFormattedFullDateBase(timestamp, locale);
}

export function getFormattedDateTimeWithSeconds(timestamp: number | Date | string): string {
	const locale = getCurrentLocale();
	const hour12 = shouldUse12HourFormat(locale);
	return getFormattedDateTimeWithSecondsBase(timestamp, locale, hour12);
}
