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
import {fileURLToPath} from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '..');

/**
 * Slugify a string for URL use.
 */
function slugify(str) {
	return str
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

/**
 * Build a map of valid API reference URLs from OpenAPI spec.
 * Mintlify uses summary (slugified) for URLs, not operationId.
 */
async function buildValidUrlMap(openapiPath) {
	const content = await fs.readFile(openapiPath, 'utf-8');
	const openapi = JSON.parse(content);

	const validUrls = new Map();
	const operationIdToUrl = new Map();

	for (const [pathTemplate, methods] of Object.entries(openapi.paths || {})) {
		for (const [method, operation] of Object.entries(methods)) {
			if (method === 'parameters') continue;

			const operationId = operation.operationId;
			const summary = operation.summary;
			const tags = operation.tags || ['General'];
			const primaryTag = tags[0];

			if (summary && primaryTag) {
				const tagSlug = slugify(primaryTag);
				const summarySlug = slugify(summary);
				const url = `/api-reference/${tagSlug}/${summarySlug}`;
				validUrls.set(url, {operationId, summary, tag: primaryTag, method, path: pathTemplate});

				if (operationId) {
					const opIdSlug = operationId.replace(/_/g, '-');
					const opIdUrl = `/api-reference/${tagSlug}/${opIdSlug}`;
					operationIdToUrl.set(opIdUrl, url);
				}
			}
		}
	}

	return {validUrls, operationIdToUrl};
}

/**
 * Extract all internal links from MDX content.
 */
function extractLinks(content) {
	const links = [];
	const linkRegex = /\]\(([^)]+)\)/g;
	let match;
	while ((match = linkRegex.exec(content)) !== null) {
		const url = match[1];
		if (url.startsWith('/') && !url.startsWith('//')) {
			links.push({url, index: match.index});
		}
	}
	return links;
}

/**
 * Find all MDX files recursively.
 */
async function findMdxFiles(dir, files = []) {
	const entries = await fs.readdir(dir, {withFileTypes: true});
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
			await findMdxFiles(fullPath, files);
		} else if (entry.isFile() && entry.name.endsWith('.mdx')) {
			files.push(fullPath);
		}
	}
	return files;
}

async function main() {
	const openapiPath = path.join(repoRoot, 'api-reference/openapi.json');
	const {validUrls, operationIdToUrl} = await buildValidUrlMap(openapiPath);

	console.log(`Loaded ${validUrls.size} valid API reference URLs\n`);

	const mdxFiles = await findMdxFiles(repoRoot);
	const brokenLinks = [];
	const fixableLinks = [];

	for (const filePath of mdxFiles) {
		const content = await fs.readFile(filePath, 'utf-8');
		const links = extractLinks(content);
		const relativePath = path.relative(repoRoot, filePath);

		for (const {url} of links) {
			if (url.startsWith('/api-reference/')) {
				const urlWithoutAnchor = url.split('#')[0];
				if (!validUrls.has(urlWithoutAnchor)) {
					const correctUrl = operationIdToUrl.get(urlWithoutAnchor);
					if (correctUrl) {
						fixableLinks.push({file: relativePath, broken: url, correct: correctUrl});
					} else {
						brokenLinks.push({file: relativePath, url});
					}
				}
			}
		}
	}

	if (fixableLinks.length > 0) {
		console.log('=== FIXABLE LINKS (operationId → summary) ===\n');
		const grouped = {};
		for (const {file, broken, correct} of fixableLinks) {
			if (!grouped[file]) grouped[file] = [];
			grouped[file].push({broken, correct});
		}
		for (const [file, links] of Object.entries(grouped)) {
			console.log(`${file}:`);
			for (const {broken, correct} of links) {
				console.log(`  ${broken}`);
				console.log(`    → ${correct}`);
			}
			console.log();
		}
	}

	if (brokenLinks.length > 0) {
		console.log('=== UNFIXABLE BROKEN LINKS ===\n');
		const grouped = {};
		for (const {file, url} of brokenLinks) {
			if (!grouped[file]) grouped[file] = [];
			grouped[file].push(url);
		}
		for (const [file, urls] of Object.entries(grouped)) {
			console.log(`${file}:`);
			for (const url of urls) {
				console.log(`  ${url}`);
			}
			console.log();
		}
	}

	console.log(`\nSummary:`);
	console.log(`  Fixable links: ${fixableLinks.length}`);
	console.log(`  Unfixable broken links: ${brokenLinks.length}`);

	if (process.argv.includes('--fix')) {
		console.log('\n=== APPLYING FIXES ===\n');
		const fileUpdates = {};
		for (const {file, broken, correct} of fixableLinks) {
			if (!fileUpdates[file]) {
				fileUpdates[file] = await fs.readFile(path.join(repoRoot, file), 'utf-8');
			}
			fileUpdates[file] = fileUpdates[file].split(broken).join(correct);
		}
		for (const [file, content] of Object.entries(fileUpdates)) {
			await fs.writeFile(path.join(repoRoot, file), content);
			console.log(`Fixed: ${file}`);
		}
		console.log(`\nFixed ${Object.keys(fileUpdates).length} files.`);
	} else if (fixableLinks.length > 0) {
		console.log(`\nRun with --fix to apply fixes.`);
	}
}

await main();
