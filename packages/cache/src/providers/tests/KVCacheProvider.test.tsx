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

import type {CacheLogger, CacheTelemetry} from '@fluxer/cache/src/CacheProviderTypes';
import {KVCacheProvider} from '@fluxer/cache/src/providers/KVCacheProvider';
import type {IKVPipeline, IKVProvider, IKVSubscription} from '@fluxer/kv_client/src/IKVProvider';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

class MockKVPipeline implements IKVPipeline {
	private operations: Array<{method: string; args: Array<unknown>}> = [];

	constructor(
		private store: Map<string, string>,
		private sets: Map<string, Set<string>>,
		private expiries: Map<string, number>,
	) {}

	get(key: string) {
		this.operations.push({method: 'get', args: [key]});
		return this;
	}

	set(key: string, value: string) {
		this.operations.push({method: 'set', args: [key, value]});
		return this;
	}

	setex(key: string, ttlSeconds: number, value: string) {
		this.operations.push({method: 'setex', args: [key, ttlSeconds, value]});
		return this;
	}

	del(key: string) {
		this.operations.push({method: 'del', args: [key]});
		return this;
	}

	expire(key: string, ttlSeconds: number) {
		this.operations.push({method: 'expire', args: [key, ttlSeconds]});
		return this;
	}

	sadd(key: string, ...members: Array<string>) {
		this.operations.push({method: 'sadd', args: [key, ...members]});
		return this;
	}

	srem(key: string, ...members: Array<string>) {
		this.operations.push({method: 'srem', args: [key, ...members]});
		return this;
	}

	zadd(key: string, score: number, value: string) {
		this.operations.push({method: 'zadd', args: [key, score, value]});
		return this;
	}

	zrem(key: string, ...members: Array<string>) {
		this.operations.push({method: 'zrem', args: [key, ...members]});
		return this;
	}

	mset(...args: Array<string>) {
		this.operations.push({method: 'mset', args});
		return this;
	}

	async exec(): Promise<Array<[Error | null, unknown]>> {
		for (const op of this.operations) {
			switch (op.method) {
				case 'set':
					this.store.set(op.args[0] as string, op.args[1] as string);
					break;
				case 'setex': {
					const [key, ttl, value] = op.args as [string, number, string];
					this.store.set(key, value);
					this.expiries.set(key, Date.now() + ttl * 1000);
					break;
				}
				case 'del':
					this.store.delete(op.args[0] as string);
					break;
				case 'expire': {
					const [expKey, expTtl] = op.args as [string, number];
					if (this.store.has(expKey)) {
						this.expiries.set(expKey, Date.now() + expTtl * 1000);
					}
					break;
				}
				case 'sadd': {
					const [setKey, ...members] = op.args as [string, ...Array<string>];
					let set = this.sets.get(setKey);
					if (!set) {
						set = new Set();
						this.sets.set(setKey, set);
					}
					for (const m of members) {
						set.add(m);
					}
					break;
				}
				case 'mset': {
					const msetArgs = op.args as Array<string>;
					for (let i = 0; i < msetArgs.length; i += 2) {
						this.store.set(msetArgs[i], msetArgs[i + 1]);
					}
					break;
				}
			}
		}
		return this.operations.map(() => [null, 'OK']);
	}
}

class MockKVProvider implements IKVProvider {
	private store = new Map<string, string>();
	private sets = new Map<string, Set<string>>();
	private expiries = new Map<string, number>();

	pipeline() {
		return new MockKVPipeline(this.store, this.sets, this.expiries);
	}

	async get(key: string): Promise<string | null> {
		return this.store.get(key) ?? null;
	}

	async set(key: string, value: string, ...args: Array<string | number>): Promise<string | null> {
		if (args.includes('NX') && this.store.has(key)) {
			return null;
		}
		this.store.set(key, value);
		const exIdx = args.indexOf('EX');
		if (exIdx !== -1 && typeof args[exIdx + 1] === 'number') {
			this.expiries.set(key, Date.now() + (args[exIdx + 1] as number) * 1000);
		}
		return 'OK';
	}

