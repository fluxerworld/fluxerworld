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

import {
	DAYS_PER_MONTH,
	DAYS_PER_WEEK,
	DAYS_PER_YEAR,
	HOURS_PER_DAY,
	MINUTES_PER_HOUR,
	SECONDS_PER_HOUR,
	SECONDS_PER_MINUTE,
} from '@fluxer/date_utils/src/DateConstants';
import {parseDate} from '@fluxer/date_utils/src/DateParsing';
import type {DateInput} from '@fluxer/date_utils/src/DateTypes';

export function formatDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) {
		return '0:00';
	}

	const hours = Math.floor(seconds / SECONDS_PER_HOUR);
	const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
	const secs = Math.floor(seconds % SECONDS_PER_MINUTE);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatShortRelativeTime(timestamp: DateInput, minUnit: '1m' | 'now' = 'now'): string {
	const date = parseDate(timestamp);
	const now = new Date();
	const diffMs = date.getTime() - now.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / SECONDS_PER_MINUTE);
	const diffHours = Math.floor(diffMinutes / MINUTES_PER_HOUR);
	const diffDays = Math.floor(diffHours / HOURS_PER_DAY);

	if (Math.abs(diffSeconds) < SECONDS_PER_MINUTE) {
		return minUnit === '1m' ? '1m' : 'now';
	}
	if (Math.abs(diffMinutes) < MINUTES_PER_HOUR) {
		return `${Math.abs(diffMinutes)}m`;
	}
	if (Math.abs(diffHours) < HOURS_PER_DAY) {
		return `${Math.abs(diffHours)}h`;
	}
	if (Math.abs(diffDays) < DAYS_PER_WEEK) {
		return `${Math.abs(diffDays)}d`;
	}
	if (Math.abs(diffDays) < DAYS_PER_MONTH) {
		return `${Math.floor(Math.abs(diffDays) / DAYS_PER_WEEK)}w`;
	}
	if (Math.abs(diffDays) < DAYS_PER_YEAR) {
		return `${Math.floor(Math.abs(diffDays) / DAYS_PER_MONTH)}mo`;
	}
	return `${Math.floor(Math.abs(diffDays) / DAYS_PER_YEAR)}y`;
}
