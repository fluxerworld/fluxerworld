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

import type {IKVPipeline, IKVProvider, IKVSubscription} from '@fluxer/kv_client/src/IKVProvider';
import {vi} from 'vitest';

type MessageCallback = (channel: string, message: string) => void;
type ErrorCallback = (error: Error) => void;

export interface MockKVSubscriptionOptions {
	shouldFailConnect?: boolean;
	shouldFailSubscribe?: boolean;
}

export class MockKVSubscription implements IKVSubscription {
	private messageCallbacks: Array<MessageCallback> = [];
	private errorCallbacks: Array<ErrorCallback> = [];
	private options: MockKVSubscriptionOptions;

	connectCalled = false;
	subscribedChannels: Array<string> = [];
	quitCalled = false;
	removeAllListenersCalled = false;

	constructor(options: MockKVSubscriptionOptions = {}) {
		this.options = options;
	}

	async connect(): Promise<void> {
		if (this.options.shouldFailConnect) {
			throw new Error('Mock connection failure');
		}
		this.connectCalled = true;
	}

	on(event: 'message', callback: MessageCallback): void;
	on(event: 'error', callback: ErrorCallback): void;
	on(event: 'message' | 'error', callback: MessageCallback | ErrorCallback): void {
		if (event === 'message') {
			this.messageCallbacks.push(callback as MessageCallback);
		} else if (event === 'error') {
			this.errorCallbacks.push(callback as ErrorCallback);
		}
	}

	async subscribe(...channels: Array<string>): Promise<void> {
		if (this.options.shouldFailSubscribe) {
			throw new Error('Mock subscribe failure');
		}
		this.subscribedChannels.push(...channels);
	}

	async unsubscribe(..._channels: Array<string>): Promise<void> {}

	async quit(): Promise<void> {
		this.quitCalled = true;
	}

	async disconnect(): Promise<void> {
		this.quitCalled = true;
	}

	removeAllListeners(event?: 'message' | 'error'): void {
		this.removeAllListenersCalled = true;
		if (event === 'message') {
			this.messageCallbacks = [];
		} else if (event === 'error') {
			this.errorCallbacks = [];
		} else {
			this.messageCallbacks = [];
			this.errorCallbacks = [];
		}
	}

	simulateMessage(channel: string, message: string): void {
		for (const callback of this.messageCallbacks) {
			callback(channel, message);
		}
	}

	simulateError(error: Error): void {
		for (const callback of this.errorCallbacks) {
			callback(error);
		}
	}

	reset(): void {
		this.messageCallbacks = [];
		this.errorCallbacks = [];
		this.connectCalled = false;
		this.subscribedChannels = [];
		this.quitCalled = false;
		this.removeAllListenersCalled = false;
	}
}

export interface MockKVProviderOptions {
	subscriptionOptions?: MockKVSubscriptionOptions;
}

export class MockKVProvider implements IKVProvider {
	rpushCalls: Array<{key: string; values: Array<string>}> = [];
	private subscription: MockKVSubscription;
	private readonly stringStore = new Map<string, string>();
	private readonly setStore = new Map<string, Set<string>>();
	private readonly zsetStore = new Map<string, Map<string, number>>();
	private readonly listStore = new Map<string, Array<string>>();
	private readonly hashStore = new Map<string, Map<string, string>>();
	private readonly expiries = new Map<string, number>();

