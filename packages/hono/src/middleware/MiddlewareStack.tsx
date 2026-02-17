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

import type {CorsOptions} from '@fluxer/hono/src/middleware/Cors';
import {cors} from '@fluxer/hono/src/middleware/Cors';
import type {ErrorHandlerOptions} from '@fluxer/hono/src/middleware/ErrorHandler';
import {createErrorHandler} from '@fluxer/hono/src/middleware/ErrorHandler';
import type {MetricsOptions} from '@fluxer/hono/src/middleware/Metrics';
import {metrics} from '@fluxer/hono/src/middleware/Metrics';
import type {RateLimitOptions, RateLimitService} from '@fluxer/hono/src/middleware/RateLimit';
import {rateLimit} from '@fluxer/hono/src/middleware/RateLimit';
import type {RequestIdOptions} from '@fluxer/hono/src/middleware/RequestId';
import {requestId} from '@fluxer/hono/src/middleware/RequestId';
import type {LogFunction, RequestLoggerOptions} from '@fluxer/hono/src/middleware/RequestLogger';
import {requestLogger} from '@fluxer/hono/src/middleware/RequestLogger';
import {tracing} from '@fluxer/hono/src/middleware/Tracing';
import type {MetricsCollector} from '@fluxer/hono_types/src/MetricsTypes';
import type {TracingOptions} from '@fluxer/hono_types/src/TracingTypes';
import type {Context, Env, Hono, MiddlewareHandler} from 'hono';

export interface MiddlewareStackOptions {
	requestId?: RequestIdOptions;
	cors?: CorsOptions;
	tracing?: TracingOptions;
	metrics?: MetricsOptions & {collector?: MetricsCollector};
	logger?: Omit<RequestLoggerOptions, 'log'> & {log?: LogFunction};
	rateLimit?: RateLimitOptions & {service?: RateLimitService};
	errorHandler?: ErrorHandlerOptions;
	customMiddleware?: Array<MiddlewareHandler>;
}

export interface ApplyMiddlewareStackOptions extends MiddlewareStackOptions {
	skipRequestId?: boolean;
	skipCors?: boolean;
	skipTracing?: boolean;
	skipMetrics?: boolean;
	skipLogger?: boolean;
	skipRateLimit?: boolean;
	skipErrorHandler?: boolean;
}

export function createStandardMiddlewareStack(options: MiddlewareStackOptions = {}): Array<MiddlewareHandler> {
	const stack: Array<MiddlewareHandler> = [];

	if (options.requestId) {
		stack.push(requestId(options.requestId));
	}

	if (options.cors && options.cors.enabled !== false) {
		stack.push(cors(options.cors));
	}

	if (options.tracing && options.tracing.enabled !== false) {
		stack.push(tracing(options.tracing));
	}

	if (options.metrics && options.metrics.enabled !== false && options.metrics.collector) {
		stack.push(metrics(options.metrics));
	}

	if (options.logger?.log) {
		stack.push(
			requestLogger({
				log: options.logger.log,
				skip: options.logger.skip,
			}),
		);
	}

	if (options.rateLimit && options.rateLimit.enabled !== false && options.rateLimit.service) {
		stack.push(rateLimit(options.rateLimit));
	}

	if (options.customMiddleware) {
		stack.push(...options.customMiddleware);
	}

	return stack;
}

function buildStackOptions(options: ApplyMiddlewareStackOptions): MiddlewareStackOptions {
	return {
		requestId: options.skipRequestId ? undefined : options.requestId,
		cors: options.skipCors ? undefined : options.cors,
		tracing: options.skipTracing ? undefined : options.tracing,
		metrics: options.skipMetrics ? undefined : options.metrics,
		logger: options.skipLogger ? undefined : options.logger,
		rateLimit: options.skipRateLimit ? undefined : options.rateLimit,
		customMiddleware: options.customMiddleware,
	};
}

export function applyMiddlewareStack<E extends Env = Env>(
	app: Hono<E>,
	options: ApplyMiddlewareStackOptions = {},
): void {
	const stack = createStandardMiddlewareStack(buildStackOptions(options));

	for (const middleware of stack) {
		app.use('*', middleware);
	}

	if (!options.skipErrorHandler) {
		const errorHandler = createErrorHandler(options.errorHandler ?? {});
		app.onError(errorHandler);
	}
}

export function createDefaultLogger(options: {serviceName: string; skip?: Array<string>}): LogFunction {
	return (data) => {
		if (options.skip?.includes(data.path)) {
			return;
		}
		console.log(
			JSON.stringify({
				service: options.serviceName,
				method: data.method,
				path: data.path,
				status: data.status,
				durationMs: data.durationMs,
				timestamp: new Date().toISOString(),
			}),
		);
	};
}

export function createDefaultErrorLogger(options: {serviceName: string}): (error: Error, context: Context) => void {
	return (error: Error, context: Context) => {
		console.error(
			JSON.stringify({
				service: options.serviceName,
				error: error.message,
				stack: error.stack,
				path: context.req.path,
				method: context.req.method,
				timestamp: new Date().toISOString(),
			}),
		);
	};
}
