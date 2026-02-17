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

import {metrics} from '@fluxer/hono/src/middleware/Metrics';
import type {MetricsCollector} from '@fluxer/hono_types/src/MetricsTypes';
import {Hono} from 'hono';
import {describe, expect, test, vi} from 'vitest';

function createMockCollector(): MetricsCollector {
	return {
		recordCounter: vi.fn(),
		recordHistogram: vi.fn(),
		recordGauge: vi.fn(),
	};
}

describe('Metrics Middleware', () => {
	describe('enabled option', () => {
		test('skips metrics when enabled is false', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({enabled: false, collector}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');
			expect(collector.recordCounter).not.toHaveBeenCalled();
			expect(collector.recordHistogram).not.toHaveBeenCalled();
		});

		test('skips metrics when collector is not provided', async () => {
			const app = new Hono();
			app.use('*', metrics({enabled: true}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.status).toBe(200);
		});

		test('records metrics when enabled and collector provided', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({enabled: true, collector}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');
			expect(collector.recordCounter).toHaveBeenCalled();
			expect(collector.recordHistogram).toHaveBeenCalled();
		});
	});

	describe('skip paths', () => {
		test('skips default health paths', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector}));
			app.get('/_health', (c) => c.json({ok: true}));
			app.get('/metrics', (c) => c.json({ok: true}));

			await app.request('/_health');
			await app.request('/metrics');

			expect(collector.recordCounter).not.toHaveBeenCalled();
		});

		test('skips custom paths', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({skipPaths: ['/internal'], collector}));
			app.get('/internal', (c) => c.json({ok: true}));

			await app.request('/internal');
			expect(collector.recordCounter).not.toHaveBeenCalled();
		});

		test('skips paths with wildcard patterns', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({skipPaths: ['/admin/*'], collector}));
			app.get('/admin/dashboard', (c) => c.json({ok: true}));
			app.get('/admin/users', (c) => c.json({ok: true}));

			await app.request('/admin/dashboard');
			await app.request('/admin/users');

			expect(collector.recordCounter).not.toHaveBeenCalled();
		});

		test('records metrics for non-skipped paths', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({skipPaths: ['/skip'], collector}));
			app.get('/api/users', (c) => c.json({ok: true}));

			await app.request('/api/users');
			expect(collector.recordCounter).toHaveBeenCalled();
		});
	});

	describe('counter metrics', () => {
		test('records http_requests_total counter', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(collector.recordCounter).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'http_requests_total',
					value: 1,
				}),
			);
		});

		test('records http_errors_total for 4xx responses', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector}));
			app.get('/test', (c) => c.json({error: 'Bad Request'}, 400));

			await app.request('/test');

			expect(collector.recordCounter).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'http_errors_total',
					value: 1,
				}),
			);
		});

		test('records http_errors_total for 5xx responses', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector}));
			app.get('/test', (c) => c.json({error: 'Server Error'}, 500));

			await app.request('/test');

			expect(collector.recordCounter).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'http_errors_total',
					value: 1,
				}),
			);
		});

		test('does not record http_errors_total for 2xx responses', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			const errorCalls = (collector.recordCounter as ReturnType<typeof vi.fn>).mock.calls.filter(
				(call) => call[0].name === 'http_errors_total',
			);
			expect(errorCalls).toHaveLength(0);
		});

		test('does not record http_errors_total for 3xx responses', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector}));
			app.get('/test', (c) => c.redirect('/other'));

			await app.request('/test');

			const errorCalls = (collector.recordCounter as ReturnType<typeof vi.fn>).mock.calls.filter(
				(call) => call[0].name === 'http_errors_total',
			);
			expect(errorCalls).toHaveLength(0);
		});
	});

	describe('histogram metrics', () => {
		test('records http_request_duration_ms histogram', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(collector.recordHistogram).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'http_request_duration_ms',
				}),
			);
		});

		test('records positive duration value', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			const histogramCall = (collector.recordHistogram as ReturnType<typeof vi.fn>).mock.calls.find(
				(call) => call[0].name === 'http_request_duration_ms',
			);
			expect(histogramCall).toBeTruthy();
			expect(histogramCall![0].value).toBeGreaterThanOrEqual(0);
		});
	});

	describe('labels', () => {
		test('includes method label when includeMethod is true', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector, includeMethod: true}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(collector.recordCounter).toHaveBeenCalledWith(
				expect.objectContaining({
					labels: expect.objectContaining({
						method: 'GET',
					}),
				}),
			);
		});

		test('includes method by default', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector}));
			app.post('/test', (c) => c.json({ok: true}));

			await app.request('/test', {method: 'POST'});

			expect(collector.recordCounter).toHaveBeenCalledWith(
				expect.objectContaining({
					labels: expect.objectContaining({
						method: 'POST',
					}),
				}),
			);
		});

		test('excludes method label when includeMethod is false', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector, includeMethod: false}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			const call = (collector.recordCounter as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(call[0].labels.method).toBeUndefined();
		});

		test('includes status label when includeStatus is true', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector, includeStatus: true}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(collector.recordCounter).toHaveBeenCalledWith(
				expect.objectContaining({
					labels: expect.objectContaining({
						status: '200',
					}),
				}),
			);
		});

		test('includes status by default', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector}));
			app.get('/test', (c) => c.json({error: 'Not Found'}, 404));

			await app.request('/test');

			expect(collector.recordCounter).toHaveBeenCalledWith(
				expect.objectContaining({
					labels: expect.objectContaining({
						status: '404',
					}),
				}),
			);
		});

		test('excludes status label when includeStatus is false', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector, includeStatus: false}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			const call = (collector.recordCounter as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(call[0].labels.status).toBeUndefined();
		});

		test('includes path label when includePath is true', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector, includePath: true}));
			app.get('/api/users', (c) => c.json({ok: true}));

			await app.request('/api/users');

			expect(collector.recordCounter).toHaveBeenCalledWith(
				expect.objectContaining({
					labels: expect.objectContaining({
						path: '/api/users',
					}),
				}),
			);
		});

		test('excludes path label by default', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector}));
			app.get('/api/users', (c) => c.json({ok: true}));

			await app.request('/api/users');

			const call = (collector.recordCounter as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(call[0].labels.path).toBeUndefined();
		});
	});

	describe('multiple requests', () => {
		test('records metrics for each request', async () => {
			const collector = createMockCollector();
			const app = new Hono();
			app.use('*', metrics({collector}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');
			await app.request('/test');
			await app.request('/test');

			expect(collector.recordCounter).toHaveBeenCalledTimes(3);
			expect(collector.recordHistogram).toHaveBeenCalledTimes(3);
		});
	});
});
