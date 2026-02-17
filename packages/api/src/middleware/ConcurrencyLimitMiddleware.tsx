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

import {Logger} from '@fluxer/api/src/Logger';
import {recordCounter} from '@fluxer/telemetry/src/Metrics';
import type {MiddlewareHandler} from 'hono';

const MAX_CONCURRENT_REQUESTS = 500;
const SKIP_PATHS = new Set(['/_health', '/internal/telemetry']);

let inFlightRequests = 0;

export const ConcurrencyLimitMiddleware: MiddlewareHandler = async (ctx, next) => {
	if (SKIP_PATHS.has(ctx.req.path)) {
		await next();
		return;
	}

	if (inFlightRequests >= MAX_CONCURRENT_REQUESTS) {
		recordCounter({name: 'api.concurrency_limit.rejected'});
		Logger.warn(
			{inFlightRequests, max: MAX_CONCURRENT_REQUESTS},
			'[concurrency-limit] Rejecting request, server at capacity',
		);
		ctx.header('Retry-After', '5');
		ctx.status(503);
		ctx.res = ctx.json({message: 'Server is at capacity, please retry shortly'}, 503);
		return;
	}

	inFlightRequests += 1;
	try {
		await next();
	} finally {
		inFlightRequests -= 1;
	}
};
