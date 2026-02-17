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

import {HttpStatus} from '@fluxer/constants/src/HttpConstants';
import {extractClientIp} from '@fluxer/ip_utils/src/ClientIp';
import type {Logger} from '@fluxer/logger/src/Logger';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import {createRateLimitMiddleware} from '@fluxer/rate_limit/src/middleware/RateLimitMiddleware';

interface ProxyRateLimitConfig {
	enabled?: boolean;
	limit: number;
	windowMs: number;
	skipPaths?: Array<string>;
}

export interface CreateProxyRateLimitMiddlewareOptions {
	rateLimitService: IRateLimitService | null;
	bucketPrefix: string;
	config: ProxyRateLimitConfig;
	logger: Logger;
}

export function createProxyRateLimitMiddleware(options: CreateProxyRateLimitMiddlewareOptions) {
	const {bucketPrefix, config, logger, rateLimitService} = options;

	return createRateLimitMiddleware({
		rateLimitService: () => rateLimitService,
		config: {
			get enabled() {
				const hasRateLimitService = Boolean(rateLimitService);
				return config.enabled !== undefined ? hasRateLimitService && config.enabled : hasRateLimitService;
			},
			limit: config.limit,
			windowMs: config.windowMs,
			skipPaths: config.skipPaths,
		},
		getClientIdentifier: (req) => {
			const realIp = extractClientIp(req);
			return realIp || 'unknown';
		},
		getBucketName: (identifier, _ctx) => `${bucketPrefix}:ip:${identifier}`,
		onRateLimitExceeded: (c, retryAfter) => {
			const identifier = extractClientIp(c.req.raw) || 'unknown';
			logger.warn(
				{
					ip: identifier,
					path: c.req.path,
					retryAfter,
				},
				'proxy rate limit exceeded',
			);
			return c.text('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);
		},
	});
}