	async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
		this.store.set(key, value);
		this.expiries.set(key, Date.now() + ttlSeconds * 1000);
	}

	async setnx(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
		if (this.store.has(key)) return false;
		this.store.set(key, value);
		if (ttlSeconds) {
			this.expiries.set(key, Date.now() + ttlSeconds * 1000);
		}
		return true;
	}

	async mget(...keys: Array<string>): Promise<Array<string | null>> {
		return keys.map((key) => this.store.get(key) ?? null);
	}

	async mset(...args: Array<string>): Promise<void> {
		for (let i = 0; i < args.length; i += 2) {
			this.store.set(args[i], args[i + 1]);
		}
	}

	async del(...keys: Array<string>): Promise<number> {
		let count = 0;
		for (const key of keys) {
			if (this.store.delete(key)) count++;
		}
		return count;
	}

	async exists(key: string): Promise<number> {
		return this.store.has(key) ? 1 : 0;
	}

	async expire(key: string, ttlSeconds: number): Promise<number> {
		if (!this.store.has(key)) return 0;
		this.expiries.set(key, Date.now() + ttlSeconds * 1000);
		return 1;
	}

	async ttl(key: string): Promise<number> {
		if (!this.store.has(key)) return -2;
		const expiry = this.expiries.get(key);
		if (!expiry) return -1;
		const remaining = Math.floor((expiry - Date.now()) / 1000);
		return remaining > 0 ? remaining : -2;
	}

	async incr(key: string): Promise<number> {
		const val = parseInt(this.store.get(key) ?? '0', 10) + 1;
		this.store.set(key, String(val));
		return val;
	}

	async getex(key: string, ttlSeconds: number): Promise<string | null> {
		const val = this.store.get(key);
		if (val !== undefined) {
			this.expiries.set(key, Date.now() + ttlSeconds * 1000);
		}
		return val ?? null;
	}

	async getdel(key: string): Promise<string | null> {
		const val = this.store.get(key);
		this.store.delete(key);
		return val ?? null;
	}

	async sadd(key: string, ...members: Array<string>): Promise<number> {
		let set = this.sets.get(key);
		if (!set) {
			set = new Set();
			this.sets.set(key, set);
		}
		let added = 0;
		for (const m of members) {
			if (!set.has(m)) {
				set.add(m);
				added++;
			}
		}
		return added;
	}

	async srem(key: string, ...members: Array<string>): Promise<number> {
		const set = this.sets.get(key);
		if (!set) return 0;
		let removed = 0;
		for (const m of members) {
			if (set.delete(m)) removed++;
		}
		return removed;
	}

	async smembers(key: string): Promise<Array<string>> {
		const set = this.sets.get(key);
		return set ? Array.from(set) : [];
	}

	async sismember(key: string, member: string): Promise<number> {
		const set = this.sets.get(key);
		return set?.has(member) ? 1 : 0;
	}

	async scard(key: string): Promise<number> {
		return this.sets.get(key)?.size ?? 0;
	}

	async spop(key: string, count = 1): Promise<Array<string>> {
		const set = this.sets.get(key);
		if (!set) return [];
		const results: Array<string> = [];
		const iter = set.values();
		for (let i = 0; i < count; i++) {
			const next = iter.next();
			if (next.done) break;
			results.push(next.value);
			set.delete(next.value);
		}
		return results;
	}

	async zadd(_key: string, ..._scoreMembers: Array<number | string>): Promise<number> {
		return 1;
	}

	async zrem(_key: string, ..._members: Array<string>): Promise<number> {
		return 1;
	}

	async zcard(_key: string): Promise<number> {
		return 0;
	}

	async zrangebyscore(
		_key: string,
		_min: string | number,
		_max: string | number,
		..._args: Array<string | number>
	): Promise<Array<string>> {
		return [];
	}

	async rpush(_key: string, ..._values: Array<string>): Promise<number> {
		return 1;
	}

	async lpop(_key: string, _count?: number): Promise<Array<string>> {
		return [];
	}

	async llen(_key: string): Promise<number> {
		return 0;
	}

	async hset(_key: string, _field: string, _value: string): Promise<number> {
		return 1;
	}

	async hdel(_key: string, ..._fields: Array<string>): Promise<number> {
		return 1;
	}

	async hget(_key: string, _field: string): Promise<string | null> {
		return null;
	}

	async hgetall(_key: string): Promise<Record<string, string>> {
		return {};
	}

	async publish(_channel: string, _message: string): Promise<number> {
		return 1;
	}

	duplicate(): IKVSubscription {
		return {} as IKVSubscription;
	}

	async releaseLock(_key: string, _token: string): Promise<boolean> {
		return true;
	}

	async renewSnowflakeNode(_key: string, _instanceId: string, _ttlSeconds: number): Promise<boolean> {
		return true;
	}

	async tryConsumeTokens(
		_key: string,
		_requested: number,
		_maxTokens: number,
		_refillRate: number,
		_refillIntervalMs: number,
	): Promise<number> {
		return 0;
	}

	async scheduleBulkDeletion(_queueKey: string, _secondaryKey: string, _score: number, _value: string): Promise<void> {}

	async removeBulkDeletion(_queueKey: string, _secondaryKey: string): Promise<boolean> {
		return true;
	}

	async scan(pattern: string, _count: number): Promise<Array<string>> {
		const regex = new RegExp(pattern.replace(/\*/g, '.*'));
		return Array.from(this.store.keys()).filter((k) => regex.test(k));
	}

	multi(): IKVPipeline {
		return new MockKVPipeline(this.store, this.sets, this.expiries);
	}

	async health(): Promise<boolean> {
		return true;
	}

	clear(): void {
		this.store.clear();
		this.sets.clear();
		this.expiries.clear();
	}
}

