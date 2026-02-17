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

import type {RateLimitResult, RateLimitService} from '@fluxer/hono/src/middleware/RateLimit';
import {rateLimit} from '@fluxer/hono/src/middleware/RateLimit';
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

describe('RateLimit Middleware', () => {
	describe('enabled option', () => {
		test('skips rate limiting when enabled is false', async () => {
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({enabled: false, service}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.status).toBe(200);
			expect(service.checkLimit).not.toHaveBeenCalled();
		});

		test('skips rate limiting when service is not provided', async () => {
			const app = new Hono();
			app.use('*', rateLimit({enabled: true}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.status).toBe(200);
		});

		test('applies rate limiting when enabled and service provided', async () => {
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({enabled: true, service}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');
			expect(service.checkLimit).toHaveBeenCalled();
		});
	});

	describe('skip paths', () => {
		test('skips default health paths', async () => {
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/_health', (c) => c.json({ok: true}));
			app.get('/metrics', (c) => c.json({ok: true}));

			await app.request('/_health');
			await app.request('/metrics');

			expect(service.checkLimit).not.toHaveBeenCalled();
		});

		test('skips custom paths', async () => {
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({skipPaths: ['/public'], service}));
			app.get('/public', (c) => c.json({ok: true}));

			await app.request('/public');
			expect(service.checkLimit).not.toHaveBeenCalled();
		});

		test('skips paths with wildcard patterns', async () => {
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({skipPaths: ['/static/*'], service}));
			app.get('/static/file.js', (c) => c.json({ok: true}));
			app.get('/static/images/logo.png', (c) => c.json({ok: true}));

			await app.request('/static/file.js');
			await app.request('/static/images/logo.png');

			expect(service.checkLimit).not.toHaveBeenCalled();
		});

		test('applies rate limit to non-skipped paths', async () => {
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({skipPaths: ['/public'], service}));
			app.get('/api/users', (c) => c.json({ok: true}));

			await app.request('/api/users');
			expect(service.checkLimit).toHaveBeenCalled();
		});
	});

	describe('rate limit headers', () => {
		test('sets X-RateLimit-Limit header', async () => {
			const service = createMockRateLimitService({limit: 100});
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
		});

		test('sets X-RateLimit-Remaining header', async () => {
			const service = createMockRateLimitService({remaining: 42});
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.headers.get('X-RateLimit-Remaining')).toBe('42');
		});

		test('sets X-RateLimit-Reset header as unix timestamp', async () => {
			const resetTime = new Date(Date.now() + 60000);
			const service = createMockRateLimitService({resetTime});
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			const reset = response.headers.get('X-RateLimit-Reset');
			expect(reset).toBe(Math.floor(resetTime.getTime() / 1000).toString());
		});
	});

	describe('rate limit exceeded', () => {
		test('returns 429 when rate limit exceeded', async () => {
			const service = createMockRateLimitService({allowed: false, remaining: 0});
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.status).toBe(429);
		});

		test('returns error message when rate limit exceeded', async () => {
			const service = createMockRateLimitService({allowed: false});
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			const body = (await response.json()) as {error: string; message: string};

			expect(body.error).toBe('Too Many Requests');
			expect(body.message).toBe('Rate limit exceeded');
		});

		test('sets Retry-After header when retryAfter is provided', async () => {
			const service = createMockRateLimitService({allowed: false, retryAfter: 60});
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.headers.get('Retry-After')).toBe('60');
		});

		test('includes retryAfter in response body', async () => {
			const service = createMockRateLimitService({allowed: false, retryAfter: 30});
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			const body = (await response.json()) as {retryAfter: number};

			expect(body.retryAfter).toBe(30);
		});

		test('calls onLimitExceeded callback when provided', async () => {
			const onLimitExceeded = vi.fn();
			const service = createMockRateLimitService({allowed: false});
			const app = new Hono();
			app.use('*', rateLimit({service, onLimitExceeded}));
			app.get('/api/test', (c) => c.json({ok: true}));

			await app.request('/api/test');

			expect(onLimitExceeded).toHaveBeenCalledWith(expect.any(String), '/api/test');
		});
	});

	describe('key generation', () => {
		test('uses default key generator based on IP', async () => {
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test', {
				headers: {'x-forwarded-for': '192.168.1.100'},
			});

			expect(service.checkLimit).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: '192.168.1.100',
				}),
			);
		});

		test('uses custom key generator when provided', async () => {
			const keyGenerator = vi.fn().mockReturnValue('custom-key');
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({service, keyGenerator}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(keyGenerator).toHaveBeenCalled();
			expect(service.checkLimit).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: 'custom-key',
				}),
			);
		});

		test('async key generator is supported', async () => {
			const keyGenerator = vi.fn().mockResolvedValue('async-key');
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({service, keyGenerator}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(service.checkLimit).toHaveBeenCalledWith(
				expect.objectContaining({
					identifier: 'async-key',
				}),
			);
		});
	});

	describe('rate limit parameters', () => {
		test('passes maxAttempts to service', async () => {
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({service, maxAttempts: 50}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(service.checkLimit).toHaveBeenCalledWith(
				expect.objectContaining({
					maxAttempts: 50,
				}),
			);
		});

		test('uses default maxAttempts of 100', async () => {
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(service.checkLimit).toHaveBeenCalledWith(
				expect.objectContaining({
					maxAttempts: 100,
				}),
			);
		});

		test('passes windowMs to service', async () => {
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({service, windowMs: 30000}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(service.checkLimit).toHaveBeenCalledWith(
				expect.objectContaining({
					windowMs: 30000,
				}),
			);
		});

		test('uses default windowMs of 60000', async () => {
			const service = createMockRateLimitService();
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/test', (c) => c.json({ok: true}));

			await app.request('/test');

			expect(service.checkLimit).toHaveBeenCalledWith(
				expect.objectContaining({
					windowMs: 60000,
				}),
			);
		});
	});

	describe('allowed requests', () => {
		test('allows request and calls next when under limit', async () => {
			const service = createMockRateLimitService({allowed: true, remaining: 50});
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.status).toBe(200);

			const body = (await response.json()) as {ok: boolean};
			expect(body.ok).toBe(true);
		});

		test('sets rate limit headers even for allowed requests', async () => {
			const service = createMockRateLimitService({allowed: true, limit: 100, remaining: 75});
			const app = new Hono();
			app.use('*', rateLimit({service}));
			app.get('/test', (c) => c.json({ok: true}));

			const response = await app.request('/test');
			expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
			expect(response.headers.get('X-RateLimit-Remaining')).toBe('75');
		});
	});
});
