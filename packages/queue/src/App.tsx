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

import {AppNotFoundHandler} from '@fluxer/errors/src/domains/core/ErrorHandlers';
import {createErrorHandler} from '@fluxer/errors/src/ErrorHandler';
import {createInternalAuth} from '@fluxer/hono/src/middleware/InternalAuth';
import {applyMiddlewareStack} from '@fluxer/hono/src/middleware/MiddlewareStack';
import type {MetricsCollector} from '@fluxer/hono_types/src/MetricsTypes';
import type {TracingOptions} from '@fluxer/hono_types/src/TracingTypes';
import type {LoggerFactory} from '@fluxer/logger/src/LoggerInterface';
import type {AppEnv} from '@fluxer/queue/src/api/QueueApiTypes';
import {createRoutes} from '@fluxer/queue/src/api/Routes';
import {CronScheduler} from '@fluxer/queue/src/cron/CronScheduler';
import {QueueEngine} from '@fluxer/queue/src/engine/QueueEngine';
import type {QueueConfig} from '@fluxer/queue/src/types/QueueConfig';
import type {RateLimitService} from '@fluxer/rate_limit/src/RateLimitService';
import {captureException} from '@fluxer/sentry/src/Sentry';
import {Hono} from 'hono';
import {createMiddleware} from 'hono/factory';

export interface CreateQueueAppOptions {
	config: QueueConfig;
	loggerFactory: LoggerFactory;
	metricsCollector?: MetricsCollector;
	tracing?: TracingOptions;
	rateLimitService?: RateLimitService | null;
	rateLimitConfig?: {
		enabled: boolean;
		maxAttempts: number;
		windowMs: number;
		skipPaths?: Array<string>;
	} | null;
	internalSecret?: string;
}

export interface QueueAppResult {
	app: Hono<AppEnv>;
	engine: QueueEngine;
	cronScheduler: CronScheduler;
	start: () => Promise<void>;
	shutdown: () => Promise<void>;
}

export function createQueueApp(options: CreateQueueAppOptions): QueueAppResult {
	const {config, loggerFactory, metricsCollector, tracing, rateLimitService, rateLimitConfig, internalSecret} = options;
	const logger = loggerFactory('QueueApp');

	const engine = new QueueEngine(config, loggerFactory);
	const cronScheduler = new CronScheduler(config, engine, loggerFactory);

	const start = async (): Promise<void> => {
		await engine.start();
		await cronScheduler.start();
	};

	const shutdown = async (): Promise<void> => {
		await cronScheduler.stop();
		await engine.stop();
	};

	const ServiceMiddleware = createMiddleware<AppEnv>(async (ctx, next) => {
		ctx.set('queueEngine', engine);
		ctx.set('cronScheduler', cronScheduler);
		ctx.set('logger', logger);
		await next();
	});

	const app = new Hono<AppEnv>();

	applyMiddlewareStack(app, {
		requestId: {},
		tracing,
		metrics: metricsCollector
			? {
					enabled: true,
					collector: metricsCollector,
					skipPaths: ['/_health'],
				}
			: undefined,
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
		logger: {
			log: (data: {method: string; path: string; status: number; durationMs: number}) => {
				if (data.path !== '/_health') {
					logger.debug(
						{
							method: data.method,
							path: data.path,
							status: data.status,
							durationMs: data.durationMs,
						},
						'Request completed',
					);
				}
			},
		},
		customMiddleware: internalSecret
			? [createInternalAuth({secret: internalSecret, skipPaths: ['/_health']}), ServiceMiddleware]
			: [ServiceMiddleware],
		skipErrorHandler: true,
	});

	const errorHandler = createErrorHandler({
		includeStack: false,
		logError: (err: Error, ctx: {req: {path: string; method: string}}) => {
			logger.error(
				{
					error: err.message,
					stack: err.stack,
					path: ctx.req.path,
					method: ctx.req.method,
				},
				'Request error',
			);

			const isExpectedError = err instanceof Error && 'isExpected' in err && err.isExpected;
			if (!isExpectedError) {
				captureException(err);
			}
		},
	});

	app.onError(errorHandler);

	const routes = createRoutes();
	app.route('/', routes);

	app.notFound(AppNotFoundHandler);

	return {app, engine, cronScheduler, start, shutdown};
}
