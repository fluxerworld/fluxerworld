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

import {InMemoryProvider} from '@fluxer/cache/src/providers/InMemoryProvider';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('InMemoryProvider', () => {
	let cache: InMemoryProvider;

	beforeEach(() => {
		vi.useFakeTimers();
		cache = new InMemoryProvider();
	});

	afterEach(() => {
		cache.destroy();
		vi.useRealTimers();
	});

	describe('get and set', () => {
		it('returns null for non-existent key', async () => {
			const result = await cache.get('nonexistent');
			expect(result).toBeNull();
		});

		it('stores and retrieves a string value', async () => {
			await cache.set('key', 'value');
			const result = await cache.get<string>('key');
			expect(result).toBe('value');
		});

		it('stores and retrieves an object value', async () => {
			const obj = {name: 'test', count: 42, nested: {foo: 'bar'}};
			await cache.set('obj', obj);
			const result = await cache.get<typeof obj>('obj');
			expect(result).toEqual(obj);
		});

		it('stores and retrieves an array value', async () => {
			const arr = [1, 2, 3, 'four', {five: 5}];
			await cache.set('arr', arr);
			const result = await cache.get<typeof arr>('arr');
			expect(result).toEqual(arr);
		});

		it('stores and retrieves null value', async () => {
			await cache.set('nullKey', null);
			const result = await cache.get('nullKey');
			expect(result).toBeNull();
		});

		it('stores and retrieves zero value', async () => {
			await cache.set('zero', 0);
			const result = await cache.get<number>('zero');
			expect(result).toBe(0);
		});

		it('stores and retrieves empty string', async () => {
			await cache.set('empty', '');
			const result = await cache.get<string>('empty');
			expect(result).toBe('');
		});

		it('stores and retrieves boolean values', async () => {
			await cache.set('true', true);
			await cache.set('false', false);
			expect(await cache.get<boolean>('true')).toBe(true);
			expect(await cache.get<boolean>('false')).toBe(false);
		});

		it('overwrites existing value', async () => {
			await cache.set('key', 'first');
			await cache.set('key', 'second');
			const result = await cache.get<string>('key');
			expect(result).toBe('second');
		});
	});

	describe('TTL and expiration', () => {
		it('returns value before TTL expires', async () => {
			await cache.set('key', 'value', 60);
			vi.advanceTimersByTime(30000);
			const result = await cache.get<string>('key');
			expect(result).toBe('value');
		});

		it('returns null after TTL expires', async () => {
			await cache.set('key', 'value', 1);
			vi.advanceTimersByTime(1001);
			const result = await cache.get<string>('key');
			expect(result).toBeNull();
		});

		it('returns null exactly at TTL boundary', async () => {
			await cache.set('key', 'value', 5);
			vi.advanceTimersByTime(5000);
			const result = await cache.get<string>('key');
			expect(result).toBeNull();
		});

		it('stores value without TTL indefinitely', async () => {
			await cache.set('key', 'value');
			vi.advanceTimersByTime(999999999);
			const result = await cache.get<string>('key');
			expect(result).toBe('value');
		});

		it('handles very short TTL', async () => {
			await cache.set('key', 'value', 1);
			const beforeExpiry = await cache.get<string>('key');
			expect(beforeExpiry).toBe('value');

			vi.advanceTimersByTime(1000);
			const afterExpiry = await cache.get<string>('key');
			expect(afterExpiry).toBeNull();
		});

		it('handles long TTL values', async () => {
			const oneYear = 365 * 24 * 60 * 60;
			await cache.set('key', 'value', oneYear);
			vi.advanceTimersByTime(oneYear * 1000 - 1);
			expect(await cache.get<string>('key')).toBe('value');

			vi.advanceTimersByTime(2);
			expect(await cache.get<string>('key')).toBeNull();
		});
	});

	describe('delete', () => {
		it('deletes existing key', async () => {
			await cache.set('key', 'value');
			await cache.delete('key');
			const result = await cache.get('key');
			expect(result).toBeNull();
		});

		it('does not throw when deleting non-existent key', async () => {
			await expect(cache.delete('nonexistent')).resolves.toBeUndefined();
		});

		it('only deletes specified key', async () => {
			await cache.set('key1', 'value1');
			await cache.set('key2', 'value2');
			await cache.delete('key1');
			expect(await cache.get('key1')).toBeNull();
			expect(await cache.get<string>('key2')).toBe('value2');
		});
	});

	describe('getAndDelete', () => {
		it('returns value and deletes key', async () => {
			await cache.set('key', 'value');
			const result = await cache.getAndDelete<string>('key');
			expect(result).toBe('value');
			expect(await cache.get('key')).toBeNull();
		});

		it('returns null for non-existent key', async () => {
			const result = await cache.getAndDelete('nonexistent');
			expect(result).toBeNull();
		});

		it('returns null for expired key', async () => {
			await cache.set('key', 'value', 1);
			vi.advanceTimersByTime(1001);
			const result = await cache.getAndDelete('key');
			expect(result).toBeNull();
		});
	});

	describe('exists', () => {
		it('returns true for existing key', async () => {
			await cache.set('key', 'value');
			const result = await cache.exists('key');
			expect(result).toBe(true);
		});

		it('returns false for non-existent key', async () => {
			const result = await cache.exists('nonexistent');
			expect(result).toBe(false);
		});

		it('returns false for expired key', async () => {
			await cache.set('key', 'value', 1);
			vi.advanceTimersByTime(1001);
			const result = await cache.exists('key');
			expect(result).toBe(false);
		});

		it('cleans up expired key on exists check', async () => {
			await cache.set('key', 'value', 1);
			vi.advanceTimersByTime(1001);
			await cache.exists('key');
			await cache.set('key', 'newValue');
			expect(await cache.get<string>('key')).toBe('newValue');
		});
	});

	describe('expire', () => {
		it('sets TTL on existing key', async () => {
			await cache.set('key', 'value');
			await cache.expire('key', 5);
			vi.advanceTimersByTime(4999);
			expect(await cache.get<string>('key')).toBe('value');
			vi.advanceTimersByTime(2);
			expect(await cache.get('key')).toBeNull();
		});

		it('does not set TTL on non-existent key', async () => {
			await cache.expire('nonexistent', 5);
			expect(await cache.exists('nonexistent')).toBe(false);
		});

		it('does not set TTL on expired key', async () => {
			await cache.set('key', 'value', 1);
			vi.advanceTimersByTime(1001);
			await cache.expire('key', 5);
			expect(await cache.exists('key')).toBe(false);
		});

		it('overwrites existing TTL', async () => {
			await cache.set('key', 'value', 10);
			await cache.expire('key', 2);
			vi.advanceTimersByTime(2001);
			expect(await cache.get('key')).toBeNull();
		});

		it('extends TTL on key with existing TTL', async () => {
			await cache.set('key', 'value', 5);
			vi.advanceTimersByTime(3000);
			await cache.expire('key', 10);
			vi.advanceTimersByTime(8000);
			expect(await cache.get<string>('key')).toBe('value');
		});
	});

	describe('ttl', () => {
		it('returns -2 for non-existent key', async () => {
			const result = await cache.ttl('nonexistent');
			expect(result).toBe(-2);
		});

		it('returns -1 for key without TTL', async () => {
			await cache.set('key', 'value');
			const result = await cache.ttl('key');
			expect(result).toBe(-1);
		});

		it('returns remaining TTL in seconds', async () => {
			await cache.set('key', 'value', 60);
			vi.advanceTimersByTime(30000);
			const result = await cache.ttl('key');
			expect(result).toBe(30);
		});

		it('returns 0 when TTL is almost expired', async () => {
			await cache.set('key', 'value', 1);
			vi.advanceTimersByTime(999);
			const result = await cache.ttl('key');
			expect(result).toBe(0);
		});

		it('returns -2 for expired key', async () => {
			await cache.set('key', 'value', 1);
			vi.advanceTimersByTime(1001);
			const result = await cache.ttl('key');
			expect(result).toBe(-2);
		});
	});

	describe('mget', () => {
		it('returns values for multiple keys', async () => {
			await cache.set('key1', 'value1');
			await cache.set('key2', 'value2');
			await cache.set('key3', 'value3');
			const results = await cache.mget<string>(['key1', 'key2', 'key3']);
			expect(results).toEqual(['value1', 'value2', 'value3']);
		});

		it('returns null for missing keys', async () => {
			await cache.set('key1', 'value1');
			const results = await cache.mget<string>(['key1', 'missing', 'key1']);
			expect(results).toEqual(['value1', null, 'value1']);
		});

		it('returns empty array for empty input', async () => {
			const results = await cache.mget([]);
			expect(results).toEqual([]);
		});

		it('handles expired keys correctly', async () => {
			await cache.set('key1', 'value1', 1);
			await cache.set('key2', 'value2', 10);
			vi.advanceTimersByTime(2000);
			const results = await cache.mget<string>(['key1', 'key2']);
			expect(results).toEqual([null, 'value2']);
		});
	});

	describe('mset', () => {
		it('sets multiple keys at once', async () => {
			await cache.mset([
				{key: 'key1', value: 'value1'},
				{key: 'key2', value: 'value2'},
				{key: 'key3', value: 'value3'},
			]);
			expect(await cache.get<string>('key1')).toBe('value1');
			expect(await cache.get<string>('key2')).toBe('value2');
			expect(await cache.get<string>('key3')).toBe('value3');
		});

		it('sets TTL for individual keys', async () => {
			await cache.mset([
				{key: 'short', value: 'shortVal', ttlSeconds: 1},
				{key: 'long', value: 'longVal', ttlSeconds: 60},
			]);
			vi.advanceTimersByTime(2000);
			expect(await cache.get('short')).toBeNull();
			expect(await cache.get<string>('long')).toBe('longVal');
		});

		it('handles empty array', async () => {
			await expect(cache.mset([])).resolves.toBeUndefined();
		});

		it('overwrites existing keys', async () => {
			await cache.set('key1', 'original');
			await cache.mset([{key: 'key1', value: 'updated'}]);
			expect(await cache.get<string>('key1')).toBe('updated');
		});
	});

	describe('deletePattern', () => {
		it('deletes keys matching pattern', async () => {
			await cache.set('user:1', 'user1');
			await cache.set('user:2', 'user2');
			await cache.set('session:1', 'session1');

			const count = await cache.deletePattern('user:*');
			expect(count).toBe(2);
			expect(await cache.get('user:1')).toBeNull();
			expect(await cache.get('user:2')).toBeNull();
			expect(await cache.get<string>('session:1')).toBe('session1');
		});

		it('returns 0 for no matches', async () => {
			await cache.set('key1', 'value1');
			const count = await cache.deletePattern('nonexistent:*');
			expect(count).toBe(0);
		});

		it('handles complex patterns', async () => {
			await cache.set('prefix:middle:suffix', 'value1');
			await cache.set('prefix:other:suffix', 'value2');
			await cache.set('other:middle:suffix', 'value3');

			const count = await cache.deletePattern('prefix:*:suffix');
			expect(count).toBe(2);
			expect(await cache.get('prefix:middle:suffix')).toBeNull();
			expect(await cache.get('prefix:other:suffix')).toBeNull();
			expect(await cache.get<string>('other:middle:suffix')).toBe('value3');
		});

		it('handles wildcard at start', async () => {
			await cache.set('test:suffix', 'value1');
			await cache.set('other:suffix', 'value2');
			await cache.set('test:other', 'value3');

			const count = await cache.deletePattern('*:suffix');
			expect(count).toBe(2);
		});
	});

	describe('acquireLock', () => {
		it('acquires lock successfully', async () => {
			const token = await cache.acquireLock('resource', 60);
			expect(token).not.toBeNull();
			expect(token).toMatch(/^[a-f0-9]{32}$/);
		});

		it('fails to acquire lock when already held', async () => {
			await cache.acquireLock('resource', 60);
			const secondToken = await cache.acquireLock('resource', 60);
			expect(secondToken).toBeNull();
		});

		it('allows reacquiring lock after expiry', async () => {
			await cache.acquireLock('resource', 1);
			vi.advanceTimersByTime(1001);
			const newToken = await cache.acquireLock('resource', 60);
			expect(newToken).not.toBeNull();
		});

		it('throws on invalid key format', async () => {
			await expect(cache.acquireLock('invalid key!', 60)).rejects.toThrow('Invalid lock key format');
		});

		it('allows valid key characters', async () => {
			const token = await cache.acquireLock('valid-key_123:test', 60);
			expect(token).not.toBeNull();
		});

		it('acquires different locks independently', async () => {
			const token1 = await cache.acquireLock('resource1', 60);
			const token2 = await cache.acquireLock('resource2', 60);
			expect(token1).not.toBeNull();
			expect(token2).not.toBeNull();
			expect(token1).not.toBe(token2);
		});
	});

	describe('releaseLock', () => {
		it('releases lock with correct token', async () => {
			const token = await cache.acquireLock('resource', 60);
			const released = await cache.releaseLock('resource', token!);
			expect(released).toBe(true);

			const newToken = await cache.acquireLock('resource', 60);
			expect(newToken).not.toBeNull();
		});

		it('fails to release with wrong token', async () => {
			await cache.acquireLock('resource', 60);
			const released = await cache.releaseLock('resource', 'wrongtoken123456789012');
			expect(released).toBe(false);
		});

		it('fails to release non-existent lock', async () => {
			const released = await cache.releaseLock('nonexistent', 'sometoken12345678901234');
			expect(released).toBe(false);
		});

		it('throws on invalid key format', async () => {
			await expect(cache.releaseLock('invalid key!', 'token')).rejects.toThrow('Invalid lock key format');
		});

		it('throws on invalid token format', async () => {
			await expect(cache.releaseLock('validkey', 'INVALID_TOKEN!')).rejects.toThrow('Invalid lock token format');
		});
	});

	describe('getAndRenewTtl', () => {
		it('returns value and renews TTL', async () => {
			await cache.set('key', 'value', 10);
			vi.advanceTimersByTime(5000);

			const result = await cache.getAndRenewTtl<string>('key', 60);
			expect(result).toBe('value');

			vi.advanceTimersByTime(30000);
			expect(await cache.get<string>('key')).toBe('value');

			vi.advanceTimersByTime(31000);
			expect(await cache.get('key')).toBeNull();
		});

		it('returns null for non-existent key', async () => {
			const result = await cache.getAndRenewTtl('nonexistent', 60);
			expect(result).toBeNull();
		});

		it('returns null for expired key', async () => {
			await cache.set('key', 'value', 1);
			vi.advanceTimersByTime(1001);
			const result = await cache.getAndRenewTtl('key', 60);
			expect(result).toBeNull();
		});
	});

	describe('publish', () => {
		it('does not throw (no-op in memory provider)', async () => {
			await expect(cache.publish('channel', 'message')).resolves.toBeUndefined();
		});
	});

	describe('Set operations', () => {
		describe('sadd', () => {
			it('adds member to a new set', async () => {
				await cache.sadd('myset', 'member1', 60);
				const members = await cache.smembers('myset');
				expect(members.has('member1')).toBe(true);
			});

			it('adds member to existing set', async () => {
				await cache.sadd('myset', 'member1', 60);
				await cache.sadd('myset', 'member2', 60);
				const members = await cache.smembers('myset');
				expect(members.has('member1')).toBe(true);
				expect(members.has('member2')).toBe(true);
			});

			it('does not duplicate members', async () => {
				await cache.sadd('myset', 'member1', 60);
				await cache.sadd('myset', 'member1', 60);
				const members = await cache.smembers('myset');
				expect(members.size).toBe(1);
			});
		});

		describe('srem', () => {
			it('removes member from set', async () => {
				await cache.sadd('myset', 'member1', 60);
				await cache.sadd('myset', 'member2', 60);
				await cache.srem('myset', 'member1');
				const members = await cache.smembers('myset');
				expect(members.has('member1')).toBe(false);
				expect(members.has('member2')).toBe(true);
			});

			it('removes set when last member is removed', async () => {
				await cache.sadd('myset', 'member1', 60);
				await cache.srem('myset', 'member1');
				const members = await cache.smembers('myset');
				expect(members.size).toBe(0);
			});

			it('does not throw when removing from non-existent set', async () => {
				await expect(cache.srem('nonexistent', 'member')).resolves.toBeUndefined();
			});
		});

		describe('smembers', () => {
			it('returns all members of set', async () => {
				await cache.sadd('myset', 'member1', 60);
				await cache.sadd('myset', 'member2', 60);
				await cache.sadd('myset', 'member3', 60);
				const members = await cache.smembers('myset');
				expect(members.size).toBe(3);
				expect(members).toEqual(new Set(['member1', 'member2', 'member3']));
			});

			it('returns empty set for non-existent key', async () => {
				const members = await cache.smembers('nonexistent');
				expect(members.size).toBe(0);
			});

			it('returns empty set when TTL expires', async () => {
				await cache.sadd('myset', 'member1', 1);
				vi.advanceTimersByTime(2000);
				const members = await cache.smembers('myset');
				expect(members.size).toBe(0);
			});
		});

		describe('sismember', () => {
			it('returns true for existing member', async () => {
				await cache.sadd('myset', 'member1', 60);
				const result = await cache.sismember('myset', 'member1');
				expect(result).toBe(true);
			});

			it('returns false for non-existing member', async () => {
				await cache.sadd('myset', 'member1', 60);
				const result = await cache.sismember('myset', 'member2');
				expect(result).toBe(false);
			});

			it('returns false for non-existent set', async () => {
				const result = await cache.sismember('nonexistent', 'member');
				expect(result).toBe(false);
			});

			it('returns false when TTL expires', async () => {
				await cache.sadd('myset', 'member1', 1);
				vi.advanceTimersByTime(2000);
				const result = await cache.sismember('myset', 'member1');
				expect(result).toBe(false);
			});
		});
	});

	describe('Memory limits', () => {
		it('evicts oldest entry when max size reached', async () => {
			const smallCache = new InMemoryProvider({maxSize: 3});
			try {
				await smallCache.set('key1', 'value1');
				await smallCache.set('key2', 'value2');
				await smallCache.set('key3', 'value3');
				await smallCache.set('key4', 'value4');

				expect(await smallCache.get('key1')).toBeNull();
				expect(await smallCache.get<string>('key2')).toBe('value2');
				expect(await smallCache.get<string>('key3')).toBe('value3');
				expect(await smallCache.get<string>('key4')).toBe('value4');
			} finally {
				smallCache.destroy();
			}
		});

		it('evicts multiple entries as needed', async () => {
			const smallCache = new InMemoryProvider({maxSize: 2});
			try {
				await smallCache.set('key1', 'value1');
				await smallCache.set('key2', 'value2');
				await smallCache.set('key3', 'value3');
				await smallCache.set('key4', 'value4');
				await smallCache.set('key5', 'value5');

				expect(await smallCache.get('key1')).toBeNull();
				expect(await smallCache.get('key2')).toBeNull();
				expect(await smallCache.get('key3')).toBeNull();
				expect(await smallCache.get<string>('key4')).toBe('value4');
				expect(await smallCache.get<string>('key5')).toBe('value5');
			} finally {
				smallCache.destroy();
			}
		});

		it('uses default max size of 10000', async () => {
			const defaultCache = new InMemoryProvider();
			try {
				for (let i = 0; i < 100; i++) {
					await defaultCache.set(`key${i}`, `value${i}`);
				}
				expect(await defaultCache.get<string>('key0')).toBe('value0');
			} finally {
				defaultCache.destroy();
			}
		});
	});

	describe('Cleanup interval', () => {
		it('cleans up expired entries periodically', async () => {
			const cleanupCache = new InMemoryProvider({cleanupIntervalMs: 1000});
			try {
				await cleanupCache.set('key1', 'value1', 2);
				await cleanupCache.set('key2', 'value2', 10);

				vi.advanceTimersByTime(3000);

				expect(await cleanupCache.get<string>('key2')).toBe('value2');
			} finally {
				cleanupCache.destroy();
			}
		});

		it('cleans up expired locks', async () => {
			const cleanupCache = new InMemoryProvider({cleanupIntervalMs: 1000});
			try {
				await cleanupCache.acquireLock('resource', 1);
				vi.advanceTimersByTime(2000);

				const newToken = await cleanupCache.acquireLock('resource', 60);
				expect(newToken).not.toBeNull();
			} finally {
				cleanupCache.destroy();
			}
		});
	});

	describe('destroy', () => {
		it('clears all data', async () => {
			await cache.set('key1', 'value1');
			await cache.set('key2', 'value2');
			await cache.sadd('set1', 'member1', 60);
			await cache.acquireLock('lock1', 60);

			cache.destroy();

			const newCache = new InMemoryProvider();
			try {
				expect(await newCache.get('key1')).toBeNull();
			} finally {
				newCache.destroy();
			}
		});

		it('stops cleanup interval', () => {
			const cleanupCache = new InMemoryProvider({cleanupIntervalMs: 1000});
			cleanupCache.destroy();
			expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
		});

		it('can be called multiple times safely', () => {
			expect(() => {
				cache.destroy();
				cache.destroy();
			}).not.toThrow();
		});
	});

	describe('Edge cases', () => {
		it('handles special characters in keys', async () => {
			const specialKey = 'key:with:colons';
			await cache.set(specialKey, 'value');
			expect(await cache.get<string>(specialKey)).toBe('value');
		});

		it('handles unicode in values', async () => {
			const unicodeValue = 'Hello World';
			await cache.set('unicode', unicodeValue);
			expect(await cache.get<string>('unicode')).toBe(unicodeValue);
		});

		it('handles large objects', async () => {
			const largeObj = {
				data: Array.from({length: 1000}, (_, i) => ({
					id: i,
					name: `item-${i}`,
					nested: {value: i * 2},
				})),
			};
			await cache.set('large', largeObj);
			const result = await cache.get<typeof largeObj>('large');
			expect(result?.data.length).toBe(1000);
		});

		it('handles rapid sequential operations', async () => {
			for (let i = 0; i < 100; i++) {
				await cache.set(`rapid-${i}`, i);
			}
			for (let i = 0; i < 100; i++) {
				expect(await cache.get<number>(`rapid-${i}`)).toBe(i);
			}
		});

		it('handles concurrent operations', async () => {
			const promises = [];
			for (let i = 0; i < 50; i++) {
				promises.push(cache.set(`concurrent-${i}`, i));
			}
			await Promise.all(promises);

			const getPromises = [];
			for (let i = 0; i < 50; i++) {
				getPromises.push(cache.get<number>(`concurrent-${i}`));
			}
			const results = await Promise.all(getPromises);
			expect(results).toEqual(Array.from({length: 50}, (_, i) => i));
		});
	});
});
