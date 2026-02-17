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

import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Env, Hono} from 'hono';

export interface SpaRouteOptions {
	staticDir: string;
	assetVersion?: string;
}

export function createSpaRoute<E extends Env>(app: Hono<E>, options: SpaRouteOptions): void {
	const {assetVersion, staticDir} = options;

	app.get('/version.json', (c) => {
		const versionFileContent = readStaticTextFile(staticDir, 'version.json');
		if (!versionFileContent) {
			if (assetVersion) {
				return c.json({version: assetVersion});
			}
			return c.notFound();
		}
		c.header('Cache-Control', 'no-cache');
		return c.json(JSON.parse(versionFileContent) as unknown);
	});

	app.get('/manifest.json', (c) => {
		const manifestContent = readStaticTextFile(staticDir, 'manifest.json');
		if (!manifestContent) {
			return c.notFound();
		}
		c.header('Content-Type', 'application/manifest+json');
		c.header('Cache-Control', 'no-cache');
		return c.body(manifestContent);
	});

	app.get('/sw.js', (c) => {
		const serviceWorkerContent = readStaticTextFile(staticDir, 'sw.js');
		if (!serviceWorkerContent) {
			return c.notFound();
		}
		c.header('Content-Type', 'application/javascript; charset=utf-8');
		c.header('Cache-Control', 'no-cache');
		return c.body(serviceWorkerContent);
	});

	app.get('/sw.js.map', (c) => {
		const sourceMapContent = readStaticTextFile(staticDir, 'sw.js.map');
		if (!sourceMapContent) {
			return c.notFound();
		}
		c.header('Content-Type', 'application/json');
		c.header('Cache-Control', 'no-cache');
		return c.body(sourceMapContent);
	});
}

function readStaticTextFile(staticDir: string, filename: string): string | null {
	const filePath = join(staticDir, filename);
	if (!existsSync(filePath)) {
		return null;
	}
	return readFileSync(filePath, 'utf-8');
}
