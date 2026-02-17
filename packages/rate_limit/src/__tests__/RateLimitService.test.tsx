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

import {InMemoryCacheService} from '@fluxer/rate_limit/src/InMemoryCacheService';
import {createInMemoryRateLimitService, RateLimitService} from '@fluxer/rate_limit/src/RateLimitService';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('RateLimitService (GCRA)', () => {
	let cache: InMemoryCacheService;
	let service: RateLimitService;

	beforeEach(() => {
		cache = new InMemoryCacheService();
		service = new RateLimitService(cache);
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-27T12:00:00.000Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('checkLimit - basic behavior', () => {
		it('should allow first request', async () => {
			const config = {
				identifier: 'user:123',
				maxAttempts: 5,
				windowMs: 5000,
			};

			const result = await service.checkLimit(config);

			expect(result.allowed).toBe(true);
			expect(result.limit).toBe(5);
			expect(result.remaining).toBe(4);
			expect(result.resetTime).toBeInstanceOf(Date);
		});

		it('should decrement remaining with each request', async () => {
			const config = {
				identifier: 'user:123',
				maxAttempts: 5,
				windowMs: 5000,
			};

			const r1 = await service.checkLimit(config);
			const r2 = await service.checkLimit(config);
			const r3 = await service.checkLimit(config);

			expect(r1.remaining).toBe(4);
			expect(r2.remaining).toBe(3);
			expect(r3.remaining).toBe(2);
		});

		it('should allow burst up to limit', async () => {
			const config = {
				identifier: 'user:burst',
				maxAttempts: 5,
				windowMs: 5000,
			};

			const results = [];
			for (let i = 0; i < 5; i++) {
				results.push(await service.checkLimit(config));
			}

			expect(results.every((r) => r.allowed)).toBe(true);
			expect(results[4].remaining).toBe(0);
		});

		it('should block when burst exhausted', async () => {
			const config = {
				identifier: 'user:blocked',
				maxAttempts: 5,
				windowMs: 5000,
			};

			for (let i = 0; i < 5; i++) {
				await service.checkLimit(config);
			}

			const blocked = await service.checkLimit(config);
			expect(blocked.allowed).toBe(false);
			expect(blocked.remaining).toBe(0);
		});

		it('should isolate different identifiers', async () => {
			const config1 = {identifier: 'user:1', maxAttempts: 2, windowMs: 5000};
			const config2 = {identifier: 'user:2', maxAttempts: 2, windowMs: 5000};

			await service.checkLimit(config1);
			await service.checkLimit(config1);
			const user1Blocked = await service.checkLimit(config1);

			const user2Allowed = await service.checkLimit(config2);

			expect(user1Blocked.allowed).toBe(false);
			expect(user2Allowed.allowed).toBe(true);
		});
	});

	describe('checkLimit - GCRA token refill', () => {
		it('should allow request after one emission interval', async () => {
			const config = {
				identifier: 'user:refill',
				maxAttempts: 5,
				windowMs: 5000,
			};

			for (let i = 0; i < 5; i++) {
				await service.checkLimit(config);
			}

			const blocked = await service.checkLimit(config);
			expect(blocked.allowed).toBe(false);

			vi.advanceTimersByTime(1000);

			const allowed = await service.checkLimit(config);
			expect(allowed.allowed).toBe(true);
		});

		it('should refill tokens gradually over time', async () => {
			const config = {
				identifier: 'user:gradual',
				maxAttempts: 10,
				windowMs: 10000,
			};

			for (let i = 0; i < 10; i++) {
				await service.checkLimit(config);
			}

			vi.advanceTimersByTime(3000);

			const r1 = await service.checkLimit(config);
			const r2 = await service.checkLimit(config);
			const r3 = await service.checkLimit(config);
			const r4 = await service.checkLimit(config);

			expect(r1.allowed).toBe(true);
			expect(r2.allowed).toBe(true);
			expect(r3.allowed).toBe(true);
			expect(r4.allowed).toBe(false);
		});

		it('should allow sustained traffic at steady rate', async () => {
			const config = {
				identifier: 'user:steady',
				maxAttempts: 5,
				windowMs: 5000,
			};

			for (let i = 0; i < 5; i++) {
				await service.checkLimit(config);
			}

			for (let i = 0; i < 10; i++) {
				vi.advanceTimersByTime(1000);
				const result = await service.checkLimit(config);
				expect(result.allowed).toBe(true);
			}
		});

		it('should fully reset after window duration with no requests', async () => {
			const config = {
				identifier: 'user:full-reset',
				maxAttempts: 5,
				windowMs: 5000,
			};

			for (let i = 0; i < 5; i++) {
				await service.checkLimit(config);
			}

			vi.advanceTimersByTime(5001);

			const results = [];
			for (let i = 0; i < 5; i++) {
				results.push(await service.checkLimit(config));
			}

			expect(results.every((r) => r.allowed)).toBe(true);
		});
	});

	describe('retry-after correctness', () => {
		it('should return valid retry-after when blocked', async () => {
			const config = {
				identifier: 'retry:basic',
				maxAttempts: 5,
				windowMs: 5000,
			};

			for (let i = 0; i < 5; i++) {
				await service.checkLimit(config);
			}

			const blocked = await service.checkLimit(config);

			expect(blocked.allowed).toBe(false);
			expect(blocked.retryAfter).toBe(1);
			expect(blocked.retryAfterDecimal).toBeCloseTo(1, 1);
			expect(Number.isFinite(blocked.retryAfter)).toBe(true);
			expect(Number.isNaN(blocked.retryAfter)).toBe(false);
		});

		it('should have retry-after that decreases as time passes', async () => {
			const config = {
				identifier: 'retry:decrease',
				maxAttempts: 2,
				windowMs: 10000,
			};

			await service.checkLimit(config);
			await service.checkLimit(config);

			const blocked1 = await service.checkLimit(config);
			expect(blocked1.retryAfter).toBe(5);

			vi.advanceTimersByTime(2000);

			const blocked2 = await service.checkLimit(config);
			expect(blocked2.retryAfter).toBe(3);
		});

		it('should allow request after waiting retry-after duration', async () => {
			const config = {
				identifier: 'retry:wait',
				maxAttempts: 3,
				windowMs: 6000,
			};

			await service.checkLimit(config);
			await service.checkLimit(config);
			await service.checkLimit(config);

			const blocked = await service.checkLimit(config);
			expect(blocked.allowed).toBe(false);

			vi.advanceTimersByTime(blocked.retryAfter! * 1000);

			const allowed = await service.checkLimit(config);
			expect(allowed.allowed).toBe(true);
		});

		it('should have minimum retry-after of 1 second', async () => {
			const config = {
				identifier: 'retry:minimum',
				maxAttempts: 10,
				windowMs: 1000,
			};

			for (let i = 0; i < 10; i++) {
				await service.checkLimit(config);
			}

			const blocked = await service.checkLimit(config);
			expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
		});
	});

	describe('reset time correctness', () => {
		it('should return reset time in the future when allowed', async () => {
			const config = {
				identifier: 'reset:allowed',
				maxAttempts: 5,
				windowMs: 5000,
			};

			const result = await service.checkLimit(config);
			const now = Date.now();

			expect(result.resetTime.getTime()).toBeGreaterThan(now);
		});

		it('should return valid reset time when blocked', async () => {
			const config = {
				identifier: 'reset:blocked',
				maxAttempts: 2,
				windowMs: 10000,
			};

			await service.checkLimit(config);
			await service.checkLimit(config);

			const blocked = await service.checkLimit(config);
			const now = Date.now();

			expect(blocked.resetTime.getTime()).toBeGreaterThan(now);
			expect(Number.isFinite(blocked.resetTime.getTime())).toBe(true);
		});

		it('should produce valid X-RateLimit-Reset timestamp', async () => {
			const config = {
				identifier: 'reset:header',
				maxAttempts: 3,
				windowMs: 30000,
			};

			await service.checkLimit(config);
			const result = await service.checkLimit(config);

			const resetTimestamp = Math.floor(result.resetTime.getTime() / 1000);
			const nowTimestamp = Math.floor(Date.now() / 1000);

			expect(resetTimestamp).toBeGreaterThan(nowTimestamp);
			expect(resetTimestamp).toBeLessThanOrEqual(nowTimestamp + 30);
		});
	});

	describe('checkBucketLimit', () => {
		it('should track by bucket name', async () => {
			const config = {limit: 10, windowMs: 60000};

			const result = await service.checkBucketLimit('api:messages', config);

			expect(result.allowed).toBe(true);
			expect(result.limit).toBe(10);
		});

		it('should isolate different buckets', async () => {
			const config = {limit: 2, windowMs: 5000};

			await service.checkBucketLimit('bucket:a', config);
			await service.checkBucketLimit('bucket:a', config);
			const aBlocked = await service.checkBucketLimit('bucket:a', config);

			const bAllowed = await service.checkBucketLimit('bucket:b', config);

			expect(aBlocked.allowed).toBe(false);
			expect(bAllowed.allowed).toBe(true);
		});
	});

	describe('checkGlobalLimit', () => {
		it('should use 1 second window', async () => {
			const limit = 5;

			for (let i = 0; i < 5; i++) {
				await service.checkGlobalLimit('ip:test', limit);
			}

			const blocked = await service.checkGlobalLimit('ip:test', limit);
			expect(blocked.allowed).toBe(false);
			expect(blocked.global).toBe(true);

			vi.advanceTimersByTime(200);

			const allowed = await service.checkGlobalLimit('ip:test', limit);
			expect(allowed.allowed).toBe(true);
		});

		it('should include global flag', async () => {
			const result = await service.checkGlobalLimit('ip:flag', 10);
			expect(result.global).toBe(true);
		});
	});

	describe('resetLimit', () => {
		it('should clear rate limit state', async () => {
			const config = {
				identifier: 'user:reset',
				maxAttempts: 2,
				windowMs: 60000,
			};

			await service.checkLimit(config);
			await service.checkLimit(config);
			const blocked = await service.checkLimit(config);
			expect(blocked.allowed).toBe(false);

			await service.resetLimit('user:reset');

			const allowed = await service.checkLimit(config);
			expect(allowed.allowed).toBe(true);
			expect(allowed.remaining).toBe(1);
		});
	});

	describe('edge cases', () => {
		it('should handle limit of 1', async () => {
			const config = {
				identifier: 'edge:one',
				maxAttempts: 1,
				windowMs: 5000,
			};

			const first = await service.checkLimit(config);
			expect(first.allowed).toBe(true);
			expect(first.remaining).toBe(0);

			const second = await service.checkLimit(config);
			expect(second.allowed).toBe(false);
		});

		it('should handle very large limits', async () => {
			const config = {
				identifier: 'edge:large',
				maxAttempts: 1000000,
				windowMs: 60000,
			};

			const result = await service.checkLimit(config);
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBeGreaterThan(999990);
		});

		it('should handle very short windows', async () => {
			const config = {
				identifier: 'edge:short',
				maxAttempts: 5,
				windowMs: 100,
			};

			for (let i = 0; i < 5; i++) {
				await service.checkLimit(config);
			}

			const blocked = await service.checkLimit(config);
			expect(blocked.allowed).toBe(false);

			vi.advanceTimersByTime(25);

			const allowed = await service.checkLimit(config);
			expect(allowed.allowed).toBe(true);
		});

		it('should handle concurrent requests', async () => {
			const config = {
				identifier: 'edge:concurrent',
				maxAttempts: 10,
				windowMs: 60000,
			};

			const results = await Promise.all([
				service.checkLimit(config),
				service.checkLimit(config),
				service.checkLimit(config),
				service.checkLimit(config),
				service.checkLimit(config),
			]);

			const allowedCount = results.filter((r) => r.allowed).length;
			expect(allowedCount).toBe(5);
		});

		it('should handle special characters in identifier', async () => {
			const config = {
				identifier: 'user:test@example.com:action:post:/api/v1/messages',
				maxAttempts: 5,
				windowMs: 60000,
			};

			const result = await service.checkLimit(config);
			expect(result.allowed).toBe(true);
		});

		it('should handle corrupted cache data', async () => {
			await cache.set('ratelimit:corrupted', {invalid: 'data'}, 60);

			const config = {
				identifier: 'corrupted',
				maxAttempts: 5,
				windowMs: 60000,
			};

			const result = await service.checkLimit(config);
			expect(result.allowed).toBe(true);
		});

		it('should handle NaN in cache', async () => {
			await cache.set('ratelimit:nan', {tat: NaN}, 60);

			const config = {
				identifier: 'nan',
				maxAttempts: 5,
				windowMs: 60000,
			};

			const result = await service.checkLimit(config);
			expect(result.allowed).toBe(true);
		});

		it('should handle Infinity in cache', async () => {
			await cache.set('ratelimit:inf', {tat: Infinity}, 60);

			const config = {
				identifier: 'inf',
				maxAttempts: 5,
				windowMs: 60000,
			};

			const result = await service.checkLimit(config);
			expect(result.allowed).toBe(true);
		});
	});

	describe('GCRA algorithm verification', () => {
		it('should enforce emission interval after burst', async () => {
			const config = {
				identifier: 'gcra:emission',
				maxAttempts: 5,
				windowMs: 5000,
			};

			for (let i = 0; i < 5; i++) {
				await service.checkLimit(config);
			}

			const blocked = await service.checkLimit(config);
			expect(blocked.allowed).toBe(false);

			vi.advanceTimersByTime(999);
			const stillBlocked = await service.checkLimit(config);
			expect(stillBlocked.allowed).toBe(false);

			vi.advanceTimersByTime(2);
			const allowed = await service.checkLimit(config);
			expect(allowed.allowed).toBe(true);
		});

		it('should track theoretical arrival time correctly', async () => {
			const config = {
				identifier: 'gcra:tat',
				maxAttempts: 10,
				windowMs: 10000,
			};

			const r1 = await service.checkLimit(config);
			expect(r1.resetTime.getTime()).toBe(Date.now() + 1000);

			await service.checkLimit(config);
			const r2 = await service.checkLimit(config);
			expect(r2.resetTime.getTime()).toBe(Date.now() + 3000);
		});

		it('should handle time advancing past TAT', async () => {
			const config = {
				identifier: 'gcra:past-tat',
				maxAttempts: 5,
				windowMs: 5000,
			};

			await service.checkLimit(config);
			await service.checkLimit(config);

			vi.advanceTimersByTime(10000);

			const result = await service.checkLimit(config);
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(4);
		});
	});

	describe('remaining count accuracy', () => {
		it('should show correct remaining after partial refill', async () => {
			const config = {
				identifier: 'remaining:partial',
				maxAttempts: 10,
				windowMs: 10000,
			};

			for (let i = 0; i < 10; i++) {
				await service.checkLimit(config);
			}

			vi.advanceTimersByTime(5000);

			const result = await service.checkLimit(config);
			expect(result.allowed).toBe(true);
			expect(result.remaining).toBe(4);
		});
	});
});

describe('createInMemoryRateLimitService', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('should return null when disabled', () => {
		const service = createInMemoryRateLimitService(false);
		expect(service).toBeNull();
	});

	it('should return RateLimitService when enabled', () => {
		const service = createInMemoryRateLimitService(true);
		expect(service).toBeInstanceOf(RateLimitService);
	});

	it('should be functional', async () => {
		const service = createInMemoryRateLimitService(true)!;

		const result = await service.checkLimit({
			identifier: 'test',
			maxAttempts: 5,
			windowMs: 60000,
		});

		expect(result.allowed).toBe(true);
	});
});
