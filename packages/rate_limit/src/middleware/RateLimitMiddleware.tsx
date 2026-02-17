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
import type {BucketConfig, IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import type {Context, MiddlewareHandler} from 'hono';
import {createMiddleware} from 'hono/factory';

export interface RateLimitMiddlewareConfig {
	enabled: boolean;
	limit: number;
	windowMs: number;
	skipPaths?: Array<string>;
}

export type RateLimitServiceProvider = IRateLimitService | null | (() => IRateLimitService | null);

export interface RateLimitMiddlewareOptions<_Variables extends Record<string, unknown> = Record<string, unknown>> {
	rateLimitService: RateLimitServiceProvider;
	config: RateLimitMiddlewareConfig;
	getClientIdentifier: (req: Request) => string;
	getBucketName?: (identifier: string, c: Context) => string;
	onRateLimitExceeded?: (c: Context, retryAfter: number) => Response | Promise<Response>;
}

export function setRateLimitHeaders(
	ctx: {header: (name: string, value: string) => void},
	limit: number,
	remaining: number,
	resetTime: Date,
): void {
	ctx.header('X-RateLimit-Limit', limit.toString());
	ctx.header('X-RateLimit-Remaining', remaining.toString());
	ctx.header('X-RateLimit-Reset', Math.floor(resetTime.getTime() / 1000).toString());
}

function shouldSkipPath(path: string, skipPaths: Array<string>): boolean {
	for (const skipPath of skipPaths) {
		if (path === skipPath) return true;
		if (skipPath.endsWith('/') && path.startsWith(skipPath)) return true;
	}
	return false;
}

export function createRateLimitMiddleware<Variables extends Record<string, unknown> = Record<string, unknown>>(
	options: RateLimitMiddlewareOptions<Variables>,
): MiddlewareHandler<{Variables: Variables}> {
	const {rateLimitService, config, getClientIdentifier, getBucketName, onRateLimitExceeded} = options;

	return createMiddleware<{Variables: Variables}>(async (c, next) => {
		const resolvedRateLimitService = typeof rateLimitService === 'function' ? rateLimitService() : rateLimitService;
		if (!config.enabled) {
			await next();
			return undefined;
		}

		if (!resolvedRateLimitService) {
			await next();
			return undefined;
		}

		const path = c.req.path;
		if (config.skipPaths && shouldSkipPath(path, config.skipPaths)) {
			await next();
			return undefined;
		}

		const identifier = getClientIdentifier(c.req.raw);
		const bucket = getBucketName ? getBucketName(identifier, c) : `${identifier}:global`;

		const bucketConfig: BucketConfig = {
			limit: config.limit,
			windowMs: config.windowMs,
		};

		const result = await resolvedRateLimitService.checkBucketLimit(bucket, bucketConfig);

		if (!result.allowed) {
			const retryAfter = result.retryAfter ?? 1;
			c.header('Retry-After', retryAfter.toString());
			setRateLimitHeaders(c, result.limit, result.remaining, result.resetTime);

			if (onRateLimitExceeded) {
				return onRateLimitExceeded(c, retryAfter);
			}

			return c.json({error: 'Rate limit exceeded', retryAfter}, HttpStatus.TOO_MANY_REQUESTS);
		}

		setRateLimitHeaders(c, result.limit, result.remaining, result.resetTime);
		await next();
		return undefined;
	});
}