function createNoopLogger(): CacheLogger {
	return {
		error: () => {},
	};
}

function createNoopTelemetry(): CacheTelemetry {
	return {
		recordCounter: () => {},
		recordHistogram: () => {},
	};
}

describe('KVCacheProvider', () => {
	let mockClient: MockKVProvider;
	let cache: KVCacheProvider;

	beforeEach(() => {
		mockClient = new MockKVProvider();
		cache = new KVCacheProvider({
			client: mockClient,
			cacheName: 'test',
			logger: createNoopLogger(),
			telemetry: createNoopTelemetry(),
		});
	});

	afterEach(() => {
		mockClient.clear();
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
			const obj = {name: 'test', count: 42};
			await cache.set('obj', obj);
			const result = await cache.get<typeof obj>('obj');
			expect(result).toEqual(obj);
		});

		it('stores value with TTL', async () => {
			await cache.set('key', 'value', 60);
			const result = await cache.get<string>('key');
			expect(result).toBe('value');
		});

		it('handles invalid JSON gracefully', async () => {
			await mockClient.set('invalid', 'not-valid-json{');
			const result = await cache.get('invalid');
			expect(result).toBeNull();
		});
	});

	describe('delete', () => {
		it('deletes existing key', async () => {
			await cache.set('key', 'value');
			await cache.delete('key');
			const result = await cache.get('key');
			expect(result).toBeNull();
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
	});

	describe('expire', () => {
		it('sets TTL on existing key', async () => {
			await cache.set('key', 'value');
			await cache.expire('key', 60);
			const ttl = await cache.ttl('key');
			expect(ttl).toBeGreaterThan(0);
		});
	});

	describe('ttl', () => {
		it('returns TTL for key with expiry', async () => {
			await cache.set('key', 'value', 60);
			const result = await cache.ttl('key');
			expect(result).toBeGreaterThan(0);
		});

		it('returns -1 for key without expiry', async () => {
			await cache.set('key', 'value');
			const result = await cache.ttl('key');
			expect(result).toBe(-1);
		});

		it('returns -2 for non-existent key', async () => {
			const result = await cache.ttl('nonexistent');
			expect(result).toBe(-2);
		});
	});

	describe('mget', () => {
		it('returns values for multiple keys', async () => {
			await cache.set('key1', 'value1');
			await cache.set('key2', 'value2');
			const results = await cache.mget<string>(['key1', 'key2']);
			expect(results).toEqual(['value1', 'value2']);
		});

		it('returns null for missing keys', async () => {
			await cache.set('key1', 'value1');
			const results = await cache.mget<string>(['key1', 'missing']);
			expect(results).toEqual(['value1', null]);
		});

		it('returns empty array for empty input', async () => {
			const results = await cache.mget([]);
			expect(results).toEqual([]);
		});
	});

	describe('mset', () => {
		it('sets multiple keys at once', async () => {
			await cache.mset([
				{key: 'key1', value: 'value1'},
				{key: 'key2', value: 'value2'},
			]);
			expect(await cache.get<string>('key1')).toBe('value1');
			expect(await cache.get<string>('key2')).toBe('value2');
		});

		it('handles empty array', async () => {
			await expect(cache.mset([])).resolves.toBeUndefined();
		});

		it('handles mixed TTL entries', async () => {
			await cache.mset([
				{key: 'withTtl', value: 'val1', ttlSeconds: 60},
				{key: 'noTtl', value: 'val2'},
			]);
			expect(await cache.get<string>('withTtl')).toBe('val1');
			expect(await cache.get<string>('noTtl')).toBe('val2');
		});
	});

	describe('deletePattern', () => {
		it('deletes keys matching pattern', async () => {
			await cache.set('user:1', 'user1');
			await cache.set('user:2', 'user2');
			await cache.set('session:1', 'session1');

			const count = await cache.deletePattern('user:*');
			expect(count).toBe(2);
		});

		it('returns 0 for no matches', async () => {
			const count = await cache.deletePattern('nonexistent:*');
			expect(count).toBe(0);
		});
	});

	describe('acquireLock', () => {
		it('acquires lock successfully', async () => {
			const token = await cache.acquireLock('resource', 60);
			expect(token).not.toBeNull();
			expect(token).toMatch(/^[a-f0-9]{32}$/);
		});

		it('throws on invalid key format', async () => {
			await expect(cache.acquireLock('invalid key!', 60)).rejects.toThrow('Invalid lock key format');
		});
	});

	describe('releaseLock', () => {
		it('releases lock', async () => {
			const token = await cache.acquireLock('resource', 60);
			const released = await cache.releaseLock('resource', token!);
			expect(released).toBe(true);
		});

		it('throws on invalid key format', async () => {
			await expect(cache.releaseLock('invalid key!', 'token')).rejects.toThrow('Invalid lock key format');
		});

		it('throws on invalid token format', async () => {
			await expect(cache.releaseLock('validkey', 'INVALID!')).rejects.toThrow('Invalid lock token format');
		});
	});

	describe('getAndRenewTtl', () => {
		it('returns value and renews TTL', async () => {
			await cache.set('key', 'value', 10);
			const result = await cache.getAndRenewTtl<string>('key', 60);
			expect(result).toBe('value');
		});

		it('returns null for non-existent key', async () => {
			const result = await cache.getAndRenewTtl('nonexistent', 60);
			expect(result).toBeNull();
		});
	});

	describe('publish', () => {
		it('publishes message to channel', async () => {
			await expect(cache.publish('channel', 'message')).resolves.toBeUndefined();
		});
	});

	describe('Set operations', () => {
		describe('sadd', () => {
			it('adds member to set', async () => {
				await cache.sadd('myset', 'member1', 60);
				const members = await cache.smembers('myset');
				expect(members.has('member1')).toBe(true);
			});
		});

		describe('srem', () => {
			it('removes member from set', async () => {
				await mockClient.sadd('myset', 'member1');
				await cache.srem('myset', 'member1');
				const isMember = await cache.sismember('myset', 'member1');
				expect(isMember).toBe(false);
			});
		});

		describe('smembers', () => {
			it('returns all members of set', async () => {
				await mockClient.sadd('myset', 'member1', 'member2');
				const members = await cache.smembers('myset');
				expect(members.size).toBe(2);
				expect(members.has('member1')).toBe(true);
				expect(members.has('member2')).toBe(true);
			});

			it('returns empty set for non-existent key', async () => {
				const members = await cache.smembers('nonexistent');
				expect(members.size).toBe(0);
			});
		});

		describe('sismember', () => {
			it('returns true for existing member', async () => {
				await mockClient.sadd('myset', 'member1');
				const result = await cache.sismember('myset', 'member1');
				expect(result).toBe(true);
			});

			it('returns false for non-existing member', async () => {
				await mockClient.sadd('myset', 'member1');
				const result = await cache.sismember('myset', 'member2');
				expect(result).toBe(false);
			});
		});
	});

	describe('telemetry', () => {
		it('records metrics on get operations', async () => {
			const telemetry = {
				recordCounter: vi.fn(),
				recordHistogram: vi.fn(),
			};

			const telemetryCache = new KVCacheProvider({
				client: mockClient,
				cacheName: 'test',
				telemetry,
			});

			await telemetryCache.get('key');

			expect(telemetry.recordCounter).toHaveBeenCalledWith({
				name: 'cache.operation',
				dimensions: expect.objectContaining({
					operation: 'get',
					cache_name: 'test',
				}),
			});
			expect(telemetry.recordHistogram).toHaveBeenCalledWith({
				name: 'cache.operation_latency',
				valueMs: expect.any(Number),
				dimensions: expect.objectContaining({
					operation: 'get',
				}),
			});
		});

		it('records metrics on set operations', async () => {
			const telemetry = {
				recordCounter: vi.fn(),
				recordHistogram: vi.fn(),
			};

			const telemetryCache = new KVCacheProvider({
				client: mockClient,
				cacheName: 'test',
				telemetry,
			});

			await telemetryCache.set('key', 'value');

			expect(telemetry.recordCounter).toHaveBeenCalledWith({
				name: 'cache.operation',
				dimensions: expect.objectContaining({
					operation: 'set',
					status: 'success',
				}),
			});
		});

		it('records error metrics on failure', async () => {
			const telemetry = {
				recordCounter: vi.fn(),
				recordHistogram: vi.fn(),
			};

			const failingClient = {
				...mockClient,
				get: vi.fn().mockRejectedValue(new Error('connection error')),
			} as unknown as IKVProvider;

			const telemetryCache = new KVCacheProvider({
				client: failingClient,
				cacheName: 'test',
				telemetry,
			});

			await expect(telemetryCache.get('key')).rejects.toThrow('connection error');

			expect(telemetry.recordCounter).toHaveBeenCalledWith({
				name: 'cache.operation',
				dimensions: expect.objectContaining({
					operation: 'get',
					status: 'error',
				}),
			});
		});
	});

	describe('key type detection', () => {
		it('identifies lock keys', async () => {
			const telemetry = {
				recordCounter: vi.fn(),
				recordHistogram: vi.fn(),
			};

			const telemetryCache = new KVCacheProvider({
				client: mockClient,
				cacheName: 'test',
				telemetry,
			});

			await telemetryCache.get('lock:mylock');

			expect(telemetry.recordCounter).toHaveBeenCalledWith({
				name: 'cache.operation',
				dimensions: expect.objectContaining({
					key_type: 'lock',
				}),
			});
		});

		it('identifies session keys', async () => {
			const telemetry = {
				recordCounter: vi.fn(),
				recordHistogram: vi.fn(),
			};

			const telemetryCache = new KVCacheProvider({
				client: mockClient,
				cacheName: 'test',
				telemetry,
			});

			await telemetryCache.get('user:123:session:abc');

			expect(telemetry.recordCounter).toHaveBeenCalledWith({
				name: 'cache.operation',
				dimensions: expect.objectContaining({
					key_type: 'session',
				}),
			});
		});

		it('identifies user keys', async () => {
			const telemetry = {
				recordCounter: vi.fn(),
				recordHistogram: vi.fn(),
			};

			const telemetryCache = new KVCacheProvider({
				client: mockClient,
				cacheName: 'test',
				telemetry,
			});

			await telemetryCache.get('prefix:user:123');

			expect(telemetry.recordCounter).toHaveBeenCalledWith({
				name: 'cache.operation',
				dimensions: expect.objectContaining({
					key_type: 'user',
				}),
			});
		});

		it('defaults to other for unknown key types', async () => {
			const telemetry = {
				recordCounter: vi.fn(),
				recordHistogram: vi.fn(),
			};

			const telemetryCache = new KVCacheProvider({
				client: mockClient,
				cacheName: 'test',
				telemetry,
			});

			await telemetryCache.get('random:key');

			expect(telemetry.recordCounter).toHaveBeenCalledWith({
				name: 'cache.operation',
				dimensions: expect.objectContaining({
					key_type: 'other',
				}),
			});
		});
	});

	describe('logger', () => {
		it('logs JSON parse errors', async () => {
			const logger = {
				error: vi.fn(),
			};

			const loggingCache = new KVCacheProvider({
				client: mockClient,
				cacheName: 'test',
				logger,
			});

			await mockClient.set('invalid', 'not-valid-json{');
			await loggingCache.get('invalid');

			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					value: 'not-valid-json{',
				}),
				expect.stringContaining('JSON parse error'),
			);
		});

		it('truncates long values in error logs', async () => {
			const logger = {
				error: vi.fn(),
			};

			const loggingCache = new KVCacheProvider({
				client: mockClient,
				cacheName: 'test',
				logger,
			});

			const longInvalidValue = 'x'.repeat(300);
			await mockClient.set('invalid', longInvalidValue);
			await loggingCache.get('invalid');

			expect(logger.error).toHaveBeenCalledWith(
				expect.objectContaining({
					value: expect.stringMatching(/^x{200}\.\.\.$/),
				}),
				expect.any(String),
			);
		});
	});

	describe('default config', () => {
		it('uses default cache name when not provided', async () => {
			const telemetry = {
				recordCounter: vi.fn(),
				recordHistogram: vi.fn(),
			};

			const defaultCache = new KVCacheProvider({
				client: mockClient,
				telemetry,
			});

			await defaultCache.get('key');

			expect(telemetry.recordCounter).toHaveBeenCalledWith({
				name: 'cache.operation',
				dimensions: expect.objectContaining({
					cache_name: 'kv',
				}),
			});
		});
	});
});
