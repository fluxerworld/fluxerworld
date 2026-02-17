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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

const whitespaceRegex = /\s+/g;
const invalidSlugRegex = /[^\p{L}\p{N}\-._~]+/gu;
const collapseHyphenRegex = /-+/g;

export function createSlug(title: string): string {
	const lower = title.toLowerCase();
	const hyphened = lower.replace(whitespaceRegex, '-');
	const cleaned = hyphened.replace(invalidSlugRegex, '-');
	const collapsed = cleaned.replace(collapseHyphenRegex, '-');
	const trimmed = trimHyphens(collapsed);
	return trimmed.length === 0 ? 'article' : trimmed;
}

function trimHyphens(text: string): string {
	let start = 0;
	let end = text.length;

	while (start < end && text[start] === '-') {
		start += 1;
	}

	while (end > start && text[end - 1] === '-') {
		end -= 1;
	}

	return text.slice(start, end);
}
