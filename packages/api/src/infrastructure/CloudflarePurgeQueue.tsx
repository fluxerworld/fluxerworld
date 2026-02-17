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

import {Logger} from '@fluxer/api/src/Logger';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';

export interface IPurgeQueue {
	addUrls(urls: Array<string>): Promise<void>;
	getBatch(count: number): Promise<Array<string>>;
	getQueueSize(): Promise<number>;
	clear(): Promise<void>;
	tryConsumeTokens(
		requestedTokens: number,
		maxTokens: number,
		refillRate: number,
		refillIntervalMs: number,
	): Promise<number>;
	getAvailableTokens(maxTokens: number, refillRate: number, refillIntervalMs: number): Promise<number>;
}

export class CloudflarePurgeQueue implements IPurgeQueue {
	private readonly kvClient: IKVProvider;
	private readonly queueKey = 'cloudflare:purge:urls';
	private readonly tokenBucketKey = 'cloudflare:purge:token_bucket';

	constructor(kvClient: IKVProvider) {
		this.kvClient = kvClient;
	}

	async addUrls(urls: Array<string>): Promise<void> {
		if (urls.length === 0) {
			return;
		}

		const normalized = Array.from(
			new Set(urls.map((url) => this.normalizePrefix(url)).filter((prefix) => prefix !== '')),
		);

		if (normalized.length === 0) {
			return;
		}

		try {
			await this.kvClient.sadd(this.queueKey, ...normalized);
			Logger.debug({count: normalized.length}, 'Added prefixes to Cloudflare purge queue');
		} catch (error) {
			Logger.error({error, urls}, 'Failed to add prefixes to Cloudflare purge queue');
			throw error;
		}
	}

	private normalizePrefix(rawUrl: string): string {
		const trimmed = rawUrl.trim();
		if (trimmed === '') {
			return '';
		}

		try {
			const parsed = new URL(trimmed);
			return `${parsed.host}${parsed.pathname}`;
		} catch {
			const [withoutQuery = ''] = trimmed.split(/[?#]/);
			return withoutQuery.replace(/^https?:\/\//, '');
		}
	}

	async getBatch(count: number): Promise<Array<string>> {
		if (count <= 0) {
			return [];
		}

		try {
			const urls = await this.kvClient.spop(this.queueKey, count);
			return Array.isArray(urls) ? urls : urls ? [urls] : [];
		} catch (error) {
			Logger.error({error, count}, 'Failed to get batch from Cloudflare purge queue');
			throw error;
		}
	}

	async getQueueSize(): Promise<number> {
		try {
			return await this.kvClient.scard(this.queueKey);
		} catch (error) {
			Logger.error({error}, 'Failed to get Cloudflare purge queue size');
			throw error;
		}
	}

	async clear(): Promise<void> {
		try {
			await this.kvClient.del(this.queueKey);
			Logger.debug('Cleared Cloudflare purge queue');
		} catch (error) {
			Logger.error({error}, 'Failed to clear Cloudflare purge queue');
			throw error;
		}
	}

	async tryConsumeTokens(
		requestedTokens: number,
		maxTokens: number,
		refillRate: number,
		refillIntervalMs: number,
	): Promise<number> {
		try {
			const consumed = await this.kvClient.tryConsumeTokens(
				this.tokenBucketKey,
				requestedTokens,
				maxTokens,
				refillRate,
				refillIntervalMs,
			);

			Logger.debug({requested: requestedTokens, consumed}, 'Tried to consume tokens from bucket');
			return consumed;
		} catch (error) {
			Logger.error({error, requestedTokens}, 'Failed to consume tokens');
			throw error;
		}
	}

	async getAvailableTokens(maxTokens: number, refillRate: number, refillIntervalMs: number): Promise<number> {
		try {
			const now = Date.now();
			const bucketData = await this.kvClient.get(this.tokenBucketKey);

			if (!bucketData) {
				return maxTokens;
			}

			const parsed = JSON.parse(bucketData);
			let tokens = parsed.tokens;
			const lastRefill = parsed.lastRefill;

			const elapsed = now - lastRefill;
			const tokensToAdd = Math.floor(elapsed / refillIntervalMs) * refillRate;

			if (tokensToAdd > 0) {
				tokens = Math.min(maxTokens, tokens + tokensToAdd);
			}

			return tokens;
		} catch (error) {
			Logger.error({error}, 'Failed to get available tokens');
			throw error;
		}
	}

	async resetTokenBucket(): Promise<void> {
		try {
			await this.kvClient.del(this.tokenBucketKey);
			Logger.debug('Reset Cloudflare purge token bucket');
		} catch (error) {
			Logger.error({error}, 'Failed to reset Cloudflare purge token bucket');
			throw error;
		}
	}
}

export class NoopPurgeQueue implements IPurgeQueue {
	async addUrls(_urls: Array<string>): Promise<void> {}

	async getBatch(_count: number): Promise<Array<string>> {
		return [];
	}

	async getQueueSize(): Promise<number> {
		return 0;
	}

	async clear(): Promise<void> {}

	async tryConsumeTokens(
		_requestedTokens: number,
		_maxTokens: number,
		_refillRate: number,
		_refillIntervalMs: number,
	): Promise<number> {
		return 0;
	}

	async getAvailableTokens(maxTokens: number, _refillRate: number, _refillIntervalMs: number): Promise<number> {
		return maxTokens;
	}
}
