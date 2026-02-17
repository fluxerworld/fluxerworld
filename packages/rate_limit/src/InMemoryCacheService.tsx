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

interface CacheEntry<T> {
	value: T;
	expiresAt: number | null;
}

export class InMemoryCacheService {
	private cache = new Map<string, CacheEntry<unknown>>();

	async get<T>(key: string): Promise<T | null> {
		const entry = this.cache.get(key);
		if (!entry) {
			return null;
		}

		if (entry.expiresAt && entry.expiresAt < Date.now()) {
			this.cache.delete(key);
			return null;
		}

		return entry.value as T;
	}

	async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
		const entry: CacheEntry<T> = {
			value,
			expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
		};
		this.cache.set(key, entry as CacheEntry<unknown>);
	}

	async delete(key: string): Promise<void> {
		this.cache.delete(key);
	}
}
