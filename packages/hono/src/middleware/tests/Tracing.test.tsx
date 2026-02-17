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

import {tracing} from '@fluxer/hono/src/middleware/Tracing';
import {Hono} from 'hono';
import {describe, expect, test, vi} from 'vitest';

describe('Tracing Middleware', () => {
	describe('enabled option', () => {
		test('skips tracing when enabled is false', async () => {
			const withSpan = vi.fn();
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({enabled: false, withSpan, setSpanAttributes}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.status).toBe(200);
			expect(withSpan).not.toHaveBeenCalled();
			expect(setSpanAttributes).not.toHaveBeenCalled();
		});

		test('processes tracing when enabled is true', async () => {
			const withSpan = vi.fn().mockImplementation(async (_name, fn) => fn());
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({enabled: true, withSpan, setSpanAttributes}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.status).toBe(200);
			expect(withSpan).toHaveBeenCalled();
		});
	});

	describe('skip paths', () => {
		test('skips default health paths', async () => {
			const withSpan = vi.fn();
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({withSpan, setSpanAttributes}));
			app.get('/_health', (c) => c.json({ok: true}));
			app.get('/metrics', (c) => c.json({ok: true}));

			await app.request('/_health');
			await app.request('/metrics');

			expect(withSpan).not.toHaveBeenCalled();
		});

		test('skips custom paths', async () => {
			const withSpan = vi.fn();
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({skipPaths: ['/custom-skip'], withSpan, setSpanAttributes}));
			app.get('/custom-skip', (c) => c.json({ok: true}));
			app.get('/not-skipped', (c) => c.json({ok: true}));

			await app.request('/custom-skip');
			expect(withSpan).not.toHaveBeenCalled();
		});

		test('skips paths with wildcard patterns', async () => {
			const withSpan = vi.fn();
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({skipPaths: ['/admin/*'], withSpan, setSpanAttributes}));
			app.get('/admin/users', (c) => c.json({ok: true}));
			app.get('/admin/settings', (c) => c.json({ok: true}));
			app.get('/api/users', (c) => c.json({ok: true}));

			await app.request('/admin/users');
			await app.request('/admin/settings');
			expect(withSpan).not.toHaveBeenCalled();
		});

		test('traces non-skipped paths', async () => {
			const withSpan = vi.fn().mockImplementation(async (_name, fn) => fn());
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({skipPaths: ['/skip-this'], withSpan, setSpanAttributes}));
			app.get('/trace-this', (c) => c.json({ok: true}));

			await app.request('/trace-this');
			expect(withSpan).toHaveBeenCalled();
		});
	});

	describe('span creation', () => {
		test('creates span with correct name format', async () => {
			const withSpan = vi.fn().mockImplementation(async (_name, fn) => fn());
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({withSpan, setSpanAttributes}));
			app.get('/api/users', (c) => c.json({ok: true}));

			await app.request('/api/users');

			expect(withSpan).toHaveBeenCalledWith('http.request GET /api/users', expect.any(Function));
		});

		test('creates span with POST method', async () => {
			const withSpan = vi.fn().mockImplementation(async (_name, fn) => fn());
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({withSpan, setSpanAttributes}));
			app.post('/api/users', (c) => c.json({ok: true}));

			await app.request('/api/users', {method: 'POST'});

			expect(withSpan).toHaveBeenCalledWith('http.request POST /api/users', expect.any(Function));
		});
	});

	describe('span attributes', () => {
		test('sets initial request attributes', async () => {
			const withSpan = vi.fn().mockImplementation(async (_name, fn) => fn());
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({serviceName: 'test-service', withSpan, setSpanAttributes}));
			app.get('/api/test', (c) => c.json({ok: true}));

			await app.request('http://localhost/api/test', {
				headers: {
					host: 'localhost',
					'user-agent': 'TestAgent/1.0',
				},
			});

			expect(setSpanAttributes).toHaveBeenCalledWith(
				expect.objectContaining({
					'http.method': 'GET',
					'http.target': '/api/test',
					'http.host': 'localhost',
					'http.user_agent': 'TestAgent/1.0',
					'service.name': 'test-service',
				}),
			);
		});

		test('sets response attributes after handler completes', async () => {
			const withSpan = vi.fn().mockImplementation(async (_name, fn) => fn());
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({withSpan, setSpanAttributes}));
			app.get('/api/test', (c) => c.json({status: 'ok'}));

			await app.request('/api/test');

			expect(setSpanAttributes).toHaveBeenCalledWith(
				expect.objectContaining({
					'http.status_code': 200,
				}),
			);
		});

		test('sets duration attribute', async () => {
			const withSpan = vi.fn().mockImplementation(async (_name, fn) => fn());
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({withSpan, setSpanAttributes}));
			app.get('/api/test', (c) => c.json({ok: true}));

			await app.request('/api/test');

			const callWithDuration = setSpanAttributes.mock.calls.find((call) => Object.hasOwn(call[0], 'http.duration_ms'));
			expect(callWithDuration).toBeTruthy();
			expect(callWithDuration![0]['http.duration_ms']).toBeGreaterThanOrEqual(0);
		});

		test('uses x-forwarded-proto header for scheme', async () => {
			const withSpan = vi.fn().mockImplementation(async (_name, fn) => fn());
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({withSpan, setSpanAttributes}));
			app.get('/api/test', (c) => c.json({ok: true}));

			await app.request('/api/test', {
				headers: {'x-forwarded-proto': 'https'},
			});

			expect(setSpanAttributes).toHaveBeenCalledWith(
				expect.objectContaining({
					'http.scheme': 'https',
				}),
			);
		});

		test('defaults to http scheme when x-forwarded-proto not present', async () => {
			const withSpan = vi.fn().mockImplementation(async (_name, fn) => fn());
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({withSpan, setSpanAttributes}));
			app.get('/api/test', (c) => c.json({ok: true}));

			await app.request('/api/test');

			expect(setSpanAttributes).toHaveBeenCalledWith(
				expect.objectContaining({
					'http.scheme': 'http',
				}),
			);
		});
	});

	describe('missing tracing functions', () => {
		test('skips tracing when withSpan is not provided', async () => {
			const app = new Hono();
			app.use('*', tracing({setSpanAttributes: vi.fn()}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.status).toBe(200);
		});

		test('skips tracing when setSpanAttributes is not provided', async () => {
			const app = new Hono();
			app.use('*', tracing({withSpan: vi.fn()}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.status).toBe(200);
		});

		test('processes request normally when both are missing', async () => {
			const app = new Hono();
			app.use('*', tracing());
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.status).toBe(200);
			const body = (await response.json()) as {ok: boolean};
			expect(body.ok).toBe(true);
		});
	});

	describe('service name', () => {
		test('uses custom service name', async () => {
			const withSpan = vi.fn().mockImplementation(async (_name, fn) => fn());
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({serviceName: 'my-custom-service', withSpan, setSpanAttributes}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(setSpanAttributes).toHaveBeenCalledWith(
				expect.objectContaining({
					'service.name': 'my-custom-service',
				}),
			);
		});

		test('uses default service name when not specified', async () => {
			const withSpan = vi.fn().mockImplementation(async (_name, fn) => fn());
			const setSpanAttributes = vi.fn();

			const app = new Hono();
			app.use('*', tracing({withSpan, setSpanAttributes}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(setSpanAttributes).toHaveBeenCalledWith(
				expect.objectContaining({
					'service.name': 'hono-service',
				}),
			);
		});
	});
});
