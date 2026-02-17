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
import type {MetricsCollector} from '@fluxer/hono_types/src/MetricsTypes';
import type {MiddlewareHandler} from 'hono';

export interface MetricsOptions {
	enabled?: boolean;
	skipPaths?: Array<string>;
	collector?: MetricsCollector;
	includeMethod?: boolean;
	includeStatus?: boolean;
	includePath?: boolean;
}

export function metrics(options: MetricsOptions = {}): MiddlewareHandler {
	const {
		enabled = true,
		skipPaths = ['/_health', '/metrics'],
		collector,
		includeMethod = true,
		includeStatus = true,
		includePath = false,
	} = options;

	return async (c, next) => {
		if (!enabled || !collector) {
			await next();
			return;
		}

		const path = c.req.path;
		if (matchesAnyPathPattern(path, skipPaths)) {
			await next();
			return;
		}

		const startTime = Date.now();
		const method = c.req.method;

		await next();

		const durationMs = Date.now() - startTime;
		const status = c.res.status;

		const labels: Record<string, string> = {};
		if (includeMethod) {
			labels['method'] = method;
		}
		if (includeStatus) {
			labels['status'] = status.toString();
		}
		if (includePath) {
			labels['path'] = path;
		}

		collector.recordCounter({
			name: 'http_requests_total',
			value: 1,
			labels,
		});

		collector.recordHistogram({
			name: 'http_request_duration_ms',
			value: durationMs,
			labels,
		});

		if (status >= 400) {
			collector.recordCounter({
				name: 'http_errors_total',
				value: 1,
				labels,
			});
		}
	};
}
