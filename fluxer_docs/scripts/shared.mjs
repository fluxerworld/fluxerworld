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

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Escape text for use in markdown tables.
 * Replaces newlines with spaces, escapes pipe characters, and escapes angle brackets for MDX.
 */
export function escapeTableText(value) {
	return String(value).replaceAll('\n', ' ').replaceAll('|', '\\|').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Wrap a value in backticks for inline code.
 * Escapes any existing backticks in the value.
 */
export function wrapCode(value) {
	const text = String(value).replace(/`/g, '\\`');
	return `\`${text}\``;
}

/**
 * Convert a name to a lowercase anchor ID suitable for markdown links.
 * Replaces non-alphanumeric characters with hyphens.
 */
export function toAnchor(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * Read and parse a JSON file.
 */
export async function readJsonFile(filePath) {
	const content = await fs.readFile(filePath, 'utf8');
	return JSON.parse(content);
}

/**
 * Write content to a file, creating parent directories if needed.
 */
export async function writeFile(filePath, content) {
	await fs.mkdir(path.dirname(filePath), {recursive: true});
	await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Create MDX frontmatter from options.
 */
export function createFrontmatter(options) {
	const lines = ['---'];
	for (const [key, value] of Object.entries(options)) {
		if (value !== undefined && value !== null) {
			lines.push(`${key}: '${String(value).replace(/'/g, "''")}'`);
		}
	}
	lines.push('---');
	return lines.join('\n');
}

/**
 * Format a default value for display in documentation.
 */
export function formatDefault(value) {
	if (value === undefined) {
		return null;
	}
	if (value === '') {
		return wrapCode('""');
	}
	if (typeof value === 'boolean') {
		return wrapCode(String(value));
	}
	if (typeof value === 'number') {
		return wrapCode(String(value));
	}
	if (typeof value === 'string') {
		return wrapCode(value);
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return wrapCode('[]');
		}
		return wrapCode(JSON.stringify(value));
	}
	if (typeof value === 'object' && value !== null) {
		if (Object.keys(value).length === 0) {
			return wrapCode('{}');
		}
		return wrapCode(JSON.stringify(value));
	}
	return wrapCode(String(value));
}
