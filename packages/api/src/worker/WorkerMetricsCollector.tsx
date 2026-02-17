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

import type {AssetDeletionQueue} from '@fluxer/api/src/infrastructure/AssetDeletionQueue';
import type {IPurgeQueue} from '@fluxer/api/src/infrastructure/CloudflarePurgeQueue';
import type {IMetricsService} from '@fluxer/api/src/infrastructure/IMetricsService';
import type {KVAccountDeletionQueueService} from '@fluxer/api/src/infrastructure/KVAccountDeletionQueueService';
import type {KVBulkMessageDeletionQueueService} from '@fluxer/api/src/infrastructure/KVBulkMessageDeletionQueueService';
import {Logger} from '@fluxer/api/src/Logger';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';
import {ms} from 'itty-time';

interface WorkerMetricsCollectorOptions {
	kvClient: IKVProvider;
	metricsService: IMetricsService;
	assetDeletionQueue: AssetDeletionQueue;
	purgeQueue: IPurgeQueue;
	bulkMessageDeletionQueue: KVBulkMessageDeletionQueueService;
	accountDeletionQueue: KVAccountDeletionQueueService;
	reportIntervalMs?: number;
}

export class WorkerMetricsCollector {
	private readonly kvClient: IKVProvider;
	private readonly metricsService: IMetricsService;
	private readonly assetDeletionQueue: AssetDeletionQueue;
	private readonly purgeQueue: IPurgeQueue;
	private readonly bulkMessageDeletionQueue: KVBulkMessageDeletionQueueService;
	private readonly accountDeletionQueue: KVAccountDeletionQueueService;
	private readonly reportIntervalMs: number;
	private intervalHandle: ReturnType<typeof setInterval> | null = null;
	private kvErrorCount = 0;

	constructor(options: WorkerMetricsCollectorOptions) {
		this.kvClient = options.kvClient;
		this.metricsService = options.metricsService;
		this.assetDeletionQueue = options.assetDeletionQueue;
		this.purgeQueue = options.purgeQueue;
		this.bulkMessageDeletionQueue = options.bulkMessageDeletionQueue;
		this.accountDeletionQueue = options.accountDeletionQueue;
		this.reportIntervalMs = options.reportIntervalMs ?? ms('30 seconds');
	}

	start(): void {
		if (this.intervalHandle) return;

		Logger.info({intervalMs: this.reportIntervalMs}, 'Starting WorkerMetricsCollector');

		this.collectAndReport().catch((err) => {
			Logger.error({err}, 'Initial metrics collection failed');
		});

		this.intervalHandle = setInterval(() => {
			this.collectAndReport().catch((err) => {
				Logger.error({err}, 'Metrics collection failed');
			});
		}, this.reportIntervalMs);
	}

	stop(): void {
		if (this.intervalHandle) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
			Logger.info('Stopped WorkerMetricsCollector');
		}
	}

	private async collectAndReport(): Promise<void> {
		const [kvQueueSizes, kvConnectionStatus] = await Promise.all([
			this.collectKVQueueSizes(),
			this.collectKVConnectionStatus(),
		]);

		this.reportKVQueueSizes(kvQueueSizes);
		this.reportKVHealthMetrics(kvConnectionStatus);
	}

	private async collectKVQueueSizes(): Promise<{
		assetDeletion: number;
		cloudflarePurge: number;
		bulkMessageDeletion: number;
		accountDeletion: number;
	}> {
		try {
			const [assetDeletion, cloudflarePurge, bulkMessageDeletion, accountDeletion] = await Promise.all([
				this.assetDeletionQueue.getQueueSize(),
				this.purgeQueue.getQueueSize(),
				this.bulkMessageDeletionQueue.getQueueSize(),
				this.accountDeletionQueue.getQueueSize(),
			]);
			return {assetDeletion, cloudflarePurge, bulkMessageDeletion, accountDeletion};
		} catch (err) {
			this.kvErrorCount++;
			Logger.error({err}, 'Failed to collect KV queue sizes');
			return {assetDeletion: 0, cloudflarePurge: 0, bulkMessageDeletion: 0, accountDeletion: 0};
		}
	}

	private reportKVQueueSizes(sizes: {
		assetDeletion: number;
		cloudflarePurge: number;
		bulkMessageDeletion: number;
		accountDeletion: number;
	}): void {
		this.metricsService.gauge({
			name: 'worker.kv_queue.asset_deletion',
			value: sizes.assetDeletion,
		});
		this.metricsService.gauge({
			name: 'worker.kv_queue.cloudflare_purge',
			value: sizes.cloudflarePurge,
		});
		this.metricsService.gauge({
			name: 'worker.kv_queue.bulk_message_deletion',
			value: sizes.bulkMessageDeletion,
		});
		this.metricsService.gauge({
			name: 'worker.kv_queue.account_deletion',
			value: sizes.accountDeletion,
		});
	}

	private async collectKVConnectionStatus(): Promise<boolean> {
		try {
			return await this.kvClient.health();
		} catch (err) {
			this.kvErrorCount++;
			Logger.error({err}, 'KV health check failed');
			return false;
		}
	}

	private reportKVHealthMetrics(isConnected: boolean): void {
		this.metricsService.gauge({
			name: 'kv.connection.status',
			value: isConnected ? 1 : 0,
		});

		if (this.kvErrorCount > 0) {
			this.metricsService.counter({
				name: 'kv.command.error',
				value: this.kvErrorCount,
			});
			this.kvErrorCount = 0;
		}
	}
}
