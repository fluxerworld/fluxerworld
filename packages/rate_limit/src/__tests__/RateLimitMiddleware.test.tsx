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

import {HttpStatus} from '@fluxer/constants/src/HttpConstants';
import {InMemoryCacheService} from '@fluxer/rate_limit/src/InMemoryCacheService';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import {
	createRateLimitMiddleware,
	type RateLimitMiddlewareConfig,
	type RateLimitMiddlewareOptions,
	setRateLimitHeaders,
} from '@fluxer/rate_limit/src/middleware/RateLimitMiddleware';
import {RateLimitService} from '@fluxer/rate_limit/src/RateLimitService';
import {Hono} from 'hono';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('RateLimitMiddleware', () => {
	let app: Hono;
	let rateLimitService: IRateLimitService;

	beforeEach(() => {
		vi.useFakeTimers();
		const cache = new InMemoryCacheService();
		rateLimitService = new RateLimitService(cache);
		app = new Hono();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function setupApp(config: RateLimitMiddlewareConfig, options?: Partial<RateLimitMiddlewareOptions>) {
		const middleware = createRateLimitMiddleware({
			rateLimitService,
			config,
			getClientIdentifier: (req) => req.headers.get('X-Forwarded-For') ?? '127.0.0.1',
			...options,
		});
		app.use('*', middleware);
		app.get('/test', (c) => c.json({message: 'success'}));
		app.get('/_health', (c) => c.json({status: 'ok'}));
		app.post('/api/messages', (c) => c.json({created: true}));
	}

	describe('basic rate limiting', () => {
		it('should allow requests within the limit', async () => {
			setupApp({
				enabled: true,
				limit: 5,
				windowMs: 60000,
			});

			const response = await app.request('/test', {
				headers: {'X-Forwarded-For': '192.168.1.1'},
			});

			expect(response.status).toBe(200);
			const body = (await response.json()) as {message: string};
			expect(body.message).toBe('success');
		});

		it('should block requests exceeding the limit', async () => {
			setupApp({
				enabled: true,
				limit: 3,
				windowMs: 60000,
			});

			for (let i = 0; i < 3; i++) {
				await app.request('/test', {
					headers: {'X-Forwarded-For': '192.168.1.1'},
				});
			}

			const response = await app.request('/test', {
				headers: {'X-Forwarded-For': '192.168.1.1'},
			});

			expect(response.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
			const body = (await response.json()) as {error: string; retryAfter: number};
			expect(body.error).toBe('Rate limit exceeded');
			expect(body.retryAfter).toBeGreaterThan(0);
		});

		it('should track different clients separately', async () => {
			setupApp({
				enabled: true,
				limit: 2,
				windowMs: 60000,
			});

			await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}});
			await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}});
			const blockedResponse = await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}});

			const otherClientResponse = await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.2'}});

			expect(blockedResponse.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
			expect(otherClientResponse.status).toBe(200);
		});
	});

	describe('rate limit headers', () => {
		it('should include X-RateLimit-Limit header', async () => {
			setupApp({
				enabled: true,
				limit: 10,
				windowMs: 60000,
			});

			const response = await app.request('/test', {
				headers: {'X-Forwarded-For': '192.168.1.1'},
			});

			expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
		});

		it('should include X-RateLimit-Remaining header', async () => {
			setupApp({
				enabled: true,
				limit: 10,
				windowMs: 60000,
			});

			const response1 = await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}});
			const response2 = await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}});

			expect(response1.headers.get('X-RateLimit-Remaining')).toBe('9');
			expect(response2.headers.get('X-RateLimit-Remaining')).toBe('8');
		});

		it('should include X-RateLimit-Reset header', async () => {
			setupApp({
				enabled: true,
				limit: 10,
				windowMs: 60000,
			});

			const response = await app.request('/test', {
				headers: {'X-Forwarded-For': '192.168.1.1'},
			});

			const resetHeader = response.headers.get('X-RateLimit-Reset');
			expect(resetHeader).not.toBeNull();
			const resetTime = parseInt(resetHeader!, 10);
			expect(resetTime).toBeGreaterThan(Math.floor(Date.now() / 1000));
		});

		it('should include Retry-After header when rate limited', async () => {
			setupApp({
				enabled: true,
				limit: 1,
				windowMs: 60000,
			});

			await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}});
			const response = await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}});

			expect(response.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
			const retryAfter = response.headers.get('Retry-After');
			expect(retryAfter).not.toBeNull();
			expect(parseInt(retryAfter!, 10)).toBeGreaterThan(0);
		});
	});

	describe('skipPaths configuration', () => {
		it('should skip rate limiting for exact path matches', async () => {
			setupApp({
				enabled: true,
				limit: 1,
				windowMs: 60000,
				skipPaths: ['/_health'],
			});

			await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}});

			const healthResponse1 = await app.request('/_health', {headers: {'X-Forwarded-For': '192.168.1.1'}});
			const healthResponse2 = await app.request('/_health', {headers: {'X-Forwarded-For': '192.168.1.1'}});
			const healthResponse3 = await app.request('/_health', {headers: {'X-Forwarded-For': '192.168.1.1'}});

			expect(healthResponse1.status).toBe(200);
			expect(healthResponse2.status).toBe(200);
			expect(healthResponse3.status).toBe(200);
		});

		it('should skip rate limiting for prefix path matches', async () => {
			setupApp({
				enabled: true,
				limit: 1,
				windowMs: 60000,
				skipPaths: ['/api/'],
			});

			await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}});
			const blockedTest = await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}});

			const apiResponse = await app.request('/api/messages', {
				method: 'POST',
				headers: {'X-Forwarded-For': '192.168.1.1'},
			});

			expect(blockedTest.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
			expect(apiResponse.status).toBe(200);
		});

		it('should still rate limit non-skipped paths', async () => {
			setupApp({
				enabled: true,
				limit: 1,
				windowMs: 60000,
				skipPaths: ['/_health'],
			});

			await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}});
			const response = await app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}});

			expect(response.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
		});
	});

	describe('disabled rate limiting', () => {
		it('should bypass rate limiting when disabled', async () => {
			setupApp({
				enabled: false,
				limit: 1,
				windowMs: 60000,
			});

			const responses = await Promise.all([
				app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}}),
				app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}}),
				app.request('/test', {headers: {'X-Forwarded-For': '192.168.1.1'}}),
			]);

			expect(responses.every((r) => r.status === 200)).toBe(true);
		});
	});

	describe('null rate limit service', () => {
		it('should bypass rate limiting when service is null', async () => {
			const middleware = createRateLimitMiddleware({
				rateLimitService: null,
				config: {
					enabled: true,
					limit: 1,
					windowMs: 60000,
				},
				getClientIdentifier: () => '127.0.0.1',
			});

			const testApp = new Hono();
			testApp.use('*', middleware);
			testApp.get('/test', (c) => c.json({ok: true}));

			const responses = await Promise.all([
				testApp.request('/test'),
				testApp.request('/test'),
				testApp.request('/test'),
			]);

			expect(responses.every((r) => r.status === 200)).toBe(true);
		});

		it('should support lazy service provider function', async () => {
			let callCount = 0;
			const serviceProvider = () => {
				callCount++;
				return rateLimitService;
			};

			const middleware = createRateLimitMiddleware({
				rateLimitService: serviceProvider,
				config: {
					enabled: true,
					limit: 5,
					windowMs: 60000,
				},
				getClientIdentifier: () => '127.0.0.1',
			});

			const testApp = new Hono();
			testApp.use('*', middleware);
			testApp.get('/test', (c) => c.json({ok: true}));

			await testApp.request('/test');
			await testApp.request('/test');

			expect(callCount).toBe(2);
		});

		it('should handle service provider returning null', async () => {
			const middleware = createRateLimitMiddleware({
				rateLimitService: () => null,
				config: {
					enabled: true,
					limit: 1,
					windowMs: 60000,
				},
				getClientIdentifier: () => '127.0.0.1',
			});

			const testApp = new Hono();
			testApp.use('*', middleware);
			testApp.get('/test', (c) => c.json({ok: true}));

			const responses = await Promise.all([testApp.request('/test'), testApp.request('/test')]);

			expect(responses.every((r) => r.status === 200)).toBe(true);
		});
	});

	describe('custom bucket naming', () => {
		it('should use custom bucket name from getBucketName', async () => {
			const middleware = createRateLimitMiddleware({
				rateLimitService,
				config: {
					enabled: true,
					limit: 2,
					windowMs: 60000,
				},
				getClientIdentifier: (req) => req.headers.get('X-Forwarded-For') ?? '127.0.0.1',
				getBucketName: (identifier, c) => `${identifier}:${c.req.method}:${c.req.path}`,
			});

			const testApp = new Hono();
			testApp.use('*', middleware);
			testApp.get('/resource', (c) => c.json({ok: true}));
			testApp.post('/resource', (c) => c.json({created: true}));

			await testApp.request('/resource', {method: 'GET', headers: {'X-Forwarded-For': '1.1.1.1'}});
			await testApp.request('/resource', {method: 'GET', headers: {'X-Forwarded-For': '1.1.1.1'}});
			const getBlocked = await testApp.request('/resource', {method: 'GET', headers: {'X-Forwarded-For': '1.1.1.1'}});

			const postAllowed = await testApp.request('/resource', {method: 'POST', headers: {'X-Forwarded-For': '1.1.1.1'}});

			expect(getBlocked.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
			expect(postAllowed.status).toBe(200);
		});
	});

	describe('custom onRateLimitExceeded handler', () => {
		it('should use custom response when rate limit exceeded', async () => {
			const middleware = createRateLimitMiddleware({
				rateLimitService,
				config: {
					enabled: true,
					limit: 1,
					windowMs: 60000,
				},
				getClientIdentifier: () => '127.0.0.1',
				onRateLimitExceeded: (c, retryAfter) => {
					return c.json(
						{
							code: 'RATE_LIMITED',
							message: 'Slow down!',
							retry_after: retryAfter,
						},
						HttpStatus.TOO_MANY_REQUESTS,
					);
				},
			});

			const testApp = new Hono();
			testApp.use('*', middleware);
			testApp.get('/test', (c) => c.json({ok: true}));

			await testApp.request('/test');
			const response = await testApp.request('/test');

			expect(response.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
			const body = (await response.json()) as {code: string; message: string; retry_after: number};
			expect(body.code).toBe('RATE_LIMITED');
			expect(body.message).toBe('Slow down!');
			expect(body.retry_after).toBeGreaterThan(0);
		});
	});
});

