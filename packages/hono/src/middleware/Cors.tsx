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

export interface CorsOptions {
	enabled?: boolean;
	origins?: Array<string> | '*';
	methods?: Array<string>;
	allowedHeaders?: Array<string>;
	exposedHeaders?: Array<string>;
	credentials?: boolean;
	maxAge?: number;
}

const DEFAULT_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];
const DEFAULT_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept-Language', 'X-Request-ID'];

export function cors(options: CorsOptions = {}): MiddlewareHandler {
	const {
		enabled = true,
		origins = '*',
		methods = DEFAULT_METHODS,
		allowedHeaders = DEFAULT_HEADERS,
		exposedHeaders = [],
		credentials = false,
		maxAge = 86400,
	} = options;

	return async (c, next) => {
		if (!enabled) {
			await next();
			return;
		}

		const requestOrigin = c.req.header('origin');

		if (origins === '*') {
			c.header('Access-Control-Allow-Origin', '*');
		} else if (Array.isArray(origins) && requestOrigin && origins.includes(requestOrigin)) {
			c.header('Access-Control-Allow-Origin', requestOrigin);
			c.header('Vary', 'Origin');
		}

		if (credentials) {
			c.header('Access-Control-Allow-Credentials', 'true');
		}

		if (c.req.method === 'OPTIONS') {
			c.header('Access-Control-Allow-Methods', methods.join(', '));
			c.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));

			if (exposedHeaders.length > 0) {
				c.header('Access-Control-Expose-Headers', exposedHeaders.join(', '));
			}

			if (maxAge !== undefined) {
				c.header('Access-Control-Max-Age', maxAge.toString());
			}

			return c.body(null, 204);
		}

		if (exposedHeaders.length > 0) {
			c.header('Access-Control-Expose-Headers', exposedHeaders.join(', '));
		}

		await next();
		return;
	};
}
