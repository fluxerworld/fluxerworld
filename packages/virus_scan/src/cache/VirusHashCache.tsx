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

import type {IVirusHashCache} from '@fluxer/virus_scan/src/cache/IVirusHashCache';
import type {IVirusScanCacheStore} from '@fluxer/virus_scan/src/cache/IVirusScanCacheStore';
import {seconds} from 'itty-time';

export interface VirusHashCacheConfig {
	keyPrefix?: string;
	ttlSeconds?: number;
}

export class VirusHashCache implements IVirusHashCache {
	private readonly keyPrefix: string;
	private readonly ttlSeconds: number;

	constructor(
		private cacheStore: IVirusScanCacheStore,
		config: VirusHashCacheConfig = {},
	) {
		this.keyPrefix = config.keyPrefix ?? 'virus';
		this.ttlSeconds = config.ttlSeconds ?? seconds('7 days');
	}

	async isKnownVirusHash(fileHash: string): Promise<boolean> {
		const cachedValue = await this.cacheStore.get(this.buildCacheKey(fileHash));
		return cachedValue != null;
	}

	async cacheVirusHash(fileHash: string): Promise<void> {
		await this.cacheStore.set(this.buildCacheKey(fileHash), 'true', this.ttlSeconds);
	}

	private buildCacheKey(fileHash: string): string {
		return `${this.keyPrefix}:${fileHash}`;
	}
}
