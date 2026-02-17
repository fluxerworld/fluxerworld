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

import type {MiddlewareHandler} from 'hono';

const CACHEABLE_CONTENT_TYPES = [
	'text/css',
	'application/javascript',
	'font/',
	'image/',
	'video/',
	'audio/',
	'application/font-woff2',
];

function shouldCache(contentType: string): boolean {
	return CACHEABLE_CONTENT_TYPES.some((type) => contentType.startsWith(type));
}

export interface CacheHeadersOptions {
	staticCacheControl?: string;
	defaultCacheControl?: string;
}

export function cacheHeaders(options: CacheHeadersOptions = {}): MiddlewareHandler {
	const {staticCacheControl = 'public, max-age=31536000, immutable', defaultCacheControl = 'no-cache'} = options;

	return async (c, next) => {
		await next();

		const existingCacheControl = c.res.headers.get('Cache-Control');
		if (existingCacheControl) {
			return;
		}

		const contentType = c.res.headers.get('Content-Type') || '';
		const cacheHeader = shouldCache(contentType) ? staticCacheControl : defaultCacheControl;

		c.res.headers.set('Cache-Control', cacheHeader);
	};
}
