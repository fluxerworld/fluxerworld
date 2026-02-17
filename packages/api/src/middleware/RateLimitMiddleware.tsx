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

import {Config} from '@fluxer/api/src/Config';
import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {UserFlags} from '@fluxer/constants/src/UserConstants';
import {RateLimitError} from '@fluxer/errors/src/domains/core/RateLimitError';
import {extractClientIp} from '@fluxer/ip_utils/src/ClientIp';
import type {BucketConfig} from '@fluxer/rate_limit/src/IRateLimitService';
import {recordCounter, recordHistogram} from '@fluxer/telemetry/src/Metrics';
import type {Context, MiddlewareHandler} from 'hono';
import {createMiddleware} from 'hono/factory';

export interface RouteRateLimitConfig {
	bucket: string;
	config: BucketConfig;
}

const TEST_ENABLE_RATE_LIMITS_HEADER = 'x-fluxer-test-enable-rate-limits';
const TEST_GLOBAL_RATE_LIMIT_OVERRIDE_HEADER = 'x-fluxer-test-global-rate-limit';

function shouldEnforceRateLimits(ctx: Context<HonoEnv>): boolean {
	if (!Config.dev.testModeEnabled) {
		return !Config.dev.disableRateLimits;
	}

	// Test mode disables rate limits by default; tests can opt in per-request.
	return ctx.req.header(TEST_ENABLE_RATE_LIMITS_HEADER) === 'true';
}

function getClientIdentifier(ctx: Context<HonoEnv>): string {
	const user = ctx.get('user');
	if (user?.id) {
		return `user:${user.id}`;
	}
	const ip = extractClientIp(ctx.req.raw, {trustCfConnectingIp: Config.proxy.trust_cf_connecting_ip});
	if (!ip) return 'internal';
	return `ip:${ip}`;
}

function getGlobalRateLimit(ctx: Context<HonoEnv>): number {
	if (Config.dev.testModeEnabled) {
		const override = ctx.req.header(TEST_GLOBAL_RATE_LIMIT_OVERRIDE_HEADER);
		if (override) {
			const parsed = Number.parseInt(override, 10);
			if (Number.isFinite(parsed) && parsed > 0) {
				return parsed;
			}
		}
	}

	const user = ctx.get('user');
	if (user?.flags && (user.flags & UserFlags.HIGH_GLOBAL_RATE_LIMIT) !== 0n) {
		return 1200;
	}
	return 50;
}

function resolveBucket(bucket: string, ctx: Context<HonoEnv>): string {
	let resolved = bucket;

	const params = ctx.req.param();
	for (const [key, value] of Object.entries(params)) {
		resolved = resolved.replace(`:${key}`, String(value));
	}

	const clientId = getClientIdentifier(ctx);
	return `${clientId}:${resolved}`;
}

function setRateLimitHeaders(ctx: Context<HonoEnv>, limit: number, remaining: number, resetTime: Date): void {
	ctx.header('X-RateLimit-Limit', limit.toString());
	ctx.header('X-RateLimit-Remaining', remaining.toString());
	ctx.header('X-RateLimit-Reset', Math.floor(resetTime.getTime() / 1000).toString());
}

function getRetryAfterSeconds(retryAfter: number | undefined, resetTime: Date): number {
	return retryAfter ?? Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
}

async function revokeAuthenticatedSessionOnGlobalRateLimit(ctx: Context<HonoEnv>): Promise<void> {
	const authTokenType = ctx.get('authTokenType');
	if (authTokenType !== 'session') return;

	const user = ctx.get('user');
	if (!user || user.isBot) return;

	const token = ctx.get('authToken');
	if (!token) return;

	try {
		await ctx.get('authService').revokeToken(token);
	} catch (_error) {
		recordCounter({
			name: 'api.ratelimit.global_session_revocation_failed',
			dimensions: {},
		});
	}
}

export function RateLimitMiddleware(routeConfig: RouteRateLimitConfig): MiddlewareHandler<HonoEnv> {
	return createMiddleware<HonoEnv>(async (ctx, next) => {
		if (!shouldEnforceRateLimits(ctx)) {
			await next();
			return;
		}

		const user = ctx.get('user');

		if (user?.flags && (user.flags & UserFlags.RATE_LIMIT_BYPASS) !== 0n) {
			await next();
			return;
		}

		const rateLimitService = ctx.get('rateLimitService');
		if (!rateLimitService) {
			await next();
			return;
		}

		const clientId = getClientIdentifier(ctx);

		if (!routeConfig.config.exemptFromGlobal) {
			const checkStart = Date.now();
			const globalLimit = getGlobalRateLimit(ctx);
			const globalResult = await rateLimitService.checkGlobalLimit(clientId, globalLimit);
			const checkDuration = Date.now() - checkStart;

			recordHistogram({
				name: 'api.ratelimit.check_latency',
				valueMs: checkDuration,
				dimensions: {bucket: 'global'},
			});

			recordCounter({
				name: 'api.ratelimit.check',
				dimensions: {bucket: 'global'},
			});

			if (!globalResult.allowed) {
				recordCounter({
					name: 'api.ratelimit.blocked',
					dimensions: {bucket: 'global'},
				});
				await revokeAuthenticatedSessionOnGlobalRateLimit(ctx);
				throw new RateLimitError({
					global: true,
					retryAfter: getRetryAfterSeconds(globalResult.retryAfter, globalResult.resetTime),
					limit: globalResult.limit,
					resetTime: globalResult.resetTime,
				});
			}

			recordCounter({
				name: 'api.ratelimit.allowed',
				dimensions: {bucket: 'global'},
			});
		}

		const bucket = resolveBucket(routeConfig.bucket, ctx);
		const bucketCheckStart = Date.now();
		const bucketResult = await rateLimitService.checkBucketLimit(bucket, routeConfig.config);
		const bucketCheckDuration = Date.now() - bucketCheckStart;

		recordHistogram({
			name: 'api.ratelimit.check_latency',
			valueMs: bucketCheckDuration,
			dimensions: {bucket: routeConfig.bucket},
		});

		recordCounter({
			name: 'api.ratelimit.check',
			dimensions: {bucket: routeConfig.bucket},
		});

		if (!bucketResult.allowed) {
			recordCounter({
				name: 'api.ratelimit.blocked',
				dimensions: {bucket: routeConfig.bucket},
			});
			throw new RateLimitError({
				retryAfter: getRetryAfterSeconds(bucketResult.retryAfter, bucketResult.resetTime),
				limit: bucketResult.limit,
				resetTime: bucketResult.resetTime,
			});
		}

		recordCounter({
			name: 'api.ratelimit.allowed',
			dimensions: {bucket: routeConfig.bucket},
		});

		setRateLimitHeaders(ctx, bucketResult.limit, bucketResult.remaining, bucketResult.resetTime);

		await next();
	});
}