describe('setRateLimitHeaders', () => {
	it('should set all required headers', () => {
		const headers: Record<string, string> = {};
		const ctx = {
			header: (name: string, value: string) => {
				headers[name] = value;
			},
		};

		const resetTime = new Date(Date.now() + 60000);
		setRateLimitHeaders(ctx, 100, 75, resetTime);

		expect(headers['X-RateLimit-Limit']).toBe('100');
		expect(headers['X-RateLimit-Remaining']).toBe('75');
		expect(headers['X-RateLimit-Reset']).toBe(Math.floor(resetTime.getTime() / 1000).toString());
	});

	it('should handle zero remaining', () => {
		const headers: Record<string, string> = {};
		const ctx = {
			header: (name: string, value: string) => {
				headers[name] = value;
			},
		};

		const resetTime = new Date(Date.now() + 30000);
		setRateLimitHeaders(ctx, 10, 0, resetTime);

		expect(headers['X-RateLimit-Remaining']).toBe('0');
	});

	it('should convert reset time to unix seconds', () => {
		const headers: Record<string, string> = {};
		const ctx = {
			header: (name: string, value: string) => {
				headers[name] = value;
			},
		};

		const resetTimeMs = 1700000000000;
		const resetTime = new Date(resetTimeMs);
		setRateLimitHeaders(ctx, 50, 25, resetTime);

		expect(headers['X-RateLimit-Reset']).toBe('1700000000');
	});
});
