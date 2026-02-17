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

export interface RedisClient {
	get(key: string): Promise<string | null>;
	set(key: string, value: string): Promise<void>;
	setex(key: string, ttlSeconds: number, value: string): Promise<void>;
	del(...keys: Array<string>): Promise<number>;
	getdel(key: string): Promise<string | null>;
	exists(key: string): Promise<number>;
	expire(key: string, ttlSeconds: number): Promise<number>;
	ttl(key: string): Promise<number>;
	mget(...keys: Array<string>): Promise<Array<string | null>>;
	mset(...args: Array<string>): Promise<void>;
	scan(pattern: string, count: number): Promise<Array<string>>;
	publish(channel: string, message: string): Promise<number>;
	sadd(key: string, ...members: Array<string>): Promise<number>;
	srem(key: string, ...members: Array<string>): Promise<number>;
	smembers(key: string): Promise<Array<string>>;
	sismember(key: string, member: string): Promise<number>;
	getex(key: string, ttlSeconds: number): Promise<string | null>;
	pipeline(): RedisPipeline;
}

export interface RedisPipeline {
	setex(key: string, ttlSeconds: number, value: string): RedisPipeline;
	mset(...args: Array<string>): RedisPipeline;
	sadd(key: string, ...members: Array<string>): RedisPipeline;
	expire(key: string, ttlSeconds: number): RedisPipeline;
	exec(): Promise<unknown>;
}
