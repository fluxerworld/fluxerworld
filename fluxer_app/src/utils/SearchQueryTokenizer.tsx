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

const FILTER_PREFIX_REGEX = /^[a-zA-Z_]+:/;

const isFilterPrefix = (value: string): boolean => FILTER_PREFIX_REGEX.test(value);

const skipFilterValue = (query: string, startIndex: number): number => {
	const n = query.length;
	let i = startIndex;
	while (i < n && query[i] === ' ') {
		i++;
	}
	if (i >= n) return i;
	if (query[i] === '"') {
		i++;
		let escaped = false;
		while (i < n) {
			const ch = query[i];
			if (escaped) {
				escaped = false;
				i++;
				continue;
			}
			if (ch === '\\') {
				escaped = true;
				i++;
				continue;
			}
			if (ch === '"') {
				i++;
				break;
			}
			i++;
		}
		return i;
	}
	while (i < n && query[i] !== ' ') {
		i++;
	}
	return i;
};

export function tokenizeSearchQuery(query: string): Array<string> {
	const tokens: Array<string> = [];
	const n = query['length'];
	let i = 0;

	while (i < n) {
		while (i < n && query[i] === ' ') {
			i++;
		}
		if (i >= n) {
			break;
		}

		const remaining = query['slice'](i);
		if (isFilterPrefix(remaining)) {
			const colonIndex = remaining.indexOf(':');
			if (colonIndex !== -1) {
				i = skipFilterValue(query, i + colonIndex + 1);
				continue;
			}
		}

		if (query[i] === '"') {
			i++;
			let token = '';
			let escaped = false;
			while (i < n) {
				const ch = query[i];
				if (escaped) {
					token += ch;
					escaped = false;
					i++;
					continue;
				}
				if (ch === '\\') {
					escaped = true;
					i++;
					continue;
				}
				if (ch === '"') {
					i++;
					break;
				}
				token += ch;
				i++;
			}
			const trimmed = token.trim();
			if (trimmed) {
				tokens.push(trimmed);
			}
			continue;
		}

		let token = '';
		while (i < n && query[i] !== ' ' && query[i] !== '"') {
			token += query[i];
			i++;
		}
		const trimmed = token.trim();
		if (trimmed) {
			tokens.push(trimmed);
		}
	}

	return tokens;
}
