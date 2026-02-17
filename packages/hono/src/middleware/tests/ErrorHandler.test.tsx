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

import {createErrorHandler} from '@fluxer/hono/src/middleware/ErrorHandler';
import {Hono} from 'hono';
import {HTTPException} from 'hono/http-exception';
import {describe, expect, test, vi} from 'vitest';

interface ErrorResponse {
	code: string;
	message: string;
	stack?: string;
}

describe('ErrorHandler Middleware', () => {
	describe('generic errors', () => {
		test('handles generic Error with 500 status', async () => {
			const app = new Hono();
			app.onError(createErrorHandler());
			app.get('/test', () => {
				throw new Error('Something went wrong');
			});

			const response = await app.request('/test');
			expect(response.status).toBe(500);

			const body = (await response.json()) as ErrorResponse;
			expect(body.code).toBe('INTERNAL_SERVER_ERROR');
			expect(body.message).toBe('Something went wrong. Please try again later.');
		});

		test('includes stack trace when includeStack is true', async () => {
			const app = new Hono();
			app.onError(createErrorHandler({includeStack: true}));
			app.get('/test', () => {
				throw new Error('Something went wrong');
			});

			const response = await app.request('/test');
			const body = (await response.json()) as ErrorResponse;

			expect(body.message).toBe('Something went wrong');
			expect(body.stack).toBeTruthy();
		});

		test('excludes stack trace by default', async () => {
			const app = new Hono();
			app.onError(createErrorHandler());
			app.get('/test', () => {
				throw new Error('Something went wrong');
			});

			const response = await app.request('/test');
			const body = (await response.json()) as ErrorResponse;

			expect(body.stack).toBeUndefined();
		});
	});

	describe('HTTPException handling', () => {
		test('handles HTTPException with correct status', async () => {
			const app = new Hono();
			app.onError(createErrorHandler());
			app.get('/test', () => {
				throw new HTTPException(404, {message: 'Resource not found'});
			});

			const response = await app.request('/test');
			expect(response.status).toBe(404);

			const body = (await response.json()) as ErrorResponse;
			expect(body.code).toBe('NOT_FOUND');
			expect(body.message).toBe('Resource not found');
		});

		test('handles HTTPException with 403 Forbidden', async () => {
			const app = new Hono();
			app.onError(createErrorHandler());
			app.get('/test', () => {
				throw new HTTPException(403, {message: 'Access denied'});
			});

			const response = await app.request('/test');
			expect(response.status).toBe(403);

			const body = (await response.json()) as ErrorResponse;
			expect(body.code).toBe('FORBIDDEN');
			expect(body.message).toBe('Access denied');
		});

		test('handles HTTPException without message', async () => {
			const app = new Hono();
			app.onError(createErrorHandler());
			app.get('/test', () => {
				throw new HTTPException(400);
			});

			const response = await app.request('/test');
			expect(response.status).toBe(400);

			const body = (await response.json()) as ErrorResponse;
			expect(body.message).toBe('An error occurred');
		});
	});

	describe('logger option', () => {
		test('calls logger with error and context', async () => {
			const logger = vi.fn();
			const app = new Hono();
			app.onError(createErrorHandler({logger}));
			app.get('/test', () => {
				throw new Error('Test error');
			});

			await app.request('/test');

			expect(logger).toHaveBeenCalledTimes(1);
			expect(logger).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({req: expect.anything()}));
		});

		test('does not call logger when not provided', async () => {
			const app = new Hono();
			app.onError(createErrorHandler());
			app.get('/test', () => {
				throw new Error('Test error');
			});

			const response = await app.request('/test');
			expect(response.status).toBe(500);
		});
	});

	describe('captureException option', () => {
		test('calls captureException with error and context info', async () => {
			const captureException = vi.fn();
			const app = new Hono();
			app.onError(createErrorHandler({captureException}));
			app.get('/test', () => {
				throw new Error('Test error');
			});

			await app.request('/test');

			expect(captureException).toHaveBeenCalledTimes(1);
			expect(captureException).toHaveBeenCalledWith(
				expect.any(Error),
				expect.objectContaining({
					path: '/test',
					method: 'GET',
				}),
			);
		});

		test('calls both logger and captureException when both provided', async () => {
			const logger = vi.fn();
			const captureException = vi.fn();
			const app = new Hono();
			app.onError(createErrorHandler({logger, captureException}));
			app.get('/test', () => {
				throw new Error('Test error');
			});

			await app.request('/test');

			expect(logger).toHaveBeenCalledTimes(1);
			expect(captureException).toHaveBeenCalledTimes(1);
		});
	});

	describe('async errors', () => {
		test('handles async errors', async () => {
			const app = new Hono();
			app.onError(createErrorHandler());
			app.get('/test', async () => {
				await Promise.resolve();
				throw new Error('Async error');
			});

			const response = await app.request('/test');
			expect(response.status).toBe(500);
		});

		test('handles rejected promises', async () => {
			const app = new Hono();
			app.onError(createErrorHandler());
			app.get('/test', async () => {
				return Promise.reject(new Error('Rejected promise'));
			});

			const response = await app.request('/test');
			expect(response.status).toBe(500);
		});
	});

	describe('multiple routes', () => {
		test('handles errors from different routes', async () => {
			const app = new Hono();
			app.onError(createErrorHandler());
			app.get('/route1', () => {
				throw new HTTPException(404, {message: 'Route 1 not found'});
			});
			app.get('/route2', () => {
				throw new Error('Route 2 error');
			});

			const response1 = await app.request('/route1');
			expect(response1.status).toBe(404);

			const response2 = await app.request('/route2');
			expect(response2.status).toBe(500);
		});
	});

	describe('error recovery', () => {
		test('does not affect subsequent successful requests', async () => {
			const app = new Hono();
			app.onError(createErrorHandler());
			app.get('/error', () => {
				throw new Error('Error route');
			});
			app.get('/success', (c) => c.json({ok: true}));

			const errorResponse = await app.request('/error');
			expect(errorResponse.status).toBe(500);

			const successResponse = await app.request('/success');
			expect(successResponse.status).toBe(200);
			const body = (await successResponse.json()) as {ok: boolean};
			expect(body.ok).toBe(true);
		});
	});
});
