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
import type {RateLimitResult} from '@fluxer/rate_limit/src/IRateLimitService';
import {
	parseRateLimitCacheState,
	type RateLimitCacheState,
	serializeRateLimitCacheState,
} from '@fluxer/rate_limit/src/internal/RateLimitCacheState';
import {assertPositiveFiniteNumber} from '@fluxer/rate_limit/src/internal/RateLimitValidation';

export interface GcraRule {
	limit: number;
	windowMs: number;
}

interface GcraCheckOptions {
	global?: boolean;
}

export class GcraRateLimiter {
	private static readonly MIN_RETRY_AFTER_SECONDS = 1;
	private static readonly MIN_RETRY_AFTER_DECIMAL_SECONDS = 0.001;

	constructor(
		private readonly cacheService: ICacheService,
		private readonly getCurrentTimeMs: () => number = () => Date.now(),
	) {}

	private async getCacheState(key: string): Promise<RateLimitCacheState | null> {
		const rawState = await this.cacheService.get<unknown>(key);
		return parseRateLimitCacheState(rawState);
	}

	private static calculateEmissionIntervalMs(rule: GcraRule): number {
		return rule.windowMs / rule.limit;
	}

	private static calculateRemaining(
		limit: number,
		emissionIntervalMs: number,
		nextTatMs: number,
		nowMs: number,
	): number {
		const debtMs = Math.max(0, nextTatMs - nowMs);
		const usedCapacity = debtMs / emissionIntervalMs;
		return Math.max(0, Math.floor(limit - usedCapacity));
	}

	private static createAllowedResult(
		limit: number,
		remaining: number,
		resetTimeMs: number,
		global: boolean | undefined,
	): RateLimitResult {
		return {
			allowed: true,
			limit,
			remaining,
			resetTime: new Date(resetTimeMs),
			...(global !== undefined && {global}),
		};
	}

	private static createBlockedResult(
		limit: number,
		resetTimeMs: number,
		retryAfterMs: number,
		global: boolean | undefined,
	): RateLimitResult {
		const retryAfter = Math.max(GcraRateLimiter.MIN_RETRY_AFTER_SECONDS, Math.ceil(retryAfterMs / 1000));
		const retryAfterDecimal = Math.max(GcraRateLimiter.MIN_RETRY_AFTER_DECIMAL_SECONDS, retryAfterMs / 1000);

		return {
			allowed: false,
			limit,
			remaining: 0,
			resetTime: new Date(resetTimeMs),
			retryAfter,
			retryAfterDecimal,
			...(global !== undefined && {global}),
		};
	}

	async checkLimit(key: string, rule: GcraRule, options: GcraCheckOptions = {}): Promise<RateLimitResult> {
		assertPositiveFiniteNumber(rule.limit, 'rule.limit');
		assertPositiveFiniteNumber(rule.windowMs, 'rule.windowMs');

		const nowMs = this.getCurrentTimeMs();
		const emissionIntervalMs = GcraRateLimiter.calculateEmissionIntervalMs(rule);
		const burstCapacityMs = rule.windowMs;

		const state = await this.getCacheState(key);
		const currentTatMs = state?.tatMs ?? nowMs;
		const nextTatMs = Math.max(currentTatMs, nowMs) + emissionIntervalMs;
		const allowAtMs = nextTatMs - burstCapacityMs;

		if (nowMs >= allowAtMs) {
			const ttlMs = nextTatMs - nowMs;
			const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
			await this.cacheService.set(
				key,
				serializeRateLimitCacheState({
					tatMs: nextTatMs,
					limit: rule.limit,
					windowMs: rule.windowMs,
				}),
				ttlSeconds,
			);

			const remaining = GcraRateLimiter.calculateRemaining(rule.limit, emissionIntervalMs, nextTatMs, nowMs);
			return GcraRateLimiter.createAllowedResult(rule.limit, remaining, nextTatMs, options.global);
		}

		const retryAfterMs = allowAtMs - nowMs;
		return GcraRateLimiter.createBlockedResult(rule.limit, currentTatMs, retryAfterMs, options.global);
	}

	async resetLimit(key: string): Promise<void> {
		await this.cacheService.delete(key);
	}

	async getRemainingAttempts(key: string): Promise<number> {
		const state = await this.getCacheState(key);
		if (!state?.limit || !state.windowMs) {
			return 0;
		}

		const nowMs = this.getCurrentTimeMs();
		const emissionIntervalMs = GcraRateLimiter.calculateEmissionIntervalMs({
			limit: state.limit,
			windowMs: state.windowMs,
		});

		return GcraRateLimiter.calculateRemaining(state.limit, emissionIntervalMs, state.tatMs, nowMs);
	}

	async getResetTime(key: string): Promise<Date> {
		const state = await this.getCacheState(key);
		if (!state) {
			return new Date(this.getCurrentTimeMs());
		}

		return new Date(state.tatMs);
	}
}
