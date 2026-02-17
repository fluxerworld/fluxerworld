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
import {
	applyMiddlewareStack,
	createDefaultErrorLogger,
	createDefaultLogger,
	createStandardMiddlewareStack,
} from '@fluxer/hono/src/middleware/MiddlewareStack';
import type {RateLimitResult, RateLimitService} from '@fluxer/hono/src/middleware/RateLimit';
import {REQUEST_ID_KEY} from '@fluxer/hono/src/middleware/RequestId';
import type {MetricsCollector} from '@fluxer/hono_types/src/MetricsTypes';
import type {Context} from 'hono';
import {Hono} from 'hono';
import {describe, expect, test, vi} from 'vitest';

function createMockRateLimitService(result: Partial<RateLimitResult> = {}): RateLimitService {
	const defaultResult: RateLimitResult = {
		allowed: true,
		limit: 100,
		remaining: 99,
		resetTime: new Date(Date.now() + 60000),
		...result,
	};

	return {
		checkLimit: vi.fn().mockResolvedValue(defaultResult),
	};
}

function createMockCollector(): MetricsCollector {
	return {
		recordCounter: vi.fn(),
		recordHistogram: vi.fn(),
		recordGauge: vi.fn(),
	};
}

describe('createStandardMiddlewareStack', () => {
	test('returns empty array with no options', () => {
		const stack = createStandardMiddlewareStack();
		expect(stack).toHaveLength(0);
	});

	test('includes requestId middleware when configured', () => {
		const stack = createStandardMiddlewareStack({requestId: {}});
		expect(stack).toHaveLength(1);
	});

	test('includes cors middleware when enabled', () => {
		const stack = createStandardMiddlewareStack({cors: {enabled: true}});
		expect(stack).toHaveLength(1);
	});

	test('excludes cors middleware when disabled', () => {
		const stack = createStandardMiddlewareStack({cors: {enabled: false}});
		expect(stack).toHaveLength(0);
	});

	test('includes tracing middleware when enabled with functions', () => {
		const stack = createStandardMiddlewareStack({
			tracing: {
				enabled: true,
				withSpan: vi.fn(),
				setSpanAttributes: vi.fn(),
			},
		});
		expect(stack).toHaveLength(1);
	});

	test('excludes tracing middleware when disabled', () => {
		const stack = createStandardMiddlewareStack({
			tracing: {enabled: false, withSpan: vi.fn(), setSpanAttributes: vi.fn()},
		});
		expect(stack).toHaveLength(0);
	});

	test('includes metrics middleware when enabled with collector', () => {
		const stack = createStandardMiddlewareStack({
			metrics: {enabled: true, collector: createMockCollector()},
		});
		expect(stack).toHaveLength(1);
	});

	test('excludes metrics middleware when no collector provided', () => {
		const stack = createStandardMiddlewareStack({metrics: {enabled: true}});
		expect(stack).toHaveLength(0);
	});

	test('includes logger middleware when log function provided', () => {
		const stack = createStandardMiddlewareStack({logger: {log: vi.fn()}});
		expect(stack).toHaveLength(1);
	});

	test('excludes logger middleware when no log function', () => {
		const stack = createStandardMiddlewareStack({logger: {}});
		expect(stack).toHaveLength(0);
	});

	test('includes rateLimit middleware when enabled with service', () => {
		const stack = createStandardMiddlewareStack({
			rateLimit: {enabled: true, service: createMockRateLimitService()},
		});
		expect(stack).toHaveLength(1);
	});

	test('excludes rateLimit middleware when no service provided', () => {
		const stack = createStandardMiddlewareStack({rateLimit: {enabled: true}});
		expect(stack).toHaveLength(0);
	});

	test('includes custom middleware', () => {
		const customMiddleware = vi.fn();
		const stack = createStandardMiddlewareStack({
			customMiddleware: [customMiddleware, customMiddleware],
		});
		expect(stack).toHaveLength(2);
	});

	test('combines all middleware in correct order', () => {
		const stack = createStandardMiddlewareStack({
			requestId: {},
			cors: {enabled: true},
			tracing: {enabled: true, withSpan: vi.fn(), setSpanAttributes: vi.fn()},
			metrics: {enabled: true, collector: createMockCollector()},
			logger: {log: vi.fn()},
			rateLimit: {enabled: true, service: createMockRateLimitService()},
			customMiddleware: [vi.fn()],
		});
		expect(stack).toHaveLength(7);
	});
});

