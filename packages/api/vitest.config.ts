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
		setupFiles: ['./src/test/Setup.tsx'],

		pool: 'threads',
		fileParallelism: true,
		maxWorkers: 4,
		maxConcurrency: 4,
		isolate: false,

		testTimeout: 40000,
		hookTimeout: 20000,

		// The search integration tests share a single meilisearch testcontainer
		// across 6 files running concurrently (fileParallelism + maxConcurrency 4),
		// which intermittently drops a keep-alive socket mid-request ("write EPIPE")
		// on ~1 random search test per run. Retry transient failures a couple times
		// so container flakiness doesn't redden an otherwise-deterministic suite; a
		// genuinely failing test still fails all attempts.
		retry: 2,

		reporters: ['default', 'json'],
		outputFile: './test-results.json',

		coverage: {
			provider: 'v8',
			reporter: ['text', 'text-summary', 'json', 'html'],
			reportsDirectory: './coverage',
			exclude: [
				'**/node_modules/tests/test*.test.tsx',
				'**/*.test.ts',
				'**/Setup.tsx',
				'**/TestConstants.tsx',
				'**/TestRequestBuilder.tsx',
				'**/TestHelpers.tsx',
			],
		},
	},
});
