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

import type {IAssetDeletionQueue, QueuedAssetDeletion} from '@fluxer/api/src/infrastructure/IAssetDeletionQueue';
import {vi} from 'vitest';

export interface MockAssetDeletionQueueConfig {
	shouldFailQueue?: boolean;
	shouldFailPurge?: boolean;
	shouldFailGetBatch?: boolean;
}

export class MockAssetDeletionQueue implements IAssetDeletionQueue {
	readonly queueDeletionSpy = vi.fn();
	readonly queueCdnPurgeSpy = vi.fn();
	readonly getBatchSpy = vi.fn();
	readonly requeueItemSpy = vi.fn();
	readonly getQueueSizeSpy = vi.fn();
	readonly clearSpy = vi.fn();

	private config: MockAssetDeletionQueueConfig;
	private queue: Array<QueuedAssetDeletion> = [];
	private purges: Array<string> = [];

	constructor(config: MockAssetDeletionQueueConfig = {}) {
		this.config = config;
	}

	configure(config: MockAssetDeletionQueueConfig): void {
		this.config = {...this.config, ...config};
	}

	async queueDeletion(item: Omit<QueuedAssetDeletion, 'queuedAt' | 'retryCount'>): Promise<void> {
		this.queueDeletionSpy(item);
		if (this.config.shouldFailQueue) {
			throw new Error('Mock queue deletion failure');
		}
		this.queue.push({...item, queuedAt: Date.now(), retryCount: 0});
	}

	async queueCdnPurge(cdnUrl: string): Promise<void> {
		this.queueCdnPurgeSpy(cdnUrl);
		if (this.config.shouldFailPurge) {
			throw new Error('Mock CDN purge failure');
		}
		this.purges.push(cdnUrl);
	}

	async getBatch(count: number): Promise<Array<QueuedAssetDeletion>> {
		this.getBatchSpy(count);
		if (this.config.shouldFailGetBatch) {
			throw new Error('Mock get batch failure');
		}
		return this.queue.splice(0, count);
	}

	async requeueItem(item: QueuedAssetDeletion): Promise<void> {
		this.requeueItemSpy(item);
		this.queue.push({...item, retryCount: (item.retryCount ?? 0) + 1});
	}

	async getQueueSize(): Promise<number> {
		this.getQueueSizeSpy();
		return this.queue.length;
	}

	async clear(): Promise<void> {
		this.clearSpy();
		this.queue = [];
		this.purges = [];
	}

	getQueuedItems(): Array<QueuedAssetDeletion> {
		return [...this.queue];
	}

	getPurges(): Array<string> {
		return [...this.purges];
	}

	reset(): void {
		this.config = {};
		this.queue = [];
		this.purges = [];
		this.queueDeletionSpy.mockClear();
		this.queueCdnPurgeSpy.mockClear();
		this.getBatchSpy.mockClear();
		this.requeueItemSpy.mockClear();
		this.getQueueSizeSpy.mockClear();
		this.clearSpy.mockClear();
	}
}
