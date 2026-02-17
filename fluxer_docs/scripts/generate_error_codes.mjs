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

import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createFrontmatter, escapeTableText, readJsonFile, writeFile} from './shared.mjs';

/**
 * Render a table of error codes with descriptions.
 */
function renderErrorCodeTable(codes, descriptions) {
	let out = '';
	out += '| Code | Description |\n';
	out += '|------|-------------|\n';

	for (let i = 0; i < codes.length; i++) {
		const code = codes[i];
		const description = descriptions[i] ?? '-';
		out += `| \`${escapeTableText(code)}\` | ${escapeTableText(description)} |\n`;
	}

	return out;
}

async function main() {
	const dirname = path.dirname(fileURLToPath(import.meta.url));
	const repoRoot = path.resolve(dirname, '../..');
	const openapiPath = path.join(repoRoot, 'fluxer_docs/api-reference/openapi.json');
	const outPath = path.join(repoRoot, 'fluxer_docs/topics/error_codes.mdx');

	const openapi = await readJsonFile(openapiPath);
	const schemas = openapi?.components?.schemas ?? {};

	const apiErrorCodeSchema = schemas.APIErrorCode;
	const validationErrorCodeSchema = schemas.ValidationErrorCodeSchema;

	if (!apiErrorCodeSchema) {
		throw new Error('APIErrorCode schema not found in OpenAPI spec');
	}
	if (!validationErrorCodeSchema) {
		throw new Error('ValidationErrorCodeSchema schema not found in OpenAPI spec');
	}

	const apiErrorCodes = apiErrorCodeSchema.enum ?? [];
	const apiErrorDescriptions = apiErrorCodeSchema['x-enumDescriptions'] ?? [];

	const validationErrorCodes = validationErrorCodeSchema['x-enumNames'] ?? validationErrorCodeSchema.enum ?? [];
	const validationErrorDescriptions = validationErrorCodeSchema['x-enumDescriptions'] ?? [];

	let out = '';
	out += createFrontmatter({
		title: 'Error codes',
		description: 'Reference for API and validation error codes returned by Fluxer.',
	});
	out += '\n\n';

	out +=
		'When the API returns an error response, it includes a structured error object with a `code` field that identifies the specific error. This page documents all possible error codes.\n\n';

	out += '## API error codes\n\n';
	out += 'These error codes are returned in the `code` field of the main error response body.\n\n';
	out += renderErrorCodeTable(apiErrorCodes, apiErrorDescriptions);
	out += '\n';

	out += '## Validation error codes\n\n';
	out +=
		'These error codes are returned in the `code` field of individual validation error items when request validation fails.\n\n';
	out += renderErrorCodeTable(validationErrorCodes, validationErrorDescriptions);

	await writeFile(outPath, out);

	console.log('Generated error codes documentation:');
	console.log(`  - ${outPath}`);
	console.log(`  - ${apiErrorCodes.length} API error codes`);
	console.log(`  - ${validationErrorCodes.length} validation error codes`);
}

await main();
