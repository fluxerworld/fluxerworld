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

import {requestLogger} from '@fluxer/hono/src/middleware/RequestLogger';
import {Hono} from 'hono';
import {describe, expect, test, vi} from 'vitest';

describe('RequestLogger Middleware', () => {
	describe('logging', () => {
		test('calls log function with request data', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(log).toHaveBeenCalledTimes(1);
			expect(log).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'GET',
					path: '/test',
					status: 200,
				}),
			);
		});

		test('includes method in log data', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.post('/users', (c) => c.json({created: true}));

			await app.request('/users', {method: 'POST'});

			expect(log).toHaveBeenCalledWith(
				expect.objectContaining({
					method: 'POST',
				}),
			);
		});

		test('includes path in log data', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.get('/api/users/123', (c) => c.json({ok: true}));

			await app.request('/api/users/123');

			expect(log).toHaveBeenCalledWith(
				expect.objectContaining({
					path: '/api/users/123',
				}),
			);
		});

		test('includes status code in log data', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.get('/error', (c) => c.json({error: 'Not found'}, 404));

			await app.request('/error');

			expect(log).toHaveBeenCalledWith(
				expect.objectContaining({
					status: 404,
				}),
			);
		});

		test('includes durationMs in log data', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(log).toHaveBeenCalledWith(
				expect.objectContaining({
					durationMs: expect.any(Number),
				}),
			);
			expect(log.mock.calls[0][0].durationMs).toBeGreaterThanOrEqual(0);
		});
	});

	describe('skip option', () => {
		test('skips logging for paths in skip array', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log, skip: ['/_health']}));
			app.get('/_health', (c) => c.json({ok: true}));

			await app.request('/_health');

			expect(log).not.toHaveBeenCalled();
		});

		test('logs paths not in skip array', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log, skip: ['/_health']}));
			app.get('/api/users', (c) => c.json({ok: true}));

			await app.request('/api/users');

			expect(log).toHaveBeenCalled();
		});

		test('skips multiple paths', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log, skip: ['/_health', '/metrics', '/_health']}));
			app.get('/_health', (c) => c.json({ok: true}));
			app.get('/metrics', (c) => c.json({ok: true}));
			app.get('/_health', (c) => c.json({ok: true}));

			await app.request('/_health');
			await app.request('/metrics');
			await app.request('/_health');

			expect(log).not.toHaveBeenCalled();
		});

		test('uses empty skip array by default', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.get('/_health', (c) => c.json({ok: true}));

			await app.request('/_health');

			expect(log).toHaveBeenCalled();
		});
	});

	describe('different HTTP methods', () => {
		test('logs GET requests', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(log).toHaveBeenCalledWith(expect.objectContaining({method: 'GET'}));
		});

		test('logs POST requests', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.post('/test', (c) => c.json({ok: true}));

			await app.request('/test', {method: 'POST'});

			expect(log).toHaveBeenCalledWith(expect.objectContaining({method: 'POST'}));
		});

		test('logs PUT requests', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.put('/test', (c) => c.json({ok: true}));

			await app.request('/test', {method: 'PUT'});

			expect(log).toHaveBeenCalledWith(expect.objectContaining({method: 'PUT'}));
		});

		test('logs DELETE requests', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.delete('/test', (c) => c.json({ok: true}));

			await app.request('/test', {method: 'DELETE'});

			expect(log).toHaveBeenCalledWith(expect.objectContaining({method: 'DELETE'}));
		});

		test('logs PATCH requests', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.patch('/test', (c) => c.json({ok: true}));

			await app.request('/test', {method: 'PATCH'});

			expect(log).toHaveBeenCalledWith(expect.objectContaining({method: 'PATCH'}));
		});
	});

	describe('different status codes', () => {
		test('logs 200 OK responses', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(log).toHaveBeenCalledWith(expect.objectContaining({status: 200}));
		});

		test('logs 201 Created responses', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.post('/test', (c) => c.json({created: true}, 201));

			await app.request('/test', {method: 'POST'});

			expect(log).toHaveBeenCalledWith(expect.objectContaining({status: 201}));
		});

		test('logs 400 Bad Request responses', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.get('/test', (c) => c.json({error: 'Bad Request'}, 400));

			await app.request('/test');

			expect(log).toHaveBeenCalledWith(expect.objectContaining({status: 400}));
		});

		test('logs 500 Internal Server Error responses', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.get('/test', (c) => c.json({error: 'Server Error'}, 500));

			await app.request('/test');

			expect(log).toHaveBeenCalledWith(expect.objectContaining({status: 500}));
		});
	});

	describe('multiple requests', () => {
		test('logs each request separately', async () => {
			const log = vi.fn();
			const app = new Hono();
			app.use('*', requestLogger({log}));
			app.get('/first', (c) => c.json({ok: true}));
			app.get('/second', (c) => c.json({ok: true}));

			await app.request('/first');
			await app.request('/second');

			expect(log).toHaveBeenCalledTimes(2);
			expect(log).toHaveBeenNthCalledWith(1, expect.objectContaining({path: '/first'}));
			expect(log).toHaveBeenNthCalledWith(2, expect.objectContaining({path: '/second'}));
		});
	});
});
