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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import {Logger} from '@fluxer/api/src/Logger';
import type {UserRepository} from '@fluxer/api/src/user/repositories/UserRepository';
import {generateLockToken} from '@fluxer/cache/src/CacheLockValidation';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';
import {ms, seconds} from 'itty-time';

interface QueuedDeletion {
	userId: bigint;
	deletionReasonCode: number;
}

const QUEUE_KEY = 'deletion_queue';
const STATE_VERSION_KEY = 'deletion_queue:state_version';
const REBUILD_LOCK_KEY = 'deletion_queue:rebuild_lock';
const REBUILD_LOCK_TTL = seconds('5 minutes');

export class KVAccountDeletionQueueService {
	constructor(
		private readonly kvClient: IKVProvider,
		private readonly userRepository: UserRepository,
	) {}

	private serializeQueueItem(item: QueuedDeletion): string {
		return `${item.userId}|${item.deletionReasonCode}`;
	}

	private deserializeQueueItem(value: string): QueuedDeletion {
		const parts = value.split('|');
		return {
			userId: BigInt(parts[0]),
			deletionReasonCode: parseInt(parts[1], 10),
		};
	}

	async needsRebuild(): Promise<boolean> {
		try {
			const versionExists = await this.kvClient.exists(STATE_VERSION_KEY);
			if (!versionExists) {
				Logger.debug('Deletion queue needs rebuild: no state version');
				return true;
			}

			const stateVersionStr = await this.kvClient.get(STATE_VERSION_KEY);
			if (stateVersionStr) {
				const stateVersion = parseInt(stateVersionStr, 10);
				const ageMs = Date.now() - stateVersion;
				if (ageMs > ms('1 day')) {
					Logger.debug({ageMs, maxAgeMs: ms('1 day')}, 'Deletion queue needs rebuild: state too old');
					return true;
				}
			}

			return false;
		} catch (error) {
			Logger.error({error}, 'Failed to check if deletion queue needs rebuild');
			throw error;
		}
	}

	async rebuildState(): Promise<void> {
		Logger.info('Starting deletion queue rebuild from Cassandra');

		try {
			await this.kvClient.del(QUEUE_KEY);
			await this.kvClient.del(STATE_VERSION_KEY);

			let lastUserId: UserID | undefined;
			let totalProcessed = 0;
			let totalQueued = 0;
			const batchSize = 1000;

			while (true) {
				const users = await this.userRepository.listAllUsersPaginated(batchSize, lastUserId);

				if (users.length === 0) {
					break;
				}

				const pipeline = this.kvClient.pipeline();
				let batchQueued = 0;

				for (const user of users) {
					if (user.pendingDeletionAt) {
						const queueItem: QueuedDeletion = {
							userId: user.id,
							deletionReasonCode: user.deletionReasonCode ?? 0,
						};

						const score = user.pendingDeletionAt.getTime();
						const value = this.serializeQueueItem(queueItem);
						const secondaryKey = this.getSecondaryKey(user.id);

						pipeline.zadd(QUEUE_KEY, score, value);
						pipeline.set(secondaryKey, value);

						batchQueued++;
					}
				}

				if (batchQueued > 0) {
					await pipeline.exec();
					totalQueued += batchQueued;
				}

				totalProcessed += users.length;
				lastUserId = users[users.length - 1].id;

				if (totalProcessed % 10000 === 0) {
					Logger.debug({totalProcessed, totalQueued}, 'Deletion queue rebuild progress');
				}
			}

			await this.kvClient.set(STATE_VERSION_KEY, Date.now().toString());

			Logger.info({totalProcessed, totalQueued}, 'Deletion queue rebuild completed');
		} catch (error) {
			Logger.error({error}, 'Failed to rebuild deletion queue state');
			throw error;
		}
	}

	async scheduleDeletion(userId: UserID, pendingAt: Date, reasonCode: number): Promise<void> {
		try {
			const queueItem: QueuedDeletion = {
				userId,
				deletionReasonCode: reasonCode,
			};

			const score = pendingAt.getTime();
			const value = this.serializeQueueItem(queueItem);
			const secondaryKey = this.getSecondaryKey(userId);

			const pipeline = this.kvClient.pipeline();
			pipeline.zadd(QUEUE_KEY, score, value);
			pipeline.set(secondaryKey, value);
			await pipeline.exec();

			Logger.debug({userId: userId.toString(), pendingAt, reasonCode}, 'Scheduled user deletion');
		} catch (error) {
			Logger.error({error, userId: userId.toString()}, 'Failed to schedule deletion');
			throw error;
		}
	}

	async removeFromQueue(userId: UserID): Promise<void> {
		try {
			const secondaryKey = this.getSecondaryKey(userId);
			const value = await this.kvClient.get(secondaryKey);

			if (!value) {
				Logger.debug({userId: userId.toString()}, 'User not in deletion queue');
				return;
			}

			const pipeline = this.kvClient.pipeline();
			pipeline.zrem(QUEUE_KEY, value);
			pipeline.del(secondaryKey);
			await pipeline.exec();

			Logger.debug({userId: userId.toString()}, 'Removed user from deletion queue');
		} catch (error) {
			Logger.error({error, userId: userId.toString()}, 'Failed to remove user from deletion queue');
			throw error;
		}
	}

	async getReadyDeletions(nowMs: number, limit: number): Promise<Array<QueuedDeletion>> {
		try {
			const results = await this.kvClient.zrangebyscore(QUEUE_KEY, '-inf', nowMs, 'LIMIT', 0, limit);

			const deletions: Array<QueuedDeletion> = [];
			for (const result of results) {
				try {
					const deletion = this.deserializeQueueItem(result);
					deletions.push(deletion);
				} catch (parseError) {
					Logger.error({error: parseError, result}, 'Failed to parse queued deletion');
				}
			}

			return deletions;
		} catch (error) {
			Logger.error({error, nowMs, limit}, 'Failed to get ready deletions');
			throw error;
		}
	}

	async acquireRebuildLock(): Promise<string | null> {
		try {
			const token = generateLockToken();
			const result = await this.kvClient.set(REBUILD_LOCK_KEY, token, 'EX', REBUILD_LOCK_TTL, 'NX');

			if (result === 'OK') {
				Logger.debug({token}, 'Acquired rebuild lock');
				return token;
			}

			return null;
		} catch (error) {
			Logger.error({error}, 'Failed to acquire rebuild lock');
			throw error;
		}
	}

	async releaseRebuildLock(token: string): Promise<boolean> {
		try {
			const released = await this.kvClient.releaseLock(REBUILD_LOCK_KEY, token);

			if (released) {
				Logger.debug({token}, 'Released rebuild lock');
			}

			return released;
		} catch (error) {
			Logger.error({error, token}, 'Failed to release rebuild lock');
			throw error;
		}
	}

	async getQueueSize(): Promise<number> {
		try {
			return await this.kvClient.zcard(QUEUE_KEY);
		} catch (error) {
			Logger.error({error}, 'Failed to get queue size');
			throw error;
		}
	}

	async getStateVersion(): Promise<number | null> {
		try {
			const versionStr = await this.kvClient.get(STATE_VERSION_KEY);
			return versionStr ? parseInt(versionStr, 10) : null;
		} catch (error) {
			Logger.error({error}, 'Failed to get state version');
			throw error;
		}
	}

	private getSecondaryKey(userId: UserID): string {
		return `deletion_queue_by_user:${userId.toString()}`;
	}
}
