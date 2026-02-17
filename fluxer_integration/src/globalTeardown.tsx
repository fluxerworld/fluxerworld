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

import {execSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const composeFile = path.resolve(__dirname, '../docker/compose.yaml');

const PROJECT_NAME = 'fluxer-integration';

function stopContainers(): void {
	console.log('Stopping integration test infrastructure...');

	try {
		execSync(`docker compose -p ${PROJECT_NAME} -f "${composeFile}" down -v --remove-orphans`, {
			stdio: 'inherit',
		});
	} catch (error) {
		console.error('Failed to stop Docker containers:', error);
	}
}

export default async function globalTeardown(): Promise<void> {
	console.log('\n=== Integration Test Global Teardown ===\n');

	stopContainers();

	console.log('\n=== Infrastructure stopped ===\n');
}