describe('applyMiddlewareStack', () => {
	test('applies requestId middleware', async () => {
		const app = new Hono<{Variables: {[REQUEST_ID_KEY]: string}}>();
		applyMiddlewareStack(app, {requestId: {}});
		app.get('/test', (c) => c.json({id: c.get(REQUEST_ID_KEY)}));

		const response = await app.request('/test');
		expect(response.headers.get(Headers.X_REQUEST_ID)).toBeTruthy();
	});

	test('applies cors middleware', async () => {
		const app = new Hono();
		applyMiddlewareStack(app, {cors: {enabled: true, origins: '*'}});
		app.get('/test', (c) => c.json({ok: true}));

		const response = await app.request('/test', {
			headers: {origin: 'https://example.com'},
		});
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
	});

	test('applies error handler by default', async () => {
		const app = new Hono();
		applyMiddlewareStack(app, {});
		app.get('/test', () => {
			throw new Error('Test error');
		});

		const response = await app.request('/test');
		expect(response.status).toBe(500);
		const body = (await response.json()) as {code: string};
		expect(body.code).toBe('INTERNAL_SERVER_ERROR');
	});

	test('skips requestId when skipRequestId is true', async () => {
		const app = new Hono<{Variables: {[REQUEST_ID_KEY]: string}}>();
		applyMiddlewareStack(app, {
			requestId: {},
			skipRequestId: true,
		});
		app.get('/test', (c) => c.json({id: c.get(REQUEST_ID_KEY)}));

		const response = await app.request('/test');
		expect(response.headers.get(Headers.X_REQUEST_ID)).toBeNull();
	});

	test('skips cors when skipCors is true', async () => {
		const app = new Hono();
		applyMiddlewareStack(app, {
			cors: {enabled: true, origins: '*'},
			skipCors: true,
		});
		app.get('/test', (c) => c.json({ok: true}));

		const response = await app.request('/test', {
			headers: {origin: 'https://example.com'},
		});
		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
	});

	test('skips tracing when skipTracing is true', async () => {
		const withSpan = vi.fn();
		const app = new Hono();
		applyMiddlewareStack(app, {
			tracing: {enabled: true, withSpan, setSpanAttributes: vi.fn()},
			skipTracing: true,
		});
		app.get('/test', (c) => c.json({ok: true}));

		await app.request('/test');
		expect(withSpan).not.toHaveBeenCalled();
	});

	test('skips metrics when skipMetrics is true', async () => {
		const collector = createMockCollector();
		const app = new Hono();
		applyMiddlewareStack(app, {
			metrics: {enabled: true, collector},
			skipMetrics: true,
		});
		app.get('/test', (c) => c.json({ok: true}));

		await app.request('/test');
		expect(collector.recordCounter).not.toHaveBeenCalled();
	});

	test('skips logger when skipLogger is true', async () => {
		const log = vi.fn();
		const app = new Hono();
		applyMiddlewareStack(app, {
			logger: {log},
			skipLogger: true,
		});
		app.get('/test', (c) => c.json({ok: true}));

		await app.request('/test');
		expect(log).not.toHaveBeenCalled();
	});

	test('skips rateLimit when skipRateLimit is true', async () => {
		const service = createMockRateLimitService();
		const app = new Hono();
		applyMiddlewareStack(app, {
			rateLimit: {enabled: true, service},
			skipRateLimit: true,
		});
		app.get('/test', (c) => c.json({ok: true}));

		await app.request('/test');
		expect(service.checkLimit).not.toHaveBeenCalled();
	});

	test('skips errorHandler when skipErrorHandler is true', async () => {
		const app = new Hono();
		applyMiddlewareStack(app, {
			skipErrorHandler: true,
		});
		app.get('/test', () => {
			throw new Error('Test error');
		});

		const response = await app.request('/test');
		expect(response.status).toBe(500);
	});

	test('applies custom middleware', async () => {
		const customMiddleware = vi.fn().mockImplementation(async (_c, next) => {
			await next();
		});
		const app = new Hono();
		applyMiddlewareStack(app, {
			customMiddleware: [customMiddleware],
		});
		app.get('/test', (c) => c.json({ok: true}));

		await app.request('/test');
		expect(customMiddleware).toHaveBeenCalled();
	});

	test('applies logger with skip paths', async () => {
		const log = vi.fn();
		const app = new Hono();
		applyMiddlewareStack(app, {
			logger: {log, skip: ['/_health']},
		});
		app.get('/_health', (c) => c.json({ok: true}));
		app.get('/api', (c) => c.json({ok: true}));

		await app.request('/_health');
		expect(log).not.toHaveBeenCalled();

		await app.request('/api');
		expect(log).toHaveBeenCalled();
	});
});

