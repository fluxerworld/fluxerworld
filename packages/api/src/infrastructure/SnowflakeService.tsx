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

import {randomUUID} from 'node:crypto';
import type {ISnowflakeService} from '@fluxer/api/src/infrastructure/ISnowflakeService';
import {Logger} from '@fluxer/api/src/Logger';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';
import {
	FLUXER_EPOCH,
	MAX_SEQUENCE,
	MAX_WORKER_ID,
	SEQUENCE_BITS,
	TIMESTAMP_SHIFT,
} from '@fluxer/snowflake/src/Snowflake';
import {seconds} from 'itty-time';

const MAX_SEQ = Number(MAX_SEQUENCE);
const MAX_NODE_ID = Number(MAX_WORKER_ID);
const NODE_ID_TTL = seconds('5 minutes');
const NODE_ID_RENEWAL_INTERVAL = seconds('4 minutes');

export class SnowflakeService implements ISnowflakeService {
	private epoch: bigint;
	private nodeId: number | null = null;
	private seq: number;
	private lastSeqExhaustion: bigint;
	private kvClient: IKVProvider | null = null;
	private instanceId: string;
	private renewalInterval: NodeJS.Timeout | null = null;
	private initializationPromise: Promise<void> | null = null;
	private abortRenewalLoop: boolean = false;
	private shutdownRequested: boolean = false;

	constructor(kvClient?: IKVProvider) {
		this.epoch = BigInt(FLUXER_EPOCH);
		this.seq = 0;
		this.lastSeqExhaustion = 0n;
		this.instanceId = randomUUID();

		if (kvClient) {
			this.kvClient = kvClient;
		}
	}

	async initialize(): Promise<void> {
		if (this.nodeId != null || this.shutdownRequested) {
			return;
		}

		if (!this.initializationPromise) {
			this.initializationPromise = (async () => {
				this.abortRenewalLoop = false;
				if (this.kvClient) {
					this.nodeId = await this.acquireNodeId();
					this.startNodeIdRenewal();
				} else {
					this.nodeId = 0;
				}
			})().finally(() => {
				this.initializationPromise = null;
			});
		}

		await this.initializationPromise;
	}

	private async acquireNodeId(): Promise<number> {
		if (!this.kvClient) {
			throw new Error('KV client not available for node ID allocation');
		}

		const nodeIdKey = 'snowflake:node_counter';
		const nodeRegistryKey = 'snowflake:nodes';

		for (let attempt = 0; attempt < MAX_NODE_ID; attempt++) {
			const candidateId = await this.kvClient.incr(nodeIdKey);
			const normalizedId = (candidateId - 1) % (MAX_NODE_ID + 1);

			const lockKey = `snowflake:node:${normalizedId}`;
			const acquired = await this.kvClient.set(lockKey, this.instanceId, 'EX', NODE_ID_TTL, 'NX');

			if (acquired === 'OK') {
				await this.kvClient.hset(nodeRegistryKey, normalizedId.toString(), this.instanceId);
				return normalizedId;
			}
		}

		throw new Error('Unable to acquire unique node ID - all nodes in use');
	}

	private startNodeIdRenewal(): void {
		if (this.renewalInterval) {
			return;
		}

		this.abortRenewalLoop = false;

		const runRenewalLoop = async () => {
			while (this.renewalInterval && !this.abortRenewalLoop) {
				await this.sleep(NODE_ID_RENEWAL_INTERVAL * 1000);
				if (this.renewalInterval && !this.abortRenewalLoop) {
					try {
						await this.renewNodeId();
					} catch (error) {
						Logger.error(
							{
								error: error instanceof Error ? error.message : String(error),
								nodeId: this.nodeId,
							},
							'Failed to renew snowflake node ID lock',
						);
						this.handleLostNodeId();
					}
				}
			}
		};

		this.renewalInterval = setTimeout(() => {}, 0);
		runRenewalLoop();
	}

	private async renewNodeId(): Promise<void> {
		if (!this.kvClient) {
			throw new Error('SnowflakeService: Cannot renew node ID - kvClient not initialized');
		}

		if (this.nodeId == null) {
			throw new Error('SnowflakeService: Cannot renew node ID - nodeId is null');
		}

		const lockKey = `snowflake:node:${this.nodeId}`;
		const renewed = await this.renewNodeLockIfOwned(lockKey);

		if (!renewed) {
			Logger.warn({nodeId: this.nodeId, lockKey}, 'Lost ownership of snowflake node ID lock');
			this.handleLostNodeId();
		}
	}

	private async renewNodeLockIfOwned(lockKey: string): Promise<boolean> {
		if (!this.kvClient) {
			throw new Error('SnowflakeService: Cannot renew node lock - kvClient not initialized');
		}

		return await this.kvClient.renewSnowflakeNode(lockKey, this.instanceId, NODE_ID_TTL);
	}

	private handleLostNodeId(): void {
		this.nodeId = null;
		this.abortRenewalLoop = true;

		if (this.renewalInterval) {
			clearTimeout(this.renewalInterval);
			this.renewalInterval = null;
		}

		this.abortRenewalLoop = false;
	}

	async reinitialize(): Promise<void> {
		this.shutdownRequested = false;
		this.abortRenewalLoop = false;
		this.nodeId = null;
		this.initializationPromise = null;
		await this.initialize();
	}

	async shutdown(): Promise<void> {
		this.shutdownRequested = true;
		this.abortRenewalLoop = true;

		if (this.renewalInterval) {
			clearTimeout(this.renewalInterval);
			this.renewalInterval = null;
		}

		const nodeId = this.nodeId;

		if (this.kvClient && nodeId != null) {
			const lockKey = `snowflake:node:${nodeId}`;
			const nodeRegistryKey = 'snowflake:nodes';

			this.nodeId = null;

			try {
				await this.kvClient.del(lockKey);
				await this.kvClient.hdel(nodeRegistryKey, nodeId.toString());
			} catch (err) {
				Logger.error(
					{
						error: err instanceof Error ? err.message : String(err),
						nodeId,
						lockKey,
					},
					'Failed to release node ID during shutdown',
				);
			}
		} else {
			this.nodeId = null;
		}
	}

	public async generate(): Promise<bigint> {
		if (this.nodeId == null) {
			throw new Error('SnowflakeService not initialized - call initialize() first');
		}

		const currentTime = BigInt(Date.now());
		return this.generateWithTimestamp(currentTime);
	}

	private async generateWithTimestamp(timestamp: bigint): Promise<bigint> {
		if (this.nodeId == null) {
			throw new Error('SnowflakeService not initialized - call initialize() first');
		}

		while (this.seq === 0 && timestamp <= this.lastSeqExhaustion) {
			await this.sleep(1);
			timestamp = BigInt(Date.now());
		}

		const epochDiff = timestamp - this.epoch;
		const snowflakeId = (epochDiff << TIMESTAMP_SHIFT) | (BigInt(this.nodeId) << SEQUENCE_BITS) | BigInt(this.seq);

		if (this.seq >= MAX_SEQ) {
			this.seq = 0;
			this.lastSeqExhaustion = timestamp;
		} else {
			this.seq += 1;
		}

		return snowflakeId;
	}

	private async sleep(milliseconds: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, milliseconds));
	}

	public getNodeIdForTesting(): number | null {
		return this.nodeId;
	}

	public async renewNodeIdForTesting(): Promise<void> {
		await this.renewNodeId();
	}
}
