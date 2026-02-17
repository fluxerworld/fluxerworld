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

import type {AppProxyConfig, AppProxyHonoEnv, AppProxyMiddleware} from '@fluxer/app_proxy/src/AppProxyTypes';
import {createProxyRateLimitMiddleware} from '@fluxer/app_proxy/src/app_proxy/middleware/ProxyRateLimit';
import {createSentryHostProxyMiddleware} from '@fluxer/app_proxy/src/app_proxy/middleware/SentryHostProxy';
import {proxySentry} from '@fluxer/app_proxy/src/app_proxy/proxy/SentryProxy';
import {resolveSentryHost} from '@fluxer/app_proxy/src/app_proxy/utils/Host';
import {isExpectedError} from '@fluxer/app_proxy/src/ErrorClassification';
import {applyMiddlewareStack} from '@fluxer/hono/src/middleware/MiddlewareStack';
import type {MetricsCollector} from '@fluxer/hono_types/src/MetricsTypes';
import type {TracingOptions} from '@fluxer/hono_types/src/TracingTypes';
import type {Logger} from '@fluxer/logger/src/Logger';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import {captureException} from '@fluxer/sentry/src/Sentry';
import type {Context, Hono} from 'hono';

interface ApplyAppProxyMiddlewareOptions {
	app: Hono<AppProxyHonoEnv>;
	config: AppProxyConfig;
	customMiddleware: Array<AppProxyMiddleware>;
	logger: Logger;
	metricsCollector?: MetricsCollector;
	rateLimitService: IRateLimitService | null;
	sentryProxyEnabled: boolean;
	sentryProxyPath: string;
	tracing?: TracingOptions;
}

export function applyAppProxyMiddleware(options: ApplyAppProxyMiddlewareOptions): void {
	const {
		app,
		config,
		customMiddleware,
		logger,
		metricsCollector,
		rateLimitService,
		sentryProxyEnabled,
		sentryProxyPath,
		tracing,
	} = options;

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
			skip: ['/_health'],
		},
		errorHandler: {
			includeStack: !sentryProxyEnabled,
			logger: (error: Error, ctx: Context) => {
				if (!isExpectedError(error)) {
					captureException(error, {
						path: ctx.req.path,
						method: ctx.req.method,
					});
				}

				logger.error(
					{
						error: error.message,
						stack: error.stack,
						path: ctx.req.path,
						method: ctx.req.method,
					},
					'Request error',
				);
			},
		},
		customMiddleware,
	});

	applySentryHostProxyMiddleware({
		app,
		config,
		logger,
		rateLimitService,
		sentryProxyEnabled,
		sentryProxyPath,
	});
}

interface ApplySentryHostProxyMiddlewareOptions {
	app: Hono<AppProxyHonoEnv>;
	config: AppProxyConfig;
	logger: Logger;
	rateLimitService: IRateLimitService | null;
	sentryProxyEnabled: boolean;
	sentryProxyPath: string;
}

function applySentryHostProxyMiddleware(options: ApplySentryHostProxyMiddlewareOptions): void {
	const {app, config, logger, rateLimitService, sentryProxyEnabled, sentryProxyPath} = options;
	const sentryHost = resolveSentryHost(config);
	const sentryProxy = config.sentry_proxy;

	if (!sentryProxyEnabled || !sentryHost || !sentryProxy) {
		return;
	}

	const sentryRateLimitMiddleware = createProxyRateLimitMiddleware({
		rateLimitService,
		bucketPrefix: 'sentry-proxy',
		config: {
			enabled: config.rate_limit.sentry.limit > 0,
			limit: config.rate_limit.sentry.limit,
			windowMs: config.rate_limit.sentry.window_ms,
			skipPaths: ['/_health'],
		},
		logger,
	});

	const sentryHostMiddleware = createSentryHostProxyMiddleware({
		sentryHost,
		rateLimitMiddleware: sentryRateLimitMiddleware,
		proxyHandler: (c) =>
			proxySentry(c, {
				enabled: true,
				logger,
				sentryProxy,
				sentryProxyPath,
			}),
	});

	app.use('*', sentryHostMiddleware);
}
