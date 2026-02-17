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

export interface Frontmatter {
	data: Record<string, string>;
	content: string;
}

export function parseFrontmatter(markdown: string): Frontmatter {
	if (markdown.startsWith('---\n')) {
		return parseWithFrontmatter(markdown);
	}
	return {data: {}, content: markdown};
}

export function getString(frontmatter: Frontmatter, key: string): string | null {
	return frontmatter.data[key] ?? null;
}

export function getStringOr(frontmatter: Frontmatter, key: string, fallback: string): string {
	return getString(frontmatter, key) ?? fallback;
}

export function getInt(frontmatter: Frontmatter, key: string): number | null {
	const value = getString(frontmatter, key);
	if (!value) return null;
	const parsed = Number.parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

export function getIntOr(frontmatter: Frontmatter, key: string, fallback: number): number {
	return getInt(frontmatter, key) ?? fallback;
}

export function getContent(frontmatter: Frontmatter): string {
	return frontmatter.content;
}

function parseWithFrontmatter(markdown: string): Frontmatter {
	const withoutFirst = markdown.slice(4);
	const splitIndex = withoutFirst.indexOf('\n---\n');
	if (splitIndex === -1) {
		return {data: {}, content: markdown};
	}
	const frontmatterText = withoutFirst.slice(0, splitIndex);
	const content = withoutFirst.slice(splitIndex + 5);
	const data = parseFrontmatterText(frontmatterText);
	return {data, content: content.trim()};
}

function parseFrontmatterText(text: string): Record<string, string> {
	const entries = text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map(parseFrontmatterLine)
		.filter((entry): entry is [string, string] => entry !== null);
	return Object.fromEntries(entries);
}

function parseFrontmatterLine(line: string): [string, string] | null {
	const separatorIndex = line.indexOf(':');
	if (separatorIndex === -1) return null;
	const key = line.slice(0, separatorIndex).trim();
	const value = line.slice(separatorIndex + 1).trim();
	if (key.length === 0) return null;
	return [key, value];
}
