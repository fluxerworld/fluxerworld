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
import {createErrorHandler, type ErrorHandlerOptions} from '@fluxer/errors/src/ErrorHandler';
import {FluxerError} from '@fluxer/errors/src/FluxerError';
import {Hono} from 'hono';
import {HTTPException} from 'hono/http-exception';
import {describe, expect, it, vi} from 'vitest';

interface ErrorResponse {
	code: string;
	message: string;
	stack?: string;
	[key: string]: unknown;
}

function createTestApp(options: ErrorHandlerOptions = {}) {
	const app = new Hono();
	app.onError(createErrorHandler(options));
	return app;
}

describe('createErrorHandler', () => {
	describe('FluxerError handling', () => {
		it('should return FluxerError response directly', async () => {
			const app = createTestApp();
			app.get('/test', () => {
				throw new FluxerError({
					code: 'TEST_ERROR',
					message: 'Test error message',
					status: 400,
				});
			});

			const response = await app.request('/test');

			expect(response.status).toBe(400);
			const body = (await response.json()) as ErrorResponse;
			expect(body).toEqual({
				code: 'TEST_ERROR',
				message: 'Test error message',
			});
		});

		it('should include FluxerError data in response', async () => {
			const app = createTestApp();
			app.get('/test', () => {
				throw new FluxerError({
					code: 'VALIDATION_ERROR',
					message: 'Validation failed',
					status: 400,
					data: {field: 'email'},
				});
			});

			const response = await app.request('/test');
			const body = (await response.json()) as ErrorResponse;

			expect(body).toEqual({
				code: 'VALIDATION_ERROR',
				message: 'Validation failed',
				field: 'email',
			});
		});

		it('should include FluxerError custom headers', async () => {
			const app = createTestApp();
			app.get('/test', () => {
				throw new FluxerError({
					code: 'RATE_LIMITED',
					status: 429,
					headers: {'Retry-After': '60'},
				});
			});

			const response = await app.request('/test');

			expect(response.headers.get('Retry-After')).toBe('60');
		});
	});

	describe('HTTPException handling', () => {
		it('should handle HTTPException with JSON response', async () => {
			const app = createTestApp();
			app.get('/test', () => {
				throw new HTTPException(403, {message: 'Access denied'});
			});

			const response = await app.request('/test');

			expect(response.status).toBe(403);
			const body = (await response.json()) as ErrorResponse;
			expect(body.code).toBe('FORBIDDEN');
			expect(body.message).toBe('Access denied');
		});

		it('should use default message for HTTPException without message', async () => {
			const app = createTestApp();
			app.get('/test', () => {
				throw new HTTPException(500);
			});

			const response = await app.request('/test');

			expect(response.status).toBe(500);
			const body = (await response.json()) as ErrorResponse;
			expect(body.message).toBe('An error occurred');
		});
	});

	describe('generic Error handling', () => {
		it('should return 500 for generic errors', async () => {
			const app = createTestApp();
			app.get('/test', () => {
				throw new Error('Something went wrong');
			});

			const response = await app.request('/test');

			expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
			const body = (await response.json()) as ErrorResponse;
			expect(body.code).toBe('INTERNAL_SERVER_ERROR');
			expect(body.message).toBe('Something went wrong. Please try again later.');
		});

		it('should not expose error message without includeStack option', async () => {
			const app = createTestApp({includeStack: false});
			app.get('/test', () => {
				throw new Error('Sensitive error details');
			});

			const response = await app.request('/test');
			const body = (await response.json()) as ErrorResponse;

			expect(body.message).toBe('Something went wrong. Please try again later.');
			expect(body.message).not.toContain('Sensitive');
		});

		it('should expose error message with includeStack option', async () => {
			const app = createTestApp({includeStack: true});
			app.get('/test', () => {
				throw new Error('Error details for debugging');
			});

			const response = await app.request('/test');
			const body = (await response.json()) as ErrorResponse;

			expect(body.message).toBe('Error details for debugging');
		});

		it('should include stack trace with includeStack option', async () => {
			const app = createTestApp({includeStack: true});
			app.get('/test', () => {
				throw new Error('Test error');
			});

			const response = await app.request('/test');
			const body = (await response.json()) as ErrorResponse;

			expect(body).toHaveProperty('stack');
			expect(body.stack).toContain('Error: Test error');
		});
	});

	describe('logError callback', () => {
		it('should call logError with error and context', async () => {
			const logError = vi.fn();
			const app = createTestApp({logError});
			app.get('/test', () => {
				throw new Error('Logged error');
			});

			await app.request('/test');

			expect(logError).toHaveBeenCalledTimes(1);
			expect(logError.mock.calls[0][0]).toBeInstanceOf(Error);
			expect((logError.mock.calls[0][0] as Error).message).toBe('Logged error');
		});

		it('should call logError for FluxerError', async () => {
			const logError = vi.fn();
			const app = createTestApp({logError});
			app.get('/test', () => {
				throw new FluxerError({code: 'TEST', status: 400});
			});

			await app.request('/test');

			expect(logError).toHaveBeenCalledTimes(1);
			expect(logError.mock.calls[0][0]).toBeInstanceOf(FluxerError);
		});
	});

	describe('customHandler callback', () => {
		it('should use customHandler response when provided', async () => {
			const customHandler = vi.fn().mockReturnValue(
				new Response(JSON.stringify({custom: true}), {
					status: 418,
					headers: {'Content-Type': 'application/json'},
				}),
			);
			const app = createTestApp({customHandler});
			app.get('/test', () => {
				throw new Error('Custom handled');
			});

			const response = await app.request('/test');

			expect(response.status).toBe(418);
			const body = (await response.json()) as {custom: boolean};
			expect(body).toEqual({custom: true});
			expect(customHandler).toHaveBeenCalledTimes(1);
		});

		it('should fall back to default handling when customHandler returns undefined', async () => {
			const customHandler = vi.fn().mockReturnValue(undefined);
			const app = createTestApp({customHandler});
			app.get('/test', () => {
				throw new FluxerError({code: 'FALLBACK', status: 400});
			});

			const response = await app.request('/test');

			expect(response.status).toBe(400);
			const body = (await response.json()) as ErrorResponse;
			expect(body.code).toBe('FALLBACK');
		});

		it('should support async customHandler', async () => {
			const customHandler = vi.fn().mockResolvedValue(
				new Response(JSON.stringify({async: true}), {
					status: 202,
					headers: {'Content-Type': 'application/json'},
				}),
			);
			const app = createTestApp({customHandler});
			app.get('/test', () => {
				throw new Error('Async handled');
			});

			const response = await app.request('/test');

			expect(response.status).toBe(202);
			const body = (await response.json()) as {async: boolean};
			expect(body).toEqual({async: true});
		});
	});

	describe('responseFormat option', () => {
		it('should return JSON by default', async () => {
			const app = createTestApp();
			app.get('/test', () => {
				throw new HTTPException(400);
			});

			const response = await app.request('/test');

			expect(response.headers.get('Content-Type')).toBe('application/json');
		});

		it('should return XML when responseFormat is xml', async () => {
			const app = createTestApp({responseFormat: 'xml'});
			app.get('/test', () => {
				throw new HTTPException(400, {message: 'Bad request'});
			});

			const response = await app.request('/test');

			expect(response.status).toBe(400);
			expect(response.headers.get('Content-Type')).toBe('application/xml');

			const body = await response.text();
			expect(body).toContain('<?xml version="1.0"');
			expect(body).toContain('<Error>');
			expect(body).toContain('<Code>BAD_REQUEST</Code>');
			expect(body).toContain('<Message>Bad request</Message>');
		});

		it('should escape XML special characters', async () => {
			const app = createTestApp({responseFormat: 'xml'});
			app.get('/test', () => {
				throw new HTTPException(400, {message: 'Error with <special> & "chars"'});
			});

			const response = await app.request('/test');
			const body = await response.text();

			expect(body).toContain('&lt;special&gt;');
			expect(body).toContain('&amp;');
			expect(body).toContain('&quot;chars&quot;');
		});

		it('should return XML for internal errors when responseFormat is xml', async () => {
			const app = createTestApp({responseFormat: 'xml'});
			app.get('/test', () => {
				throw new Error('Internal error');
			});

			const response = await app.request('/test');

			expect(response.status).toBe(500);
			expect(response.headers.get('Content-Type')).toBe('application/xml');

			const body = await response.text();
			expect(body).toContain('<Code>INTERNAL_SERVER_ERROR</Code>');
		});
	});

	describe('combined options', () => {
		it('should support logError and includeStack together', async () => {
			const logError = vi.fn();
			const app = createTestApp({logError, includeStack: true});
			app.get('/test', () => {
				throw new Error('Combined test');
			});

			const response = await app.request('/test');
			const body = (await response.json()) as ErrorResponse;

			expect(logError).toHaveBeenCalledTimes(1);
			expect(body.message).toBe('Combined test');
			expect(body).toHaveProperty('stack');
		});

		it('should call logError before customHandler', async () => {
			const callOrder: Array<string> = [];
			const logError = vi.fn(() => callOrder.push('log'));
			const customHandler = vi.fn(() => {
				callOrder.push('custom');
				return undefined;
			});
			const app = createTestApp({logError, customHandler});
			app.get('/test', () => {
				throw new Error('Order test');
			});

			await app.request('/test');

			expect(callOrder).toEqual(['log', 'custom']);
		});
	});
});
