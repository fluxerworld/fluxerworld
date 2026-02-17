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

import type {MetricsInterface} from '@fluxer/media_proxy/src/types/Metrics';
import type {TracingInterface} from '@fluxer/media_proxy/src/types/Tracing';

export class InMemoryCoalescer {
	private pending = new Map<string, Promise<unknown>>();
	private metrics: MetricsInterface | undefined;
	private tracing: TracingInterface | undefined;

	constructor(options?: {metrics?: MetricsInterface | undefined; tracing?: TracingInterface | undefined}) {
		this.metrics = options?.metrics;
		this.tracing = options?.tracing;
	}

	async coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
		const existing = this.pending.get(key) as Promise<T> | undefined;
		if (existing) {
			this.metrics?.counter({name: 'media_proxy.cache.hit'});
			this.tracing?.addSpanEvent('cache.hit', {cache_key: key});
			return existing;
		}

		this.metrics?.counter({name: 'media_proxy.cache.miss'});
		this.tracing?.addSpanEvent('cache.miss', {cache_key: key});

		const promise = (async () => {
			try {
				if (this.tracing) {
					return await this.tracing.withSpan(
						{
							name: 'cache.compute',
							attributes: {cache_key: key},
						},
						async () => fn(),
					);
				}
				return await fn();
			} finally {
				this.pending.delete(key);
			}
		})();

		this.pending.set(key, promise);
		return promise;
	}
}
