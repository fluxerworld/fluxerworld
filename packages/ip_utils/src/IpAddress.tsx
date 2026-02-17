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

import {isIPv4, isIPv6} from 'node:net';

export type IpAddressFamily = 'ipv4' | 'ipv6';

export interface ParsedIpAddress {
	raw: string;
	normalized: string;
	family: IpAddressFamily;
}

function stripIpv6Brackets(value: string): string {
	if (value.startsWith('[') && value.endsWith(']')) {
		return value.slice(1, -1);
	}
	return value;
}

function stripIpv6ZoneIdentifier(value: string): string {
	const zoneIndex = value.indexOf('%');
	if (zoneIndex === -1) {
		return value;
	}

	const addressPart = value.slice(0, zoneIndex);
	if (!addressPart.includes(':')) {
		return value;
	}

	return addressPart;
}

function normalizeIpv6(value: string): string {
	if (!isIPv6(value)) {
		return value;
	}

	try {
		const hostname = new URL(`http://[${value}]`).hostname;
		if (hostname.startsWith('[') && hostname.endsWith(']')) {
			return hostname.slice(1, -1);
		}
		return hostname;
	} catch {
		return value;
	}
}

function getAddressFamily(value: string): IpAddressFamily | null {
	if (isIPv4(value)) {
		return 'ipv4';
	}
	if (isIPv6(value)) {
		return 'ipv6';
	}
	return null;
}

export function normalizeIpString(value: string): string {
	const trimmed = value.trim();
	const withoutBrackets = stripIpv6Brackets(trimmed);
	const withoutZone = stripIpv6ZoneIdentifier(withoutBrackets);
	return normalizeIpv6(withoutZone);
}

export function parseIpAddress(value: string): ParsedIpAddress | null {
	const normalized = normalizeIpString(value);
	const family = getAddressFamily(normalized);

	if (!family) {
		return null;
	}

	return {
		raw: value,
		normalized,
		family,
	};
}

export function isValidIp(value: string): boolean {
	return parseIpAddress(value) !== null;
}
