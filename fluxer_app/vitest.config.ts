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

import path, {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import tsconfigPaths from 'vite-tsconfig-paths';
import {defineConfig} from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	root: __dirname,
	plugins: [tsconfigPaths()],
	resolve: {
		alias: [
			{find: /^(.*)\.module\.css$/, replacement: path.resolve(__dirname, 'src/test/StyleMock.ts')},
			{find: /^(.*)\.css$/, replacement: path.resolve(__dirname, 'src/test/StyleMock.ts')},
			{find: '@app', replacement: path.resolve(__dirname, 'src')},
			{find: '@pkgs/libfluxcore/libfluxcore', replacement: path.resolve(__dirname, 'src/test/LibfluxcoreMock.tsx')},
			{
				find: '@pkgs/libfluxcore/libfluxcore_bg.wasm',
				replacement: path.resolve(__dirname, 'src/test/LibfluxcoreMock.wasm'),
			},
			{find: '~', replacement: path.resolve(__dirname, 'src')},
		],
		extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
	},
	test: {
		environment: 'happy-dom',
		environmentOptions: {
			happyDOM: {
				settings: {
					disableJavaScriptFileLoading: true,
					disableJavaScriptEvaluation: false,
					disableCSSFileLoading: true,
					disableComputedStyleRendering: true,
					navigator: {
						userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Vitest',
					},
				},
			},
		},
		setupFiles: [path.resolve(__dirname, './src/test/Setup.tsx')],
		server: {
			deps: {
				inline: [/@app/],
			},
		},
		globals: true,
		css: true,
		include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: ['node_modules/', '**/*.d.ts', '**/*.config.{js,ts}', 'src/test/**/*'],
		},
	},
});
