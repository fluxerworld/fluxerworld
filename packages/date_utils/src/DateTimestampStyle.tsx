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
import {localeUses12Hour} from '@fluxer/date_utils/src/DateHourCycle';
import {TimestampStyle} from '@fluxer/markdown_parser/src/types/Enums';

const TIMESTAMP_STYLE_OPTIONS: Record<string, Intl.DateTimeFormatOptions> = {
	[TimestampStyle.ShortTime]: {hour: 'numeric', minute: 'numeric'},
	[TimestampStyle.LongTime]: {hour: 'numeric', minute: 'numeric', second: 'numeric'},
	[TimestampStyle.ShortDate]: {year: 'numeric', month: 'numeric', day: 'numeric'},
	[TimestampStyle.LongDate]: {month: 'long', day: 'numeric', year: 'numeric'},
	[TimestampStyle.ShortDateTime]: {month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric'},
	[TimestampStyle.LongDateTime]: {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	},
	[TimestampStyle.ShortDateShortTime]: {
		month: 'numeric',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
	},
	[TimestampStyle.ShortDateMediumTime]: {
		month: 'numeric',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
	},
};

const DEFAULT_STYLE_OPTIONS: Intl.DateTimeFormatOptions = {
	month: 'long',
	day: 'numeric',
	year: 'numeric',
	hour: 'numeric',
	minute: 'numeric',
};

const STYLES_WITHOUT_HOUR_CYCLE: ReadonlySet<TimestampStyle> = new Set([
	TimestampStyle.ShortDate,
	TimestampStyle.LongDate,
]);

export function formatTimestampWithStyle(
	timestamp: number,
	style: TimestampStyle,
	locale: string,
	hour12?: boolean,
): string {
	const date = new Date(timestamp * 1000);
	const baseOptions = TIMESTAMP_STYLE_OPTIONS[style] ?? DEFAULT_STYLE_OPTIONS;
	const needsHourCycle = !STYLES_WITHOUT_HOUR_CYCLE.has(style);
	const options = needsHourCycle ? {...baseOptions, hour12: hour12 ?? localeUses12Hour(locale)} : baseOptions;
	return getDateFormatter(locale, options).format(date);
}
