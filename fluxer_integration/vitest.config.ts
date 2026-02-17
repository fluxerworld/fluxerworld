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

import tsconfigPaths from 'vite-tsconfig-paths';
import {defineConfig} from 'vitest/config';

export default defineConfig({
	root: process.cwd(),
	plugins: [tsconfigPaths()],
	cacheDir: './node_modules/.vitest',
	test: {
		globals: true,
		environment: 'node',
		globalSetup: ['./src/globalSetup.tsx'],
		globalTeardown: ['./src/globalTeardown.tsx'],
		setupFiles: ['./src/Setup.tsx'],

		pool: 'threads',
		fileParallelism: false,
		maxConcurrency: 2,

		testTimeout: 30000,
		hookTimeout: 15000,

		isolate: true,

		reporters: ['default', 'json'],
		outputFile: './test-results.json',

		include: ['src/**/*.test.tsx'],

		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: ['**/*.test.tsx', '**/*.spec.tsx', 'node_modules/'],
		},
	},
});
