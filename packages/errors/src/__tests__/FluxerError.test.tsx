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

import {FluxerError} from '@fluxer/errors/src/FluxerError';
import {HTTPException} from 'hono/http-exception';
import {describe, expect, it} from 'vitest';

describe('FluxerError', () => {
	describe('constructor', () => {
		it('should create an error with required options', () => {
			const error = new FluxerError({
				code: 'TEST_ERROR',
				status: 400,
			});

			expect(error.code).toBe('TEST_ERROR');
			expect(error.status).toBe(400);
			expect(error.message).toBe('TEST_ERROR');
			expect(error.name).toBe('FluxerError');
		});

		it('should use provided message instead of code', () => {
			const error = new FluxerError({
				code: 'TEST_ERROR',
				message: 'Custom error message',
				status: 400,
			});

			expect(error.code).toBe('TEST_ERROR');
			expect(error.message).toBe('Custom error message');
		});

		it('should include optional data', () => {
			const error = new FluxerError({
				code: 'TEST_ERROR',
				status: 400,
				data: {field: 'username', reason: 'invalid'},
			});

			expect(error.data).toEqual({field: 'username', reason: 'invalid'});
		});

		it('should include optional headers', () => {
			const error = new FluxerError({
				code: 'TEST_ERROR',
				status: 400,
				headers: {'X-Custom-Header': 'value'},
			});

			expect(error.headers).toEqual({'X-Custom-Header': 'value'});
		});

		it('should include message variables for i18n', () => {
			const error = new FluxerError({
				code: 'RATE_LIMITED',
				status: 429,
				messageVariables: {retryAfter: 60},
			});

			expect(error.messageVariables).toEqual({retryAfter: 60});
		});

		it('should include cause for error chaining', () => {
			const cause = new Error('Original error');
			const error = new FluxerError({
				code: 'WRAPPED_ERROR',
				status: 500,
				cause,
			});

			expect(error.cause).toBe(cause);
		});

		it('should be an instance of HTTPException', () => {
			const error = new FluxerError({
				code: 'TEST_ERROR',
				status: 400,
			});

			expect(error).toBeInstanceOf(HTTPException);
		});
	});

	describe('getResponse', () => {
		it('should return a JSON Response with correct status', async () => {
			const error = new FluxerError({
				code: 'TEST_ERROR',
				message: 'Test message',
				status: 400,
			});

			const response = error.getResponse();

			expect(response.status).toBe(400);
			expect(response.headers.get('Content-Type')).toBe('application/json');

			const body = await response.json();
			expect(body).toEqual({
				code: 'TEST_ERROR',
				message: 'Test message',
			});
		});

		it('should include data in response body', async () => {
			const error = new FluxerError({
				code: 'VALIDATION_ERROR',
				message: 'Validation failed',
				status: 400,
				data: {errors: [{field: 'email', message: 'Invalid email'}]},
			});

			const response = error.getResponse();
			const body = await response.json();

			expect(body).toEqual({
				code: 'VALIDATION_ERROR',
				message: 'Validation failed',
				errors: [{field: 'email', message: 'Invalid email'}],
			});
		});

		it('should include custom headers in response', async () => {
			const error = new FluxerError({
				code: 'RATE_LIMITED',
				status: 429,
				headers: {'Retry-After': '60', 'X-RateLimit-Reset': '1234567890'},
			});

			const response = error.getResponse();

			expect(response.headers.get('Retry-After')).toBe('60');
			expect(response.headers.get('X-RateLimit-Reset')).toBe('1234567890');
			expect(response.headers.get('Content-Type')).toBe('application/json');
		});

		it('should handle empty data', async () => {
			const error = new FluxerError({
				code: 'SIMPLE_ERROR',
				status: 403,
			});

			const response = error.getResponse();
			const body = await response.json();

			expect(body).toEqual({
				code: 'SIMPLE_ERROR',
				message: 'SIMPLE_ERROR',
			});
		});
	});

	describe('toJSON', () => {
		it('should serialize to JSON object', () => {
			const error = new FluxerError({
				code: 'TEST_ERROR',
				message: 'Test message',
				status: 400,
			});

			const json = error.toJSON();

			expect(json).toEqual({
				code: 'TEST_ERROR',
				message: 'Test message',
			});
		});

		it('should include data in JSON output', () => {
			const error = new FluxerError({
				code: 'VALIDATION_ERROR',
				message: 'Validation failed',
				status: 400,
				data: {field: 'username'},
			});

			const json = error.toJSON();

			expect(json).toEqual({
				code: 'VALIDATION_ERROR',
				message: 'Validation failed',
				field: 'username',
			});
		});

		it('should not include status or headers in JSON output', () => {
			const error = new FluxerError({
				code: 'TEST_ERROR',
				status: 500,
				headers: {'X-Custom': 'value'},
			});

			const json = error.toJSON();

			expect(json).not.toHaveProperty('status');
			expect(json).not.toHaveProperty('headers');
		});
	});

	describe('status codes', () => {
		it('should handle 4xx client error status codes', () => {
			const testCases = [
				{status: 400, name: 'Bad Request'},
				{status: 401, name: 'Unauthorized'},
				{status: 403, name: 'Forbidden'},
				{status: 404, name: 'Not Found'},
				{status: 409, name: 'Conflict'},
				{status: 429, name: 'Too Many Requests'},
			] as const;

			for (const {status} of testCases) {
				const error = new FluxerError({code: 'TEST', status});
				expect(error.status).toBe(status);
			}
		});

		it('should handle 5xx server error status codes', () => {
			const testCases = [
				{status: 500, name: 'Internal Server Error'},
				{status: 501, name: 'Not Implemented'},
				{status: 502, name: 'Bad Gateway'},
				{status: 503, name: 'Service Unavailable'},
				{status: 504, name: 'Gateway Timeout'},
			] as const;

			for (const {status} of testCases) {
				const error = new FluxerError({code: 'TEST', status});
				expect(error.status).toBe(status);
			}
		});
	});

	describe('error properties', () => {
		it('should have correct name property', () => {
			const error = new FluxerError({code: 'TEST', status: 400});
			expect(error.name).toBe('FluxerError');
		});

		it('should be throwable', () => {
			const error = new FluxerError({code: 'THROWN_ERROR', status: 400});

			expect(() => {
				throw error;
			}).toThrow(FluxerError);
		});

		it('should be catchable as Error', () => {
			const error = new FluxerError({code: 'CAUGHT_ERROR', status: 400});

			try {
				throw error;
			} catch (e) {
				expect(e).toBeInstanceOf(Error);
				expect(e).toBeInstanceOf(FluxerError);
			}
		});
	});
});