	readonly getSpy = vi.fn();
	readonly setSpy = vi.fn();
	readonly setexSpy = vi.fn();
	readonly setnxSpy = vi.fn();
	readonly mgetSpy = vi.fn();
	readonly msetSpy = vi.fn();
	readonly delSpy = vi.fn();
	readonly existsSpy = vi.fn();
	readonly expireSpy = vi.fn();
	readonly ttlSpy = vi.fn();
	readonly incrSpy = vi.fn();
	readonly getexSpy = vi.fn();
	readonly getdelSpy = vi.fn();
	readonly saddSpy = vi.fn();
	readonly sremSpy = vi.fn();
	readonly smembersSpy = vi.fn();
	readonly sismemberSpy = vi.fn();
	readonly scardSpy = vi.fn();
	readonly spopSpy = vi.fn();
	readonly zaddSpy = vi.fn();
	readonly zremSpy = vi.fn();
	readonly zcardSpy = vi.fn();
	readonly zrangebyscoreSpy = vi.fn();
	readonly rpushSpy = vi.fn();
	readonly lpopSpy = vi.fn();
	readonly llenSpy = vi.fn();
	readonly hsetSpy = vi.fn();
	readonly hdelSpy = vi.fn();
	readonly hgetSpy = vi.fn();
	readonly hgetallSpy = vi.fn();
	readonly publishSpy = vi.fn();
	readonly releaseLockSpy = vi.fn();
	readonly renewSnowflakeNodeSpy = vi.fn();
	readonly tryConsumeTokensSpy = vi.fn();
	readonly scheduleBulkDeletionSpy = vi.fn();
	readonly removeBulkDeletionSpy = vi.fn();
	readonly scanSpy = vi.fn();
	readonly healthSpy = vi.fn();

	constructor(options: MockKVProviderOptions = {}) {
		this.subscription = new MockKVSubscription(options.subscriptionOptions);
	}

	async get(key: string): Promise<string | null> {
		this.getSpy(key);
		this.evictIfExpired(key);
		return this.stringStore.get(key) ?? null;
	}

	async set(key: string, value: string, ...args: Array<string | number>): Promise<string | null> {
		this.setSpy(key, value, ...args);
		const useNx = args.includes('NX');
		if (useNx && this.keyExists(key)) {
			return null;
		}

		this.ensureType(key, 'string');
		this.stringStore.set(key, value);
		this.setExpiryFromArgs(key, args);
		return 'OK';
	}

