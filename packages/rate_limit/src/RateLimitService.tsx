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

import type {ICacheService} from '@fluxer/rate_limit/src/ICacheService';
import {InMemoryCacheService} from '@fluxer/rate_limit/src/InMemoryCacheService';
import type {
	BucketConfig,
	IRateLimitService,
	RateLimitConfig,
	RateLimitResult,
} from '@fluxer/rate_limit/src/IRateLimitService';
import {GcraRateLimiter} from '@fluxer/rate_limit/src/internal/GcraRateLimiter';
import {RateLimitKeyFactory} from '@fluxer/rate_limit/src/internal/RateLimitKeyFactory';
import {assertPositiveFiniteNumber} from '@fluxer/rate_limit/src/internal/RateLimitValidation';

export interface RateLimitServiceOptions {
	globalWindowMs?: number;
	getCurrentTimeMs?: () => number;
}

export class RateLimitService implements IRateLimitService {
	private static readonly DEFAULT_GLOBAL_WINDOW_MS = 1000;
	private readonly gcraRateLimiter: GcraRateLimiter;
	private readonly keyFactory: RateLimitKeyFactory;
	private readonly globalWindowMs: number;

	constructor(cacheService: ICacheService, options: RateLimitServiceOptions = {}) {
		this.gcraRateLimiter = new GcraRateLimiter(cacheService, options.getCurrentTimeMs);
		this.keyFactory = new RateLimitKeyFactory();
		this.globalWindowMs = options.globalWindowMs ?? RateLimitService.DEFAULT_GLOBAL_WINDOW_MS;
		assertPositiveFiniteNumber(this.globalWindowMs, 'globalWindowMs');
	}

	async checkLimit(config: RateLimitConfig): Promise<RateLimitResult> {
		const key = this.keyFactory.getIdentifierKey(config.identifier);
		return this.gcraRateLimiter.checkLimit(key, {
			limit: config.maxAttempts,
			windowMs: config.windowMs,
		});
	}

	async checkBucketLimit(bucket: string, config: BucketConfig): Promise<RateLimitResult> {
		const key = this.keyFactory.getBucketKey(bucket);
		return this.gcraRateLimiter.checkLimit(key, {
			limit: config.limit,
			windowMs: config.windowMs,
		});
	}

	async checkGlobalLimit(identifier: string, limit: number): Promise<RateLimitResult> {
		const key = this.keyFactory.getGlobalKey(identifier);
		return this.gcraRateLimiter.checkLimit(
			key,
			{
				limit,
				windowMs: this.globalWindowMs,
			},
			{global: true},
		);
	}

	async resetLimit(identifier: string): Promise<void> {
		const key = this.keyFactory.getIdentifierKey(identifier);
		await this.gcraRateLimiter.resetLimit(key);
	}

	async getRemainingAttempts(identifier: string, _windowMs: number): Promise<number> {
		const key = this.keyFactory.getIdentifierKey(identifier);
		return this.gcraRateLimiter.getRemainingAttempts(key);
	}

	async getResetTime(identifier: string, _windowMs: number): Promise<Date> {
		const key = this.keyFactory.getIdentifierKey(identifier);
		return this.gcraRateLimiter.getResetTime(key);
	}
}

export function createRateLimitService(
	cacheService: ICacheService | null,
	options: RateLimitServiceOptions = {},
): RateLimitService | null {
	if (!cacheService) {
		return null;
	}
	return new RateLimitService(cacheService, options);
}

export function createInMemoryRateLimitService(
	enabled: boolean,
	options: RateLimitServiceOptions = {},
): RateLimitService | null {
	if (!enabled) {
		return null;
	}

	const cacheService = new InMemoryCacheService();
	return createRateLimitService(cacheService, options);
}
