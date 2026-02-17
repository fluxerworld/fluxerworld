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

import {formatLockKey, generateLockToken, validateLockKey} from '@fluxer/cache/src/CacheLockValidation';
import {safeJsonParse, serializeValue} from '@fluxer/cache/src/CacheSerialization';
import {ICacheService} from '@fluxer/cache/src/ICacheService';
import type {RedisClient} from '@fluxer/cache/src/RedisClientTypes';

export interface RedisCacheProviderConfig {
	client: RedisClient;
	cacheName?: string;
}

export class RedisCacheProvider extends ICacheService {
	private client: RedisClient;

	constructor(config: RedisCacheProviderConfig) {
		super();
		this.client = config.client;
	}

	async get<T>(key: string): Promise<T | null> {
		const value = await this.client.get(key);
		if (value == null) return null;
		return safeJsonParse<T>(value);
	}

	async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
		const serialized = serializeValue(value);
		if (ttlSeconds) {
			await this.client.setex(key, ttlSeconds, serialized);
		} else {
			await this.client.set(key, serialized);
		}
	}

	async delete(key: string): Promise<void> {
		await this.client.del(key);
	}

	async getAndDelete<T>(key: string): Promise<T | null> {
		const value = await this.client.getdel(key);
		if (value == null) {
			return null;
		}
		return safeJsonParse<T>(value);
	}

	async exists(key: string): Promise<boolean> {
		const result = await this.client.exists(key);
		return result === 1;
	}

	async expire(key: string, ttlSeconds: number): Promise<void> {
		await this.client.expire(key, ttlSeconds);
	}

	async ttl(key: string): Promise<number> {
		return await this.client.ttl(key);
	}

	async mget<T>(keys: Array<string>): Promise<Array<T | null>> {
		if (keys.length === 0) return [];

		const values = await this.client.mget(...keys);
		return values.map((value) => {
			if (value == null) return null;
			return safeJsonParse<T>(value);
		});
	}

	async mset<T>(entries: Array<{key: string; value: T; ttlSeconds?: number}>): Promise<void> {
		if (entries.length === 0) return;

		const withoutTtl: Array<{key: string; value: T}> = [];
		const withTtl: Array<{key: string; value: T; ttlSeconds: number}> = [];

		for (const entry of entries) {
			if (entry.ttlSeconds) {
				withTtl.push({
					key: entry.key,
					value: entry.value,
					ttlSeconds: entry.ttlSeconds,
				});
			} else {
				withoutTtl.push({
					key: entry.key,
					value: entry.value,
				});
			}
		}

		const pipeline = this.client.pipeline();

		if (withoutTtl.length > 0) {
			const flatArgs: Array<string> = [];
			for (const entry of withoutTtl) {
				flatArgs.push(entry.key, serializeValue(entry.value));
			}
			pipeline.mset(...flatArgs);
		}

		for (const entry of withTtl) {
			pipeline.setex(entry.key, entry.ttlSeconds, serializeValue(entry.value));
		}

		await pipeline.exec();
	}

	async deletePattern(pattern: string): Promise<number> {
		const keys = await this.client.scan(pattern, 1000);
		if (keys.length === 0) return 0;
		return await this.client.del(...keys);
	}

	async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
		validateLockKey(key);
		const token = generateLockToken();
		const lockKey = formatLockKey(key);

		await this.client.set(lockKey, token);
		await this.client.expire(lockKey, ttlSeconds);
		return token;
	}

	async releaseLock(_key: string, _token: string): Promise<boolean> {
		throw new Error('releaseLock not implemented for RedisCacheProvider');
	}

	async getAndRenewTtl<T>(key: string, newTtlSeconds: number): Promise<T | null> {
		const value = await this.client.getex(key, newTtlSeconds);
		if (value == null) return null;
		return safeJsonParse<T>(value);
	}

	async publish(channel: string, message: string): Promise<void> {
		await this.client.publish(channel, message);
	}

	async sadd(key: string, member: string, ttlSeconds?: number): Promise<void> {
		const pipeline = this.client.pipeline();
		pipeline.sadd(key, member);
		if (ttlSeconds) {
			pipeline.expire(key, ttlSeconds);
		}
		await pipeline.exec();
	}

	async srem(key: string, member: string): Promise<void> {
		await this.client.srem(key, member);
	}

	async smembers(key: string): Promise<Set<string>> {
		const members = await this.client.smembers(key);
		return new Set(members);
	}

	async sismember(key: string, member: string): Promise<boolean> {
		const result = await this.client.sismember(key, member);
		return result === 1;
	}
}
