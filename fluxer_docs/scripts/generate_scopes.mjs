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
import {createFrontmatter, escapeTableText, writeFile} from './shared.mjs';

/**
 * OAuth2 scopes and their descriptions.
 * The scope values must match OAuthScopes from @fluxer/schema/src/domains/oauth/OAuthSchemas.tsx
 */
const OAuth2ScopeDescriptions = {
	identify: 'Allows access to basic user information including username, discriminator, avatar, and flags.',
	email: "Allows access to the user's email address. Requires the identify scope.",
	guilds: 'Allows access to the list of guilds the user is a member of.',
	bot: 'Used for bot authorization. Adds a bot to a guild on behalf of the authorizing user.',
};

/**
 * Render the OAuth2 scopes table.
 */
function renderScopesTable(scopes) {
	let out = '';
	out += '| Scope | Description |\n';
	out += '|-------|-------------|\n';

	for (const [scope, description] of Object.entries(scopes)) {
		out += `| \`${escapeTableText(scope)}\` | ${escapeTableText(description)} |\n`;
	}

	return out;
}

async function main() {
	const dirname = path.dirname(fileURLToPath(import.meta.url));
	const repoRoot = path.resolve(dirname, '../..');
	const outPath = path.join(repoRoot, 'fluxer_docs/topics/oauth2.mdx');

	let out = '';
	out += createFrontmatter({
		title: 'OAuth2',
		description: 'OAuth2 scopes in Fluxer and what each scope enables.',
	});
	out += '\n\n';

	out +=
		'OAuth2 scopes define the level of access that an application can request from a user. When a user authorizes an application, they grant permission for the application to access specific resources on their behalf.\n\n';

	out += '## Available scopes\n\n';
	out += renderScopesTable(OAuth2ScopeDescriptions);

	await writeFile(outPath, out);

	const scopeCount = Object.keys(OAuth2ScopeDescriptions).length;
	console.log('Generated OAuth2 documentation:');
	console.log(`  - ${outPath}`);
	console.log(`  - ${scopeCount} scopes`);
}

await main();