describe('createDefaultLogger', () => {
	test('logs request data as JSON', async () => {
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const logger = createDefaultLogger({serviceName: 'test-service'});

		logger({method: 'GET', path: '/api/test', status: 200, durationMs: 50});

		expect(consoleSpy).toHaveBeenCalledTimes(1);
		const loggedData = JSON.parse(consoleSpy.mock.calls[0][0] as string);
		expect(loggedData.service).toBe('test-service');
		expect(loggedData.method).toBe('GET');
		expect(loggedData.path).toBe('/api/test');
		expect(loggedData.status).toBe(200);
		expect(loggedData.durationMs).toBe(50);
		expect(loggedData.timestamp).toBeTruthy();

		consoleSpy.mockRestore();
	});

	test('skips paths in skip array', () => {
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const logger = createDefaultLogger({serviceName: 'test-service', skip: ['/_health']});

		logger({method: 'GET', path: '/_health', status: 200, durationMs: 1});

		expect(consoleSpy).not.toHaveBeenCalled();

		consoleSpy.mockRestore();
	});

	test('logs paths not in skip array', () => {
		const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const logger = createDefaultLogger({serviceName: 'test-service', skip: ['/_health']});

		logger({method: 'GET', path: '/api/users', status: 200, durationMs: 1});

		expect(consoleSpy).toHaveBeenCalledTimes(1);

		consoleSpy.mockRestore();
	});
});

describe('createDefaultErrorLogger', () => {
	test('logs error data as JSON', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const errorLogger = createDefaultErrorLogger({serviceName: 'test-service'});

		const mockContext = {
			req: {
				path: '/api/test',
				method: 'POST',
			},
		} as unknown as Context;

		const error = new Error('Test error');
		errorLogger(error, mockContext);

		expect(consoleSpy).toHaveBeenCalledTimes(1);
		const loggedData = JSON.parse(consoleSpy.mock.calls[0][0] as string);
		expect(loggedData.service).toBe('test-service');
		expect(loggedData.error).toBe('Test error');
		expect(loggedData.stack).toBeTruthy();
		expect(loggedData.path).toBe('/api/test');
		expect(loggedData.method).toBe('POST');
		expect(loggedData.timestamp).toBeTruthy();

		consoleSpy.mockRestore();
	});
});

describe('integration tests', () => {
	test('full middleware stack works together', async () => {
		const log = vi.fn();
		const collector = createMockCollector();
		const rateLimitService = createMockRateLimitService();

		const app = new Hono();
		applyMiddlewareStack(app, {
			requestId: {},
			cors: {enabled: true, origins: '*'},
			metrics: {enabled: true, collector},
			logger: {log},
			rateLimit: {enabled: true, service: rateLimitService},
		});
		app.get('/test', (c) => c.json({ok: true}));

		const response = await app.request('/test');

		expect(response.status).toBe(200);
		expect(response.headers.get(Headers.X_REQUEST_ID)).toBeTruthy();
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
		expect(log).toHaveBeenCalled();
		expect(collector.recordCounter).toHaveBeenCalled();
		expect(rateLimitService.checkLimit).toHaveBeenCalled();
	});

	test('error handler catches errors from routes', async () => {
		const app = new Hono();
		applyMiddlewareStack(app, {requestId: {}});
		app.get('/error', () => {
			throw new Error('Route error');
		});

		const response = await app.request('/error');
		expect(response.status).toBe(500);
		expect(response.headers.get(Headers.X_REQUEST_ID)).toBeTruthy();
	});

	test('rate limiter blocks requests when limit exceeded', async () => {
		const rateLimitService = createMockRateLimitService({allowed: false, remaining: 0});

		const app = new Hono();
		applyMiddlewareStack(app, {
			rateLimit: {enabled: true, service: rateLimitService},
		});
		app.get('/test', (c) => c.json({ok: true}));

		const response = await app.request('/test');
		expect(response.status).toBe(429);
	});

	test('health endpoints are skipped by default for rate limiting', async () => {
		const rateLimitService = createMockRateLimitService();

		const app = new Hono();
		applyMiddlewareStack(app, {
			rateLimit: {enabled: true, service: rateLimitService},
		});
		app.get('/_health', (c) => c.json({ok: true}));

		await app.request('/_health');
		expect(rateLimitService.checkLimit).not.toHaveBeenCalled();
	});
});
