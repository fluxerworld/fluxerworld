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

import {Config} from '@fluxer/api/src/Config';
import type {CachedLimitConfig} from '@fluxer/api/src/constants/LimitConfig';
import {
	createDefaultLimitConfig,
	getLimitConfigKvKey,
	LIMIT_CONFIG_REFRESH_CHANNEL,
	LIMIT_CONFIG_REFRESH_LOCK_KEY,
	mergeWithCurrentDefaults,
	sanitizeLimitConfigForInstance,
} from '@fluxer/api/src/constants/LimitConfig';
import type {InstanceConfigRepository} from '@fluxer/api/src/instance/InstanceConfigRepository';
import {Logger} from '@fluxer/api/src/Logger';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import type {IKVProvider, IKVSubscription} from '@fluxer/kv_client/src/IKVProvider';
import {computeWireFormat} from '@fluxer/limits/src/LimitDiffer';
import {computeDefaultsHash} from '@fluxer/limits/src/LimitHashing';
import type {LimitConfigSnapshot, LimitConfigWireFormat} from '@fluxer/limits/src/LimitTypes';

let globalLimitConfigService: LimitConfigService | null = null;

export class LimitConfigService {
	private config: LimitConfigSnapshot = createDefaultLimitConfig({selfHosted: Config.instance.selfHosted});
	private repository: InstanceConfigRepository;
	private cacheService: ICacheService;
	private kvClient: IKVProvider | null;
	private kvSubscription: IKVSubscription | null = null;
	private subscriberInitialized = false;
	private readonly cacheKey: string;

	constructor(repository: InstanceConfigRepository, cacheService: ICacheService, kvClient: IKVProvider | null = null) {
		this.repository = repository;
		this.cacheService = cacheService;
		this.kvClient = kvClient;
		this.cacheKey = getLimitConfigKvKey(Config.instance.selfHosted);
	}

	setAsGlobalInstance(): void {
		globalLimitConfigService = this;
	}

	async initialize(): Promise<void> {
		await this.refreshCache();
		this.initializeSubscriber();
		Logger.info('LimitConfigService initialized');
	}

	getConfigSnapshot(): LimitConfigSnapshot {
		return this.config;
	}

	getConfigWireFormat(): LimitConfigWireFormat {
		return computeWireFormat(this.config);
	}

	async refreshCache(): Promise<void> {
		const currentHash = computeDefaultsHash();
		const lockToken = await this.cacheService.acquireLock(LIMIT_CONFIG_REFRESH_LOCK_KEY, 10);

		if (!lockToken) {
			Logger.debug('Limit config refresh already in progress, waiting for cache update');
			await this.sleep(50);

			const cached = await this.cacheService.get<CachedLimitConfig>(this.cacheKey);
			if (cached && cached.defaultsHash === currentHash) {
				this.config = sanitizeLimitConfigForInstance(cached.config, {selfHosted: Config.instance.selfHosted});
				return;
			}

			this.config = createDefaultLimitConfig({selfHosted: Config.instance.selfHosted});
			return;
		}

		try {
			const cached = await this.cacheService.get<CachedLimitConfig>(this.cacheKey);

			if (cached && cached.defaultsHash === currentHash) {
				this.config = sanitizeLimitConfigForInstance(cached.config, {selfHosted: Config.instance.selfHosted});
				return;
			}

			const dbConfig = await this.repository.getLimitConfig();

			if (dbConfig === null) {
				this.config = createDefaultLimitConfig({selfHosted: Config.instance.selfHosted});
				await this.cacheService.delete(this.cacheKey);
				Logger.debug('No database limit config, using fresh defaults');
				return;
			}

			Logger.info(
				{hashMismatch: cached?.defaultsHash !== currentHash},
				'Merging database config with current defaults',
			);

			const merged = mergeWithCurrentDefaults(dbConfig, {selfHosted: Config.instance.selfHosted});
			await this.repository.setLimitConfig(merged);
			await this.cacheService.set(this.cacheKey, {
				config: merged,
				defaultsHash: currentHash,
			});
			this.config = sanitizeLimitConfigForInstance(merged, {selfHosted: Config.instance.selfHosted});
		} finally {
			await this.cacheService.releaseLock(LIMIT_CONFIG_REFRESH_LOCK_KEY, lockToken);
		}
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async updateConfig(config: LimitConfigSnapshot): Promise<void> {
		const normalized = sanitizeLimitConfigForInstance(config, {selfHosted: Config.instance.selfHosted});
		await this.repository.setLimitConfig(normalized);
		await this.cacheService.delete(this.cacheKey);
		await this.refreshCache();
		await this.cacheService.publish(LIMIT_CONFIG_REFRESH_CHANNEL, 'refresh');
		Logger.info({ruleCount: normalized.rules.length}, 'Limit config updated');
	}

	private initializeSubscriber(): void {
		if (this.subscriberInitialized || !this.kvClient) {
			return;
		}

		const subscription = this.kvClient.duplicate();
		this.kvSubscription = subscription;

		subscription
			.connect()
			.then(() => subscription.subscribe(LIMIT_CONFIG_REFRESH_CHANNEL))
			.then(() => {
				subscription.on('message', (channel) => {
					if (channel === LIMIT_CONFIG_REFRESH_CHANNEL) {
						this.refreshCache().catch((err) => {
							Logger.error({err}, 'Failed to refresh limit config from pubsub');
						});
					}
				});
			})
			.catch((error) => {
				Logger.error({error}, 'Failed to subscribe to limit config refresh channel');
			});

		this.subscriberInitialized = true;
	}

	shutdown(): void {
		if (this.kvSubscription) {
			this.kvSubscription.quit().catch((err) => {
				Logger.error({err}, 'Failed to close KV subscription');
			});
			this.kvSubscription = null;
		}
	}
}

export function getGlobalLimitConfigSnapshot(): LimitConfigSnapshot {
	if (!globalLimitConfigService) {
		throw new Error('LimitConfigService global instance has not been initialized');
	}
	return globalLimitConfigService.getConfigSnapshot();
}
