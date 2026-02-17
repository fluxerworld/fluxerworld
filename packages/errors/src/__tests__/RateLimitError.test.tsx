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

import {RateLimitError} from '@fluxer/errors/src/domains/core/RateLimitError';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

interface RateLimitResponseBody {
	code: string;
	retry_after: number;
	global: boolean;
}

describe('RateLimitError', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-27T12:00:00.000Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('valid inputs', () => {
		it('should create error with valid values', () => {
			const error = new RateLimitError({
				retryAfter: 5,
				limit: 10,
				resetTime: new Date(Date.now() + 5000),
			});

			expect(error.code).toBe('RATE_LIMITED');
			expect(error.status).toBe(429);
			expect(error.data?.retry_after).toBe(5);
			expect(error.headers?.['Retry-After']).toBe('5');
			expect(error.headers?.['X-RateLimit-Limit']).toBe('10');
		});

		it('should use retryAfterDecimal when provided', () => {
			const error = new RateLimitError({
				retryAfter: 5,
				retryAfterDecimal: 4.5,
				limit: 10,
				resetTime: new Date(Date.now() + 5000),
			});

			expect(error.data?.retry_after).toBe(4.5);
			expect(error.headers?.['Retry-After']).toBe('5');
		});

		it('should set global flag correctly', () => {
			const globalError = new RateLimitError({
				global: true,
				retryAfter: 1,
				limit: 50,
				resetTime: new Date(Date.now() + 1000),
			});

			expect(globalError.data?.global).toBe(true);
			expect(globalError.headers?.['X-RateLimit-Global']).toBe('true');

			const bucketError = new RateLimitError({
				global: false,
				retryAfter: 1,
				limit: 10,
				resetTime: new Date(Date.now() + 1000),
			});

			expect(bucketError.data?.global).toBe(false);
			expect(bucketError.headers?.['X-RateLimit-Global']).toBe('false');
		});
	});

	describe('sanitization of invalid inputs', () => {
		it('should handle undefined retryAfter', () => {
			const error = new RateLimitError({
				retryAfter: undefined as unknown as number,
				limit: 10,
				resetTime: new Date(Date.now() + 5000),
			});

			expect(error.headers?.['Retry-After']).toBe('1');
			expect(Number.isNaN(Number(error.headers?.['Retry-After']))).toBe(false);
		});

		it('should handle NaN retryAfter', () => {
			const error = new RateLimitError({
				retryAfter: NaN,
				limit: 10,
				resetTime: new Date(Date.now() + 5000),
			});

			expect(error.headers?.['Retry-After']).toBe('1');
			expect(error.data?.retry_after).toBe(1);
		});

		it('should handle Infinity retryAfter', () => {
			const error = new RateLimitError({
				retryAfter: Infinity,
				limit: 10,
				resetTime: new Date(Date.now() + 5000),
			});

			expect(error.headers?.['Retry-After']).toBe('1');
		});

		it('should handle negative retryAfter', () => {
			const error = new RateLimitError({
				retryAfter: -5,
				limit: 10,
				resetTime: new Date(Date.now() + 5000),
			});

			expect(error.headers?.['Retry-After']).toBe('1');
		});

		it('should handle zero retryAfter', () => {
			const error = new RateLimitError({
				retryAfter: 0,
				limit: 10,
				resetTime: new Date(Date.now() + 5000),
			});

			expect(error.headers?.['Retry-After']).toBe('1');
		});

		it('should handle invalid resetTime', () => {
			const error = new RateLimitError({
				retryAfter: 5,
				limit: 10,
				resetTime: new Date(NaN),
			});

			const resetTimestamp = Number(error.headers?.['X-RateLimit-Reset']);
			const nowTimestamp = Math.floor(Date.now() / 1000);

			expect(Number.isFinite(resetTimestamp)).toBe(true);
			expect(resetTimestamp).toBeGreaterThan(nowTimestamp);
		});

		it('should handle resetTime in the past', () => {
			const error = new RateLimitError({
				retryAfter: 5,
				limit: 10,
				resetTime: new Date(Date.now() - 10000),
			});

			const resetTimestamp = Number(error.headers?.['X-RateLimit-Reset']);
			const nowTimestamp = Math.floor(Date.now() / 1000);

			expect(resetTimestamp).toBeGreaterThan(nowTimestamp);
		});

		it('should handle invalid limit', () => {
			const error = new RateLimitError({
				retryAfter: 5,
				limit: NaN,
				resetTime: new Date(Date.now() + 5000),
			});

			expect(error.headers?.['X-RateLimit-Limit']).toBe('1');
		});

		it('should handle zero limit', () => {
			const error = new RateLimitError({
				retryAfter: 5,
				limit: 0,
				resetTime: new Date(Date.now() + 5000),
			});

			expect(error.headers?.['X-RateLimit-Limit']).toBe('1');
		});

		it('should handle NaN retryAfterDecimal', () => {
			const error = new RateLimitError({
				retryAfter: 5,
				retryAfterDecimal: NaN,
				limit: 10,
				resetTime: new Date(Date.now() + 5000),
			});

			expect(error.data?.retry_after).toBe(5);
		});
	});

	describe('response format', () => {
		it('should produce valid JSON response', async () => {
			const error = new RateLimitError({
				retryAfter: 10,
				limit: 50,
				resetTime: new Date(Date.now() + 10000),
			});

			const response = error.getResponse();
			const body = (await response.json()) as RateLimitResponseBody;

			expect(body.code).toBe('RATE_LIMITED');
			expect(body.retry_after).toBe(10);
			expect(body.global).toBe(false);
			expect(typeof body.retry_after).toBe('number');
		});

		it('should never produce null retry_after in response', async () => {
			const error = new RateLimitError({
				retryAfter: undefined as unknown as number,
				retryAfterDecimal: undefined,
				limit: 10,
				resetTime: new Date(Date.now() + 5000),
			});

			const response = error.getResponse();
			const body = (await response.json()) as RateLimitResponseBody;

			expect(body.retry_after).not.toBeNull();
			expect(typeof body.retry_after).toBe('number');
			expect(Number.isFinite(body.retry_after)).toBe(true);
		});

		it('should set correct status code', () => {
			const error = new RateLimitError({
				retryAfter: 5,
				limit: 10,
				resetTime: new Date(Date.now() + 5000),
			});

			const response = error.getResponse();
			expect(response.status).toBe(429);
		});

		it('should include all required headers', () => {
			const error = new RateLimitError({
				retryAfter: 5,
				limit: 10,
				resetTime: new Date(Date.now() + 5000),
				global: true,
			});

			const response = error.getResponse();
			expect(response.headers.get('Retry-After')).toBe('5');
			expect(response.headers.get('X-RateLimit-Global')).toBe('true');
			expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
			expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
			expect(response.headers.get('X-RateLimit-Reset')).not.toBeNull();
		});
	});

	describe('edge cases', () => {
		it('should handle all inputs being invalid simultaneously', () => {
			const error = new RateLimitError({
				retryAfter: NaN,
				retryAfterDecimal: Infinity,
				limit: -1,
				resetTime: new Date(NaN),
			});

			expect(error.headers?.['Retry-After']).toBe('1');
			expect(error.headers?.['X-RateLimit-Limit']).toBe('1');
			expect(Number.isFinite(Number(error.headers?.['X-RateLimit-Reset']))).toBe(true);
			expect(Number.isFinite(error.data?.retry_after as number)).toBe(true);
		});

		it('should handle very large retryAfter values', () => {
			const error = new RateLimitError({
				retryAfter: 999999999,
				limit: 10,
				resetTime: new Date(Date.now() + 999999999000),
			});

			expect(error.headers?.['Retry-After']).toBe('999999999');
		});

		it('should ceil fractional retryAfter for header', () => {
			const error = new RateLimitError({
				retryAfter: 1.1,
				limit: 10,
				resetTime: new Date(Date.now() + 2000),
			});

			expect(error.headers?.['Retry-After']).toBe('2');
		});
	});
});
