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
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('InMemoryCacheService', () => {
	let cache: InMemoryCacheService;

	beforeEach(() => {
		cache = new InMemoryCacheService();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('get', () => {
		it('should return null for non-existent keys', async () => {
			const result = await cache.get('non-existent-key');
			expect(result).toBeNull();
		});

		it('should return the stored value for existing keys', async () => {
			await cache.set('test-key', {value: 42});
			const result = await cache.get<{value: number}>('test-key');
			expect(result).toEqual({value: 42});
		});

		it('should return null for expired entries', async () => {
			await cache.set('expiring-key', {data: 'test'}, 5);
			vi.advanceTimersByTime(6000);
			const result = await cache.get('expiring-key');
			expect(result).toBeNull();
		});

		it('should return value for non-expired entries', async () => {
			await cache.set('valid-key', {data: 'test'}, 10);
			vi.advanceTimersByTime(5000);
			const result = await cache.get<{data: string}>('valid-key');
			expect(result).toEqual({data: 'test'});
		});

		it('should remove expired entries from cache on get', async () => {
			await cache.set('remove-test', 'value', 1);
			vi.advanceTimersByTime(2000);
			await cache.get('remove-test');
			vi.advanceTimersByTime(0);
			const secondGet = await cache.get('remove-test');
			expect(secondGet).toBeNull();
		});
	});

	describe('set', () => {
		it('should store primitive values', async () => {
			await cache.set('string-key', 'hello');
			await cache.set('number-key', 123);
			await cache.set('boolean-key', true);

			expect(await cache.get('string-key')).toBe('hello');
			expect(await cache.get('number-key')).toBe(123);
			expect(await cache.get('boolean-key')).toBe(true);
		});

		it('should store object values', async () => {
			const obj = {nested: {value: [1, 2, 3]}};
			await cache.set('object-key', obj);
			expect(await cache.get('object-key')).toEqual(obj);
		});

		it('should store array values', async () => {
			const arr = [1, 'two', {three: 3}];
			await cache.set('array-key', arr);
			expect(await cache.get('array-key')).toEqual(arr);
		});

		it('should overwrite existing values', async () => {
			await cache.set('overwrite-key', 'first');
			await cache.set('overwrite-key', 'second');
			expect(await cache.get('overwrite-key')).toBe('second');
		});

		it('should store values without TTL indefinitely', async () => {
			await cache.set('no-ttl-key', 'persistent');
			vi.advanceTimersByTime(100000000);
			expect(await cache.get('no-ttl-key')).toBe('persistent');
		});

		it('should calculate correct expiration time based on TTL', async () => {
			await cache.set('ttl-key', 'value', 60);
			vi.advanceTimersByTime(59999);
			expect(await cache.get('ttl-key')).toBe('value');
			vi.advanceTimersByTime(2);
			expect(await cache.get('ttl-key')).toBeNull();
		});
	});

	describe('delete', () => {
		it('should remove existing entries', async () => {
			await cache.set('delete-key', 'value');
			await cache.delete('delete-key');
			expect(await cache.get('delete-key')).toBeNull();
		});

		it('should not throw when deleting non-existent keys', async () => {
			await expect(cache.delete('non-existent')).resolves.toBeUndefined();
		});

		it('should only delete the specified key', async () => {
			await cache.set('key1', 'value1');
			await cache.set('key2', 'value2');
			await cache.delete('key1');
			expect(await cache.get('key1')).toBeNull();
			expect(await cache.get('key2')).toBe('value2');
		});
	});

	describe('edge cases', () => {
		it('should handle empty string keys', async () => {
			await cache.set('', 'empty-key-value');
			expect(await cache.get('')).toBe('empty-key-value');
		});

		it('should handle null values', async () => {
			await cache.set('null-value', null);
			expect(await cache.get('null-value')).toBeNull();
		});

		it('should handle undefined values', async () => {
			await cache.set('undefined-value', undefined);
			expect(await cache.get('undefined-value')).toBeUndefined();
		});

		it('should handle zero TTL', async () => {
			await cache.set('zero-ttl', 'value', 0);
			expect(await cache.get('zero-ttl')).toBe('value');
		});

		it('should handle very large TTL values', async () => {
			await cache.set('large-ttl', 'value', Number.MAX_SAFE_INTEGER);
			expect(await cache.get('large-ttl')).toBe('value');
		});

		it('should handle special characters in keys', async () => {
			const specialKey = 'key:with:colons/and/slashes?and=query&params';
			await cache.set(specialKey, 'special');
			expect(await cache.get(specialKey)).toBe('special');
		});

		it('should handle concurrent operations', async () => {
			const operations = [];
			for (let i = 0; i < 100; i++) {
				operations.push(cache.set(`concurrent-${i}`, i));
			}
			await Promise.all(operations);

			const results = await Promise.all(Array.from({length: 100}, (_, i) => cache.get(`concurrent-${i}`)));

			for (let i = 0; i < 100; i++) {
				expect(results[i]).toBe(i);
			}
		});
	});
});
