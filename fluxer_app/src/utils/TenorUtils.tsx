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

function normaliseTenorSlugId(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const withoutLeadingSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
	if (withoutLeadingSlash.toLowerCase().startsWith('view/')) {
		return withoutLeadingSlash.replace(/\/+$/, '');
	}

	if (!withoutLeadingSlash.includes('/')) {
		return `view/${withoutLeadingSlash.replace(/\/+$/, '')}`;
	}

	return null;
}

export function extractTenorSlugId(url: string): string | null {
	try {
		const parsedUrl = new URL(url);
		const hostname = parsedUrl.hostname.toLowerCase();
		if (hostname !== 'tenor.com' && hostname !== 'www.tenor.com') {
			return null;
		}

		const match = parsedUrl.pathname.match(/^\/view\/([^/]+)/i);
		if (!match?.[1]) {
			return null;
		}

		const slugId = decodeURIComponent(match[1]).trim();
		if (!slugId) {
			return null;
		}

		return `view/${slugId}`;
	} catch {
		return normaliseTenorSlugId(url);
	}
}

export function buildTenorShareUrl(tenorSlugId: string): string {
	const normalized = normaliseTenorSlugId(tenorSlugId) ?? tenorSlugId.trim();
	const withoutLeadingSlash = normalized.startsWith('/') ? normalized.slice(1) : normalized;
	return `https://tenor.com/${withoutLeadingSlash}`;
}
