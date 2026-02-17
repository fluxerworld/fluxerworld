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
import {UserRepository} from '@fluxer/api/src/user/repositories/UserRepository';
import type {IKVProvider} from '@fluxer/kv_client/src/IKVProvider';
import {seconds} from 'itty-time';

const TTL_SECONDS = seconds('90 days');
const STATE_VERSION_KEY = 'activity_tracker:state_version';
const STATE_VERSION_TTL_SECONDS = seconds('1 day');
const REBUILD_BATCH_SIZE = 100;

export class KVActivityTracker {
	private kvClient: IKVProvider;
	private isShuttingDown = false;

	constructor(kvClient: IKVProvider) {
		this.kvClient = kvClient;
	}

	shutdown(): void {
		this.isShuttingDown = true;
	}

	private getActivityKey(userId: UserID): string {
		return `user_activity:${userId}`;
	}

	async updateActivity(userId: UserID, timestamp: Date): Promise<void> {
		const key = this.getActivityKey(userId);
		const value = timestamp.getTime().toString();
		await this.kvClient.setex(key, TTL_SECONDS, value);
	}

	async getActivity(userId: UserID): Promise<Date | null> {
		const key = this.getActivityKey(userId);
		const value = await this.kvClient.get(key);

		if (!value) {
			return null;
		}

		const timestamp = parseInt(value, 10);
		if (Number.isNaN(timestamp)) {
			return null;
		}

		return new Date(timestamp);
	}

	async needsRebuild(): Promise<boolean> {
		const exists = await this.kvClient.exists(STATE_VERSION_KEY);
		if (exists === 0) {
			return true;
		}

		const ttl = await this.kvClient.ttl(STATE_VERSION_KEY);

		if (ttl < 0) {
			return true;
		}

		const age = STATE_VERSION_TTL_SECONDS - ttl;
		return age > STATE_VERSION_TTL_SECONDS;
	}

	async rebuildActivities(): Promise<void> {
		Logger.info('Starting activity tracker rebuild from Cassandra');

		const userRepository = new UserRepository();

		try {
			const kvBatchSize = 1000;
			let processedCount = 0;
			let usersWithActivity = 0;
			let pipeline = this.kvClient.pipeline();
			let pipelineCount = 0;
			let lastUserId: UserID | undefined;
			let iterationCount = 0;

			while (!this.isShuttingDown) {
				const users = await userRepository.listAllUsersPaginated(REBUILD_BATCH_SIZE, lastUserId);

				if (users.length === 0) {
					break;
				}

				for (const user of users) {
					if (user.lastActiveAt) {
						const key = this.getActivityKey(user.id);
						const value = user.lastActiveAt.getTime().toString();
						pipeline.setex(key, TTL_SECONDS, value);
						pipelineCount++;
						usersWithActivity++;

						if (pipelineCount >= kvBatchSize) {
							await pipeline.exec();
							pipeline = this.kvClient.pipeline();
							pipelineCount = 0;
						}
					}

					processedCount++;
				}

				if (processedCount % 10000 === 0) {
					Logger.info({processedCount, usersWithActivity}, 'Activity tracker rebuild progress');
				}

				lastUserId = users[users.length - 1].id;
				iterationCount++;

				if (iterationCount % 10 === 0) {
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			}

			if (this.isShuttingDown) {
				Logger.warn({processedCount, usersWithActivity}, 'Activity tracker rebuild interrupted by shutdown');
				return;
			}

			if (pipelineCount > 0) {
				await pipeline.exec();
			}

			await this.kvClient.setex(STATE_VERSION_KEY, STATE_VERSION_TTL_SECONDS, Date.now().toString());

			Logger.info({processedCount, usersWithActivity}, 'Activity tracker rebuild completed');
		} catch (error) {
			Logger.error({error}, 'Activity tracker rebuild failed');
			throw error;
		}
	}
}
