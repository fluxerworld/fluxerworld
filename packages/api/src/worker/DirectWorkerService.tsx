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

import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';
import type {WorkerJobOptions, WorkerJobPayload} from '@fluxer/worker/src/contracts/WorkerTypes';
import type {IQueueProvider} from '@fluxer/worker/src/providers/IQueueProvider';

export interface DirectWorkerServiceOptions {
	queueProvider: IQueueProvider;
	logger: LoggerInterface;
}

export class DirectWorkerService implements IWorkerService {
	private readonly queueProvider: IQueueProvider;
	private readonly logger: LoggerInterface;

	constructor(options: DirectWorkerServiceOptions) {
		this.queueProvider = options.queueProvider;
		this.logger = options.logger;
	}

	async addJob<TPayload extends WorkerJobPayload = WorkerJobPayload>(
		taskType: string,
		payload: TPayload,
		options?: WorkerJobOptions,
	): Promise<void> {
		try {
			await this.queueProvider.enqueue(taskType, payload, {
				runAt: options?.runAt,
				maxAttempts: options?.maxAttempts,
				priority: options?.priority,
			});
			this.logger.debug({taskType, payload}, 'Job queued successfully via direct provider');
		} catch (error) {
			this.logger.error({error, taskType, payload}, 'Failed to queue job via direct provider');
			throw error;
		}
	}

	async cancelJob(jobId: string): Promise<boolean> {
		try {
			const cancelled = await this.queueProvider.cancelJob(jobId);
			if (cancelled) {
				this.logger.info({jobId}, 'Job cancelled successfully');
			} else {
				this.logger.debug({jobId}, 'Job not found (may have already been processed)');
			}
			return cancelled;
		} catch (error) {
			this.logger.error({error, jobId}, 'Failed to cancel job');
			throw error;
		}
	}

	async retryDeadLetterJob(jobId: string): Promise<boolean> {
		try {
			const retried = await this.queueProvider.retryDeadLetterJob(jobId);
			if (retried) {
				this.logger.info({jobId}, 'Dead letter job retried successfully');
			} else {
				this.logger.debug({jobId}, 'Job not found in dead letter queue');
			}
			return retried;
		} catch (error) {
			this.logger.error({error, jobId}, 'Failed to retry dead letter job');
			throw error;
		}
	}
}
