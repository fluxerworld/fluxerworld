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

export function escapeXml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export function xmlTag(name: string, value: string | number | boolean | undefined | null, shouldEscape = true): string {
	if (value === undefined || value === null) {
		return '';
	}
	const stringValue = String(value);
	return `<${name}>${shouldEscape ? escapeXml(stringValue) : stringValue}</${name}>`;
}

export function xmlHeader(): string {
	return '<?xml version="1.0" encoding="UTF-8"?>\n';
}

export function formatISODate(date: Date): string {
	return date.toISOString();
}

export function formatAmzDate(date: Date): string {
	return date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

export function parseAmzDate(dateStr: string): Date | null {
	const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
	if (!match) {
		return null;
	}
	const [, year, month, day, hour, minute, second] = match;
	return new Date(
		Date.UTC(
			parseInt(year!, 10),
			parseInt(month!, 10) - 1,
			parseInt(day!, 10),
			parseInt(hour!, 10),
			parseInt(minute!, 10),
			parseInt(second!, 10),
		),
	);
}
