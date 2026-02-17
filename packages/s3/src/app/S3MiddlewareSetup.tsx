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

import {Headers} from '@fluxer/constants/src/Headers';
import {applyMiddlewareStack} from '@fluxer/hono/src/middleware/MiddlewareStack';
import type {MetricsCollector} from '@fluxer/hono_types/src/MetricsTypes';
import type {TracingOptions} from '@fluxer/hono_types/src/TracingTypes';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import type {RateLimitService} from '@fluxer/rate_limit/src/RateLimitService';
import type {S3RateLimitConfig} from '@fluxer/s3/src/app/S3AppConfigTypes';
import type {S3AuthConfig} from '@fluxer/s3/src/middleware/S3AuthMiddleware';
import {createS3AuthMiddleware} from '@fluxer/s3/src/middleware/S3AuthMiddleware';
import type {IS3Service} from '@fluxer/s3/src/s3/S3Service';
import type {HonoEnv} from '@fluxer/s3/src/types/HonoEnv';
import type {Hono} from 'hono';
import {createMiddleware} from 'hono/factory';

interface SetupS3MiddlewareOptions {
	app: Hono<HonoEnv>;
	logger: LoggerInterface;
	s3Service: IS3Service;
	authConfig: S3AuthConfig;
	metricsCollector?: MetricsCollector;
	tracing?: TracingOptions;
	rateLimitService?: RateLimitService | null;
	rateLimitConfig?: S3RateLimitConfig | null;
}

export function setupS3Middleware(options: SetupS3MiddlewareOptions): void {
	const {app, logger, s3Service, authConfig, metricsCollector, tracing, rateLimitService, rateLimitConfig} = options;

	const serviceMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
		ctx.set('s3Service', s3Service);
		await next();
	});

	applyMiddlewareStack(app, {
		requestId: {headerName: Headers.X_AMZ_REQUEST_ID},
		tracing,
		metrics: metricsCollector
			? {
					enabled: true,
					collector: metricsCollector,
					skipPaths: ['/_health'],
				}
			: undefined,
		logger: {
			log: (data) => {
				logger.info(
					{
						method: data.method,
						path: data.path,
						status: data.status,
						durationMs: data.durationMs,
					},
					'Request completed',
				);
			},
		},
		rateLimit:
			rateLimitService && rateLimitConfig?.enabled
				? {
						enabled: true,
						service: rateLimitService,
						maxAttempts: rateLimitConfig.maxAttempts,
						windowMs: rateLimitConfig.windowMs,
						skipPaths: rateLimitConfig.skipPaths ?? ['/_health'],
					}
				: undefined,
		customMiddleware: [serviceMiddleware, createS3AuthMiddleware(authConfig, logger)],
		skipErrorHandler: true,
	});
}
