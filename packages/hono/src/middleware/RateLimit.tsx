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
import {extractClientIp} from '@fluxer/ip_utils/src/ClientIp';
import type {MiddlewareHandler} from 'hono';

export interface RateLimitResult {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetTime: Date;
	retryAfter?: number;
}

export interface RateLimitService {
	checkLimit(params: {identifier: string; maxAttempts: number; windowMs: number}): Promise<RateLimitResult>;
}

export type KeyGenerator = (request: Request) => string | Promise<string>;

export interface RateLimitOptions {
	enabled?: boolean;
	skipPaths?: Array<string>;
	service?: RateLimitService;
	maxAttempts?: number;
	windowMs?: number;
	keyGenerator?: KeyGenerator;
	onLimitExceeded?: (identifier: string, path: string) => void;
	trustCfConnectingIp?: boolean;
}

function getClientIp(req: Request, trustCfConnectingIp?: boolean): string {
	const ip = extractClientIp(req, {trustCfConnectingIp});
	return ip ?? 'unknown';
}

function createDefaultKeyGenerator(trustCfConnectingIp?: boolean): KeyGenerator {
	return function defaultKeyGenerator(req: Request): string {
		return getClientIp(req, trustCfConnectingIp);
	};
}

export function rateLimit(options: RateLimitOptions = {}): MiddlewareHandler {
	const {
		enabled = true,
		skipPaths = ['/_health', '/metrics'],
		service,
		maxAttempts = 100,
		windowMs = 60000,
		keyGenerator,
		onLimitExceeded,
		trustCfConnectingIp = false,
	} = options;
	const resolvedKeyGenerator = keyGenerator ?? createDefaultKeyGenerator(trustCfConnectingIp);

	return async (c, next) => {
		if (!enabled || !service) {
			await next();
			return;
		}

		const path = c.req.path;
		if (matchesAnyPathPattern(path, skipPaths)) {
			await next();
			return;
		}

		const identifier = await resolvedKeyGenerator(c.req.raw);
		const result = await service.checkLimit({
			identifier,
			maxAttempts,
			windowMs,
		});

		c.header('X-RateLimit-Limit', result.limit.toString());
		c.header('X-RateLimit-Remaining', result.remaining.toString());
		c.header('X-RateLimit-Reset', Math.floor(result.resetTime.getTime() / 1000).toString());

		if (!result.allowed) {
			if (result.retryAfter !== undefined) {
				c.header('Retry-After', result.retryAfter.toString());
			}

			if (onLimitExceeded) {
				onLimitExceeded(identifier, path);
			}

			return c.json(
				{
					error: 'Too Many Requests',
					message: 'Rate limit exceeded',
					retryAfter: result.retryAfter,
				},
				429,
			);
		}

		await next();
		return;
	};
}
