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

import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

const envOverrides = loadEnvFromFiles(['FLUXER_AUTO_I18N', 'OPENROUTER_API_KEY']);
const FLUXER_AUTO_I18N = process.env.FLUXER_AUTO_I18N ?? envOverrides.FLUXER_AUTO_I18N ?? '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? envOverrides.OPENROUTER_API_KEY ?? '';

const shouldRun = FLUXER_AUTO_I18N === '1' && Boolean(OPENROUTER_API_KEY);
if (!shouldRun) {
	process.exit(0);
}

const childEnv = {...process.env, FLUXER_AUTO_I18N, OPENROUTER_API_KEY};

const scriptPath = new URL('./translate-i18n.mjs', import.meta.url).pathname;
const result = spawnSync(process.execPath, [scriptPath], {stdio: 'inherit', env: childEnv});
process.exit(result.status ?? 1);

function loadEnvFromFiles(keys) {
	const homeDir = homedir();
	const targetKeys = new Set(keys);
	const env = Object.create(null);
	const candidates = ['.bash_profile', '.bashrc', '.profile'];

	for (const candidate of candidates) {
		const filePath = join(homeDir, candidate);

		try {
			const content = readFileSync(filePath, 'utf8');
			for (const line of content.split(/\r?\n/)) {
				const parsed = parseExportLine(line);
				if (!parsed || !targetKeys.has(parsed.key) || env[parsed.key]) {
					continue;
				}

				env[parsed.key] = parsed.value;
			}
		} catch {}
	}

	return env;
}

function parseExportLine(line) {
	const trimmed = line.trim();
	if (!trimmed.startsWith('export ')) {
		return null;
	}

	const match = trimmed.match(/^export\s+([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
	if (!match) {
		return null;
	}

	return {key: match[1], value: stripQuotes(match[2])};
}

function stripQuotes(value) {
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1);
	}

	return trimmed;
}
