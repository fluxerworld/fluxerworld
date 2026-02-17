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
import {buildAPIConfigFromMaster, initializeConfig} from '@fluxer/api/src/Config';
import {initializeLogger} from '@fluxer/api/src/Logger';
import {drainSearchTasks, enableSearchTaskTracking} from '@fluxer/api/src/search/SearchTaskTracker';
import {NoopLogger} from '@fluxer/api/src/test/mocks/NoopLogger';
import {resetNcmecState} from '@fluxer/api/src/test/msw/handlers/NcmecHandlers';
import {server} from '@fluxer/api/src/test/msw/server';
import {loadConfig} from '@fluxer/config/src/ConfigLoader';
import {afterAll, afterEach, beforeAll} from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testConfigPath = path.resolve(__dirname, '../../../..', 'config/config.test.json');

const master = await loadConfig([testConfigPath]);
const apiConfig = buildAPIConfigFromMaster(master);
initializeConfig({
	...apiConfig,
	database: {
		...apiConfig.database,
		sqlitePath: ':memory:',
	},
	auth: {
		...apiConfig.auth,
		passkeys: {
			...apiConfig.auth.passkeys,
			rpId: 'localhost',
			allowedOrigins: ['http://localhost'],
		},
	},
	voice: {
		...apiConfig.voice,
		enabled: false,
	},
});
initializeLogger(new NoopLogger());
enableSearchTaskTracking();

beforeAll(async () => {
	server.listen({onUnhandledRequest: 'error'});
});

afterEach(async () => {
	await drainSearchTasks();
	server.resetHandlers();
	resetNcmecState();
});

afterAll(() => {
	server.close();
});
