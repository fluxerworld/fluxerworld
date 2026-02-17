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

const VERSION_PATTERN = /^\/v\d+/;

export function stripApiPrefix(path: string): string {
	if (path === '/api') {
		return '/';
	}

	if (path.startsWith('/api/')) {
		const afterApi = path.slice(4);
		if (VERSION_PATTERN.test(afterApi)) {
			const versionMatch = afterApi.match(VERSION_PATTERN);
			if (versionMatch) {
				const remaining = afterApi.slice(versionMatch[0].length);
				return remaining === '' ? '/' : remaining;
			}
		}
		return afterApi;
	}

	if (VERSION_PATTERN.test(path)) {
		const versionMatch = path.match(VERSION_PATTERN);
		if (versionMatch) {
			const remaining = path.slice(versionMatch[0].length);
			return remaining === '' ? '/' : remaining;
		}
	}

	return path;
}

export function normalizeRequestPath(path: string): string {
	let normalized = stripApiPrefix(path);
	if (normalized.length > 1 && normalized.endsWith('/')) {
		normalized = normalized.slice(0, -1);
	}
	return normalized;
}
