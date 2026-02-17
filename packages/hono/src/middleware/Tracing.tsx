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

import {matchesAnyPathPattern} from '@fluxer/hono/src/middleware/utils/PathMatchers';
import type {TracingOptions} from '@fluxer/hono_types/src/TracingTypes';
import type {MiddlewareHandler} from 'hono';

export function tracing(options: TracingOptions = {}): MiddlewareHandler {
	const {
		enabled = true,
		skipPaths = ['/_health', '/metrics'],
		serviceName = 'hono-service',
		withSpan,
		setSpanAttributes,
		attachTraceparent = false,
	} = options;

	return async (c, next) => {
		if (!enabled) {
			await next();
			return;
		}

		const path = c.req.path;
		if (matchesAnyPathPattern(path, skipPaths)) {
			await next();
			return;
		}

		if (!withSpan || !setSpanAttributes) {
			await next();
			return;
		}

		const method = c.req.method;
		const spanName = `http.request ${method} ${path}`;

		await withSpan(spanName, async () => {
			const startTime = Date.now();

			setSpanAttributes({
				'http.method': method,
				'http.url': c.req.url,
				'http.target': path,
				'http.scheme': c.req.header('x-forwarded-proto') ?? 'http',
				'http.host': c.req.header('host') ?? 'unknown',
				'http.user_agent': c.req.header('user-agent') ?? 'unknown',
				'service.name': serviceName,
			});

			await next();

			const durationMs = Date.now() - startTime;
			const status = c.res.status;

			setSpanAttributes({
				'http.status_code': status,
				'http.response_content_length': Number(c.res.headers.get('content-length') ?? 0),
				'http.duration_ms': durationMs,
			});

			if (attachTraceparent) {
				const traceparent = c.res.headers.get('traceparent');
				if (traceparent) {
					c.header('traceparent', traceparent);
				}
			}
		});
	};
}