	async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
		this.setexSpy(key, ttlSeconds, value);
		this.ensureType(key, 'string');
		this.stringStore.set(key, value);
		this.expiries.set(key, Date.now() + ttlSeconds * 1000);
	}

	async setnx(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
		this.setnxSpy(key, value, ttlSeconds);
		if (this.keyExists(key)) {
			return false;
		}

		this.ensureType(key, 'string');
		this.stringStore.set(key, value);
		if (ttlSeconds !== undefined) {
			this.expiries.set(key, Date.now() + ttlSeconds * 1000);
		} else {
			this.expiries.delete(key);
		}
		return true;
	}

	async mget(...keys: Array<string>): Promise<Array<string | null>> {
		this.mgetSpy(...keys);
		return keys.map((key) => {
			this.evictIfExpired(key);
			return this.stringStore.get(key) ?? null;
		});
	}

	async mset(...args: Array<string>): Promise<void> {
		this.msetSpy(...args);
		for (let i = 0; i < args.length; i += 2) {
			const key = args[i];
			const value = args[i + 1];
			if (value === undefined) {
				continue;
			}
			this.ensureType(key, 'string');
			this.stringStore.set(key, value);
			this.expiries.delete(key);
		}
	}

	async del(...keys: Array<string>): Promise<number> {
		this.delSpy(...keys);
		let deleted = 0;
		for (const key of keys) {
			if (this.deleteKey(key)) {
				deleted++;
			}
		}
		return deleted;
	}

	async exists(key: string): Promise<number> {
		this.existsSpy(key);
		return this.keyExists(key) ? 1 : 0;
	}

	async expire(key: string, ttlSeconds: number): Promise<number> {
		this.expireSpy(key, ttlSeconds);
		if (!this.keyExists(key)) {
			return 0;
		}
		this.expiries.set(key, Date.now() + ttlSeconds * 1000);
		return 1;
	}

	async ttl(key: string): Promise<number> {
		this.ttlSpy(key);
		this.evictIfExpired(key);
		if (!this.keyExists(key)) {
			return -2;
		}

		const expiry = this.expiries.get(key);
		if (expiry === undefined) {
			return -1;
		}

		const remainingSeconds = Math.floor((expiry - Date.now()) / 1000);
		if (remainingSeconds < 0) {
			this.deleteKey(key);
			return -2;
		}
		return remainingSeconds;
	}

	async incr(key: string): Promise<number> {
		this.incrSpy(key);
		this.evictIfExpired(key);
		const value = Number.parseInt(this.stringStore.get(key) ?? '0', 10) + 1;
		this.ensureType(key, 'string');
		this.stringStore.set(key, String(value));
		return value;
	}

	async getex(key: string, ttlSeconds: number): Promise<string | null> {
		this.getexSpy(key, ttlSeconds);
		this.evictIfExpired(key);
		const value = this.stringStore.get(key) ?? null;
		if (value !== null) {
			this.expiries.set(key, Date.now() + ttlSeconds * 1000);
		}
		return value;
	}

	async getdel(key: string): Promise<string | null> {
		this.getdelSpy(key);
		this.evictIfExpired(key);
		const value = this.stringStore.get(key) ?? null;
		this.deleteKey(key);
		return value;
	}

	async sadd(key: string, ...members: Array<string>): Promise<number> {
		this.saddSpy(key, ...members);
		this.evictIfExpired(key);
		this.ensureType(key, 'set');
		const membersSet = this.setStore.get(key)!;
		let added = 0;
		for (const member of members) {
			if (!membersSet.has(member)) {
				membersSet.add(member);
				added++;
			}
		}
		return added;
	}

	async srem(key: string, ...members: Array<string>): Promise<number> {
		this.sremSpy(key, ...members);
		this.evictIfExpired(key);
		const membersSet = this.setStore.get(key);
		if (!membersSet) {
			return 0;
		}

		let removed = 0;
		for (const member of members) {
			if (membersSet.delete(member)) {
				removed++;
			}
		}
		return removed;
	}

	async smembers(key: string): Promise<Array<string>> {
		this.smembersSpy(key);
		this.evictIfExpired(key);
		const membersSet = this.setStore.get(key);
		return membersSet ? Array.from(membersSet) : [];
	}

	async sismember(key: string, member: string): Promise<number> {
		this.sismemberSpy(key, member);
		this.evictIfExpired(key);
		const membersSet = this.setStore.get(key);
		return membersSet?.has(member) ? 1 : 0;
	}

	async scard(key: string): Promise<number> {
		this.scardSpy(key);
		this.evictIfExpired(key);
		return this.setStore.get(key)?.size ?? 0;
	}

	async spop(key: string, count: number = 1): Promise<Array<string>> {
		this.spopSpy(key, count);
		this.evictIfExpired(key);
		const membersSet = this.setStore.get(key);
		if (!membersSet || count <= 0) {
			return [];
		}

		const popped: Array<string> = [];
		const iterator = membersSet.values();
		for (let i = 0; i < count; i++) {
			const next = iterator.next();
			if (next.done) {
				break;
			}
			membersSet.delete(next.value);
			popped.push(next.value);
		}
		return popped;
	}

	async zadd(key: string, ...scoreMembers: Array<number | string>): Promise<number> {
		this.zaddSpy(key, ...scoreMembers);
		this.evictIfExpired(key);
		this.ensureType(key, 'zset');
		const members = this.zsetStore.get(key)!;

		let added = 0;
		for (let i = 0; i < scoreMembers.length; i += 2) {
			const scoreInput = scoreMembers[i];
			const memberInput = scoreMembers[i + 1];
			if (memberInput === undefined) {
				continue;
			}
			const score = Number(scoreInput);
			const member = String(memberInput);
			if (!Number.isFinite(score)) {
				continue;
			}
			if (!members.has(member)) {
				added++;
			}
			members.set(member, score);
		}
		return added;
	}

	async zrem(key: string, ...members: Array<string>): Promise<number> {
		this.zremSpy(key, ...members);
		this.evictIfExpired(key);
		const zset = this.zsetStore.get(key);
		if (!zset) {
			return 0;
		}
		let removed = 0;
		for (const member of members) {
			if (zset.delete(member)) {
				removed++;
			}
		}
		return removed;
	}

	async zcard(key: string): Promise<number> {
		this.zcardSpy(key);
		this.evictIfExpired(key);
		return this.zsetStore.get(key)?.size ?? 0;
	}

	async zrangebyscore(
		key: string,
		min: string | number,
		max: string | number,
		...args: Array<string | number>
	): Promise<Array<string>> {
		this.zrangebyscoreSpy(key, min, max, ...args);
		this.evictIfExpired(key);
		const zset = this.zsetStore.get(key);
		if (!zset) {
			return [];
		}

		let offset = 0;
		let limit = Number.POSITIVE_INFINITY;
		for (let i = 0; i < args.length; i++) {
			if (args[i] === 'LIMIT') {
				const parsedOffset = Number(args[i + 1]);
				const parsedLimit = Number(args[i + 2]);
				if (Number.isFinite(parsedOffset) && Number.isFinite(parsedLimit)) {
					offset = parsedOffset;
					limit = parsedLimit;
				}
				break;
			}
		}

		const minBound = parseScoreBound(min, true);
		const maxBound = parseScoreBound(max, false);
		const sortedMembers = Array.from(zset.entries()).sort((a, b) => {
			if (a[1] === b[1]) {
				return a[0].localeCompare(b[0]);
			}
			return a[1] - b[1];
		});
		const filtered = sortedMembers
			.filter((entry) => isScoreInRange(entry[1], minBound, maxBound))
			.map((entry) => entry[0]);
		return filtered.slice(offset, offset + limit);
	}

	async rpush(key: string, ...values: Array<string>): Promise<number> {
		this.rpushSpy(key, ...values);
		this.rpushCalls.push({key, values});
		this.evictIfExpired(key);
		this.ensureType(key, 'list');
		const list = this.listStore.get(key)!;
		list.push(...values);
		return list.length;
	}

	async lpop(key: string, count: number = 1): Promise<Array<string>> {
		this.lpopSpy(key, count);
		this.evictIfExpired(key);
		const list = this.listStore.get(key);
		if (!list || count <= 0) {
			return [];
		}

		const popped = list.splice(0, count);
		if (list.length === 0) {
			this.listStore.delete(key);
		}
		return popped;
	}

	async llen(key: string): Promise<number> {
		this.llenSpy(key);
		this.evictIfExpired(key);
		return this.listStore.get(key)?.length ?? 0;
	}

	async hset(key: string, field: string, value: string): Promise<number> {
		this.hsetSpy(key, field, value);
		this.evictIfExpired(key);
		this.ensureType(key, 'hash');
		const hash = this.hashStore.get(key)!;
		const isNew = !hash.has(field);
		hash.set(field, value);
		return isNew ? 1 : 0;
	}

	async hdel(key: string, ...fields: Array<string>): Promise<number> {
		this.hdelSpy(key, ...fields);
		this.evictIfExpired(key);
		const hash = this.hashStore.get(key);
		if (!hash) {
			return 0;
		}
		let removed = 0;
		for (const field of fields) {
			if (hash.delete(field)) {
				removed++;
			}
		}
		return removed;
	}

	async hget(key: string, field: string): Promise<string | null> {
		this.hgetSpy(key, field);
		this.evictIfExpired(key);
		return this.hashStore.get(key)?.get(field) ?? null;
	}

	async hgetall(key: string): Promise<Record<string, string>> {
		this.hgetallSpy(key);
		this.evictIfExpired(key);
		const hash = this.hashStore.get(key);
		if (!hash) {
			return {};
		}
		return Object.fromEntries(hash.entries());
	}

	async publish(channel: string, message: string): Promise<number> {
		this.publishSpy(channel, message);
		this.subscription.simulateMessage(channel, message);
		return 1;
	}

	duplicate(): IKVSubscription {
		return this.subscription;
	}

	async releaseLock(key: string, token: string): Promise<boolean> {
		this.releaseLockSpy(key, token);
		this.evictIfExpired(key);
		const currentToken = this.stringStore.get(key);
		if (currentToken !== token) {
			return false;
		}
		this.deleteKey(key);
		return true;
	}

	async renewSnowflakeNode(key: string, instanceId: string, ttlSeconds: number): Promise<boolean> {
		this.renewSnowflakeNodeSpy(key, instanceId, ttlSeconds);
		this.evictIfExpired(key);
		const currentValue = this.stringStore.get(key);
		if (currentValue !== instanceId) {
			return false;
		}
		this.expiries.set(key, Date.now() + ttlSeconds * 1000);
		return true;
	}

	async tryConsumeTokens(
		key: string,
		requested: number,
		maxTokens: number,
		refillRate: number,
		refillIntervalMs: number,
	): Promise<number> {
		this.tryConsumeTokensSpy(key, requested, maxTokens, refillRate, refillIntervalMs);
		this.evictIfExpired(key);

		const now = Date.now();
		let tokens = maxTokens;
		let lastRefill = now;

		const rawState = this.stringStore.get(key);
		if (rawState !== undefined) {
			try {
				const parsed = JSON.parse(rawState) as {tokens?: number; lastRefill?: number};
				tokens = parsed.tokens ?? maxTokens;
				lastRefill = parsed.lastRefill ?? now;
			} catch {}
		}

		const elapsed = now - lastRefill;
		if (elapsed >= refillIntervalMs) {
			const intervals = Math.floor(elapsed / refillIntervalMs);
			const refilled = intervals * refillRate;
			tokens = Math.min(maxTokens, tokens + refilled);
			lastRefill = now;
		}

		let consumed = 0;
		if (tokens >= requested) {
			consumed = requested;
			tokens -= requested;
		} else if (tokens > 0) {
			consumed = tokens;
			tokens = 0;
		}

		this.ensureType(key, 'string');
		this.stringStore.set(key, JSON.stringify({tokens, lastRefill}));
		this.expiries.set(key, now + 3600 * 1000);
		return consumed;
	}

	async scheduleBulkDeletion(queueKey: string, secondaryKey: string, score: number, value: string): Promise<void> {
		this.scheduleBulkDeletionSpy(queueKey, secondaryKey, score, value);
		await this.zadd(queueKey, score, value);
		this.ensureType(secondaryKey, 'string');
		this.stringStore.set(secondaryKey, value);
		this.expiries.delete(secondaryKey);
	}

	async removeBulkDeletion(queueKey: string, secondaryKey: string): Promise<boolean> {
		this.removeBulkDeletionSpy(queueKey, secondaryKey);
		this.evictIfExpired(secondaryKey);
		const value = this.stringStore.get(secondaryKey);
		if (value === undefined) {
			return false;
		}

		await this.zrem(queueKey, value);
		this.deleteKey(secondaryKey);
		return true;
	}

	async scan(pattern: string, count: number): Promise<Array<string>> {
		const result = await this.scanSpy(pattern, count);
		if (result !== undefined) {
			return result;
		}

		const keys = this.getAllKeys().filter((key) => this.matchesPattern(key, pattern));
		return keys.slice(0, count);
	}

	pipeline(): IKVPipeline {
		return this.createPipeline();
	}

	multi(): IKVPipeline {
		return this.createPipeline();
	}

	async health(): Promise<boolean> {
		this.healthSpy();
		return true;
	}

	getSubscription(): MockKVSubscription {
		return this.subscription;
	}

	setSubscription(subscription: MockKVSubscription): void {
		this.subscription = subscription;
	}

	private createPipeline(): IKVPipeline {
		const operations: Array<() => Promise<unknown>> = [];
		const pipeline: IKVPipeline = {
			get: (key: string) => {
				operations.push(async () => await this.get(key));
				return pipeline;
			},
			set: (key: string, value: string) => {
				operations.push(async () => await this.set(key, value));
				return pipeline;
			},
			setex: (key: string, ttlSeconds: number, value: string) => {
				operations.push(async () => await this.setex(key, ttlSeconds, value));
				return pipeline;
			},
			del: (key: string) => {
				operations.push(async () => await this.del(key));
				return pipeline;
			},
			expire: (key: string, ttlSeconds: number) => {
				operations.push(async () => await this.expire(key, ttlSeconds));
				return pipeline;
			},
			sadd: (key: string, ...members: Array<string>) => {
				operations.push(async () => await this.sadd(key, ...members));
				return pipeline;
			},
			srem: (key: string, ...members: Array<string>) => {
				operations.push(async () => await this.srem(key, ...members));
				return pipeline;
			},
			zadd: (key: string, score: number, value: string) => {
				operations.push(async () => await this.zadd(key, score, value));
				return pipeline;
			},
			zrem: (key: string, ...members: Array<string>) => {
				operations.push(async () => await this.zrem(key, ...members));
				return pipeline;
			},
			mset: (...args: Array<string>) => {
				operations.push(async () => await this.mset(...args));
				return pipeline;
			},
			exec: async () => {
				const results: Array<[Error | null, unknown]> = [];
				for (const operation of operations) {
					try {
						const value = await operation();
						results.push([null, value]);
					} catch (error) {
						results.push([error as Error, null]);
					}
				}
				return results;
			},
		};
		return pipeline;
	}

	private keyExists(key: string): boolean {
		this.evictIfExpired(key);
		return (
			this.stringStore.has(key) ||
			this.setStore.has(key) ||
			this.zsetStore.has(key) ||
			this.listStore.has(key) ||
			this.hashStore.has(key)
		);
	}

	private evictIfExpired(key: string): void {
		const expiry = this.expiries.get(key);
		if (expiry === undefined) {
			return;
		}
		if (expiry <= Date.now()) {
			this.deleteKey(key);
		}
	}

	private ensureType(key: string, type: 'string' | 'set' | 'zset' | 'list' | 'hash'): void {
		this.evictIfExpired(key);
		if (type !== 'string') {
			this.stringStore.delete(key);
		}
		if (type !== 'set') {
			this.setStore.delete(key);
		}
		if (type !== 'zset') {
			this.zsetStore.delete(key);
		}
		if (type !== 'list') {
			this.listStore.delete(key);
		}
		if (type !== 'hash') {
			this.hashStore.delete(key);
		}

		if (type === 'set' && !this.setStore.has(key)) {
			this.setStore.set(key, new Set());
		}
		if (type === 'zset' && !this.zsetStore.has(key)) {
			this.zsetStore.set(key, new Map());
		}
		if (type === 'list' && !this.listStore.has(key)) {
			this.listStore.set(key, []);
		}
		if (type === 'hash' && !this.hashStore.has(key)) {
			this.hashStore.set(key, new Map());
		}
	}

	private deleteKey(key: string): boolean {
		let deleted = false;
		if (this.stringStore.delete(key)) {
			deleted = true;
		}
		if (this.setStore.delete(key)) {
			deleted = true;
		}
		if (this.zsetStore.delete(key)) {
			deleted = true;
		}
		if (this.listStore.delete(key)) {
			deleted = true;
		}
		if (this.hashStore.delete(key)) {
			deleted = true;
		}
		if (this.expiries.delete(key)) {
			deleted = true;
		}
		return deleted;
	}

	private setExpiryFromArgs(key: string, args: Array<string | number>): void {
		const exIndex = args.indexOf('EX');
		if (exIndex !== -1 && typeof args[exIndex + 1] === 'number') {
			const ttlSeconds = args[exIndex + 1] as number;
			this.expiries.set(key, Date.now() + ttlSeconds * 1000);
			return;
		}
		this.expiries.delete(key);
	}

	private getAllKeys(): Array<string> {
		for (const key of this.expiries.keys()) {
			this.evictIfExpired(key);
		}
		const keys = new Set<string>();
		for (const key of this.stringStore.keys()) keys.add(key);
		for (const key of this.setStore.keys()) keys.add(key);
		for (const key of this.zsetStore.keys()) keys.add(key);
		for (const key of this.listStore.keys()) keys.add(key);
		for (const key of this.hashStore.keys()) keys.add(key);
		return Array.from(keys);
	}

	private matchesPattern(value: string, pattern: string): boolean {
		if (pattern === '*') {
			return true;
		}
		const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`^${escaped.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
		return regex.test(value);
	}

	reset(): void {
		this.rpushCalls = [];
		this.stringStore.clear();
		this.setStore.clear();
		this.zsetStore.clear();
		this.listStore.clear();
		this.hashStore.clear();
		this.expiries.clear();
		this.subscription.reset();
		this.getSpy.mockClear();
		this.setSpy.mockClear();
		this.setexSpy.mockClear();
		this.setnxSpy.mockClear();
		this.mgetSpy.mockClear();
		this.msetSpy.mockClear();
		this.delSpy.mockClear();
		this.existsSpy.mockClear();
		this.expireSpy.mockClear();
		this.ttlSpy.mockClear();
		this.incrSpy.mockClear();
		this.getexSpy.mockClear();
		this.getdelSpy.mockClear();
		this.saddSpy.mockClear();
		this.sremSpy.mockClear();
		this.smembersSpy.mockClear();
		this.sismemberSpy.mockClear();
		this.scardSpy.mockClear();
		this.spopSpy.mockClear();
		this.zaddSpy.mockClear();
		this.zremSpy.mockClear();
		this.zcardSpy.mockClear();
		this.zrangebyscoreSpy.mockClear();
		this.rpushSpy.mockClear();
		this.lpopSpy.mockClear();
		this.llenSpy.mockClear();
		this.hsetSpy.mockClear();
		this.hdelSpy.mockClear();
		this.hgetSpy.mockClear();
		this.hgetallSpy.mockClear();
		this.publishSpy.mockClear();
		this.releaseLockSpy.mockClear();
		this.renewSnowflakeNodeSpy.mockClear();
		this.tryConsumeTokensSpy.mockClear();
		this.scheduleBulkDeletionSpy.mockClear();
		this.removeBulkDeletionSpy.mockClear();
		this.scanSpy.mockClear();
		this.healthSpy.mockClear();
	}
}

interface ScoreBound {
	value: number;
	exclusive: boolean;
}

function parseScoreBound(bound: string | number, isMin: boolean): ScoreBound {
	if (typeof bound === 'number') {
		return {value: bound, exclusive: false};
	}

	if (bound === '-inf') {
		return {value: Number.NEGATIVE_INFINITY, exclusive: false};
	}
	if (bound === '+inf') {
		return {value: Number.POSITIVE_INFINITY, exclusive: false};
	}
	if (bound.startsWith('(')) {
		const value = Number(bound.slice(1));
		return {
			value: Number.isFinite(value) ? value : isMin ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
			exclusive: true,
		};
	}
	const value = Number(bound);
	return {
		value: Number.isFinite(value) ? value : isMin ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
		exclusive: false,
	};
}

function isScoreInRange(score: number, min: ScoreBound, max: ScoreBound): boolean {
	const minOk = min.exclusive ? score > min.value : score >= min.value;
	const maxOk = max.exclusive ? score < max.value : score <= max.value;
	return minOk && maxOk;
}
