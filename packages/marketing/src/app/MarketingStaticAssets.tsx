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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import {serveStatic} from '@hono/node-server/serve-static';
import type {Hono} from 'hono';

export interface ApplyMarketingStaticAssetsOptions {
	app: Hono;
	publicDir: string;
	basePath: string;
	logger: LoggerInterface;
}

export function applyMarketingStaticAssets(options: ApplyMarketingStaticAssetsOptions): void {
	options.app.use(
		'/static/*',
		serveStatic({
			root: options.publicDir,
			rewriteRequestPath: (path: string) => toRelativeStaticPath(stripLeadingBasePath(path, options.basePath)),
			onNotFound: (_path) => {
				options.logger.error(
					{
						publicDir: options.publicDir,
						cwd: process.cwd(),
					},
					'Marketing static asset not found (expected packages/marketing/public/static/app.css to exist)',
				);
			},
		}),
	);
}

function stripLeadingBasePath(path: string, basePath: string): string {
	if (!basePath) return path;
	if (path === basePath) return '';
	if (path.startsWith(`${basePath}/`)) return path.slice(basePath.length);
	return path;
}

function toRelativeStaticPath(path: string): string {
	if (!path) return path;
	return path.startsWith('/') ? path.slice(1) : path;
}
