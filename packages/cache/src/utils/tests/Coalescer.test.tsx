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

import {Coalescer} from '@fluxer/cache/src/utils/Coalescer';
import {beforeEach, describe, expect, it, vi} from 'vitest';

describe('Coalescer', () => {
	let coalescer: Coalescer;

	beforeEach(() => {
		coalescer = new Coalescer();
	});

	describe('basic functionality', () => {
		it('executes function and returns result', async () => {
			const result = await coalescer.coalesce('key', async () => 'value');
			expect(result).toBe('value');
		});

		it('executes function with complex return type', async () => {
			const complexValue = {name: 'test', count: 42, nested: {data: [1, 2, 3]}};
			const result = await coalescer.coalesce('key', async () => complexValue);
			expect(result).toEqual(complexValue);
		});

		it('handles null return value', async () => {
			const result = await coalescer.coalesce('key', async () => null);
			expect(result).toBeNull();
		});

		it('handles undefined return value', async () => {
			const result = await coalescer.coalesce('key', async () => undefined);
			expect(result).toBeUndefined();
		});

		it('handles numeric return value', async () => {
			const result = await coalescer.coalesce('key', async () => 42);
			expect(result).toBe(42);
		});

		it('handles boolean return value', async () => {
			const trueResult = await coalescer.coalesce('key1', async () => true);
			const falseResult = await coalescer.coalesce('key2', async () => false);
			expect(trueResult).toBe(true);
			expect(falseResult).toBe(false);
		});
	});

	describe('request coalescing', () => {
		it('coalesces concurrent requests with same key', async () => {
			const fn = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => resolve('result'), 100);
					}),
			);

			const [result1, result2, result3] = await Promise.all([
				coalescer.coalesce('sameKey', fn),
				coalescer.coalesce('sameKey', fn),
				coalescer.coalesce('sameKey', fn),
			]);

			expect(fn).toHaveBeenCalledTimes(1);
			expect(result1).toBe('result');
			expect(result2).toBe('result');
			expect(result3).toBe('result');
		});

		it('does not coalesce requests with different keys', async () => {
			const fn = vi.fn().mockResolvedValue('result');

			await Promise.all([
				coalescer.coalesce('key1', fn),
				coalescer.coalesce('key2', fn),
				coalescer.coalesce('key3', fn),
			]);

			expect(fn).toHaveBeenCalledTimes(3);
		});

		it('allows new request after previous completes', async () => {
			let callCount = 0;
			const fn = vi.fn().mockImplementation(async () => {
				callCount++;
				return `result-${callCount}`;
			});

			const result1 = await coalescer.coalesce('key', fn);
			const result2 = await coalescer.coalesce('key', fn);

			expect(fn).toHaveBeenCalledTimes(2);
			expect(result1).toBe('result-1');
			expect(result2).toBe('result-2');
		});

		it('coalesces only during pending period', async () => {
			let resolveFirst: (value: string) => void;
			const firstPromise = new Promise<string>((resolve) => {
				resolveFirst = resolve;
			});
			const fn = vi.fn().mockReturnValue(firstPromise);

			const coalescedPromise1 = coalescer.coalesce('key', fn);
			const coalescedPromise2 = coalescer.coalesce('key', fn);

			expect(fn).toHaveBeenCalledTimes(1);

			resolveFirst!('first-result');
			await Promise.all([coalescedPromise1, coalescedPromise2]);

			const fn2 = vi.fn().mockResolvedValue('second-result');
			const result = await coalescer.coalesce('key', fn2);

			expect(fn2).toHaveBeenCalledTimes(1);
			expect(result).toBe('second-result');
		});
	});

	describe('error handling', () => {
		it('propagates errors to all coalesced callers', async () => {
			const error = new Error('test error');
			const fn = vi.fn().mockRejectedValue(error);

			const promises = [coalescer.coalesce('key', fn), coalescer.coalesce('key', fn), coalescer.coalesce('key', fn)];

			const results = await Promise.allSettled(promises);

			expect(fn).toHaveBeenCalledTimes(1);
			results.forEach((result) => {
				expect(result.status).toBe('rejected');
				if (result.status === 'rejected') {
					expect(result.reason).toBe(error);
				}
			});
		});

		it('clears pending state after error', async () => {
			const error = new Error('test error');
			const failingFn = vi.fn().mockRejectedValue(error);
			const succeedingFn = vi.fn().mockResolvedValue('success');

			try {
				await coalescer.coalesce('key', failingFn);
			} catch {}

			const result = await coalescer.coalesce('key', succeedingFn);
			expect(result).toBe('success');
			expect(succeedingFn).toHaveBeenCalledTimes(1);
		});

		it('handles synchronous errors', async () => {
			const error = new Error('sync error');
			const fn = vi.fn().mockImplementation(() => {
				throw error;
			});

			await expect(coalescer.coalesce('key', fn)).rejects.toThrow('sync error');
		});
	});

	describe('different keys', () => {
		it('handles multiple different keys concurrently', async () => {
			const fn1 = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => resolve('result1'), 50);
					}),
			);
			const fn2 = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => resolve('result2'), 50);
					}),
			);
			const fn3 = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => resolve('result3'), 50);
					}),
			);

			const [r1a, r1b, r2a, r2b, r3a, r3b] = await Promise.all([
				coalescer.coalesce('key1', fn1),
				coalescer.coalesce('key1', fn1),
				coalescer.coalesce('key2', fn2),
				coalescer.coalesce('key2', fn2),
				coalescer.coalesce('key3', fn3),
				coalescer.coalesce('key3', fn3),
			]);

			expect(fn1).toHaveBeenCalledTimes(1);
			expect(fn2).toHaveBeenCalledTimes(1);
			expect(fn3).toHaveBeenCalledTimes(1);

			expect(r1a).toBe('result1');
			expect(r1b).toBe('result1');
			expect(r2a).toBe('result2');
			expect(r2b).toBe('result2');
			expect(r3a).toBe('result3');
			expect(r3b).toBe('result3');
		});

		it('handles special characters in keys', async () => {
			const fn = vi.fn().mockResolvedValue('result');

			await coalescer.coalesce('key:with:colons', fn);
			await coalescer.coalesce('key/with/slashes', fn);
			await coalescer.coalesce('key.with.dots', fn);

			expect(fn).toHaveBeenCalledTimes(3);
		});

		it('handles empty string key', async () => {
			const fn = vi.fn().mockResolvedValue('result');
			const result = await coalescer.coalesce('', fn);
			expect(result).toBe('result');
		});
	});

	describe('type safety', () => {
		it('preserves return type', async () => {
			interface User {
				id: number;
				name: string;
			}

			const user: User = {id: 1, name: 'test'};
			const result = await coalescer.coalesce<User>('key', async () => user);

			expect(result.id).toBe(1);
			expect(result.name).toBe('test');
		});

		it('handles generic array types', async () => {
			const arr = [1, 2, 3, 4, 5];
			const result = await coalescer.coalesce<Array<number>>('key', async () => arr);
			expect(result).toEqual([1, 2, 3, 4, 5]);
		});
	});

	describe('timing behavior', () => {
		it('executes function only once even with rapid calls', async () => {
			const fn = vi.fn().mockImplementation(
				() =>
					new Promise((resolve) => {
						setTimeout(() => resolve('result'), 100);
					}),
			);

			const promises = [];
			for (let i = 0; i < 100; i++) {
				promises.push(coalescer.coalesce('key', fn));
			}

			const results = await Promise.all(promises);

			expect(fn).toHaveBeenCalledTimes(1);
			results.forEach((result) => {
				expect(result).toBe('result');
			});
		});

		it('handles interleaved requests correctly', async () => {
			let resolve1: (value: string) => void;
			let resolve2: (value: string) => void;

			const fn1 = vi.fn().mockReturnValue(
				new Promise<string>((resolve) => {
					resolve1 = resolve;
				}),
			);
			const fn2 = vi.fn().mockReturnValue(
				new Promise<string>((resolve) => {
					resolve2 = resolve;
				}),
			);

			const p1 = coalescer.coalesce('key1', fn1);
			const p2 = coalescer.coalesce('key2', fn2);

			expect(fn1).toHaveBeenCalledTimes(1);
			expect(fn2).toHaveBeenCalledTimes(1);

			resolve2!('result2');
			resolve1!('result1');

			const [r1, r2] = await Promise.all([p1, p2]);
			expect(r1).toBe('result1');
			expect(r2).toBe('result2');
		});
	});

	describe('cleanup', () => {
		it('removes key from pending map after completion', async () => {
			const fn = vi.fn().mockResolvedValue('result');

			await coalescer.coalesce('key', fn);
			await coalescer.coalesce('key', fn);

			expect(fn).toHaveBeenCalledTimes(2);
		});

		it('removes key from pending map after error', async () => {
			const failingFn = vi.fn().mockRejectedValue(new Error('error'));
			const succeedingFn = vi.fn().mockResolvedValue('success');

			try {
				await coalescer.coalesce('key', failingFn);
			} catch {}

			await coalescer.coalesce('key', succeedingFn);
			expect(succeedingFn).toHaveBeenCalledTimes(1);
		});
	});

	describe('multiple instances', () => {
		it('different coalescer instances do not share state', async () => {
			const coalescer1 = new Coalescer();
			const coalescer2 = new Coalescer();

			let callCount = 0;
			const fn = vi.fn().mockImplementation(async () => {
				callCount++;
				return `result-${callCount}`;
			});

			const [r1, r2] = await Promise.all([coalescer1.coalesce('sameKey', fn), coalescer2.coalesce('sameKey', fn)]);

			expect(fn).toHaveBeenCalledTimes(2);
			expect(r1).toBe('result-1');
			expect(r2).toBe('result-2');
		});
	});
});
