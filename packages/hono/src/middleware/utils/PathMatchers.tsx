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

export function matchesPathPattern(path: string, pattern: string): boolean {
	if (pattern.endsWith('*')) {
		return path.startsWith(pattern.slice(0, -1));
	}

	return path === pattern;
}

export function matchesAnyPathPattern(path: string, patterns: Array<string>): boolean {
	for (const pattern of patterns) {
		if (matchesPathPattern(path, pattern)) {
			return true;
		}
	}

	return false;
}

export function matchesExactOrNestedPath(path: string, prefix: string): boolean {
	return path === prefix || path.startsWith(`${prefix}/`);
}

export function matchesAnyExactOrNestedPath(path: string, prefixes: Array<string>): boolean {
	for (const prefix of prefixes) {
		if (matchesExactOrNestedPath(path, prefix)) {
			return true;
		}
	}

	return false;
}
