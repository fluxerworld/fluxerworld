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

import type {MiddlewareHandler} from 'hono';
import {createMiddleware} from 'hono/factory';

const cacheablePrefixes = [
	'text/css',
	'application/javascript',
	'application/json',
	'font/',
	'image/',
	'video/',
	'audio/',
	'application/font-woff2',
];

export function cacheHeadersMiddleware(): MiddlewareHandler {
	return createMiddleware(async (c, next) => {
		await next();

		if (c.res.headers.has('Cache-Control')) return;
		const contentType = c.res.headers.get('content-type') ?? '';
		const shouldCache = cacheablePrefixes.some((prefix) => contentType.startsWith(prefix));
		c.res.headers.set('Cache-Control', shouldCache ? 'public, max-age=31536000, immutable' : 'no-cache');
	});
}
