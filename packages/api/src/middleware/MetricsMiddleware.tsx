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

import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {recordCounter, recordHistogram} from '@fluxer/telemetry/src/Metrics';
import {createMiddleware} from 'hono/factory';

function normalizePath(path: string): string {
	return path
		.replace(/\/\d{17,20}/g, '/:id')
		.replace(/\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '/:uuid')
		.replace(/\/[A-Za-z0-9_-]{6,}/g, (match) => {
			if (match.match(/^\/[0-9]+$/)) {
				return '/:id';
			}
			return match;
		});
}

export const MetricsMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	const start = performance.now();
	const method = ctx.req.method;
	const path = new URL(ctx.req.url).pathname;

	try {
		await next();
	} finally {
		const durationMs = performance.now() - start;
		const normalizedPath = normalizePath(path);
		const status = ctx.res.status;

		const baseDimensions = {
			'http.request.method': method,
			'url.path': normalizedPath,
			'http.response.status_code': String(status),
		};

		recordHistogram({
			name: 'http.server.request.duration',
			dimensions: baseDimensions,
			valueMs: durationMs,
		});

		recordCounter({
			name: 'http.server.request.count',
			dimensions: baseDimensions,
			value: 1,
		});

		recordHistogram({
			name: 'api.latency',
			dimensions: {
				method,
				path: normalizedPath,
				status: String(status),
			},
			valueMs: durationMs,
		});

		const counterName = status >= 500 ? 'api.request.5xx' : status >= 400 ? 'api.request.4xx' : 'api.request.2xx';
		recordCounter({
			name: counterName,
			dimensions: {
				method,
				path: normalizedPath,
				status: String(status),
			},
			value: 1,
		});
	}
});
