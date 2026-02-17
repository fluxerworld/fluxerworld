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
import type {TracingInterface, WorkerJobOptions, WorkerJobPayload} from '@fluxer/worker/src/contracts/WorkerTypes';
import type {IQueueProvider} from '@fluxer/worker/src/providers/IQueueProvider';
import {createQueueProvider} from '@fluxer/worker/src/providers/QueueProviderFactory';

export interface WorkerServiceOptions {
	queueBaseUrl?: string | undefined;
	queueProvider?: IQueueProvider | undefined;
	logger: LoggerInterface;
	tracing?: TracingInterface | undefined;
	timeoutMs?: number | undefined;
}

export class WorkerService implements IWorkerService {
	private readonly queue: IQueueProvider;
	private readonly logger: LoggerInterface;

	constructor(options: WorkerServiceOptions) {
		this.queue = createQueueProvider({
			queueProvider: options.queueProvider,
			queueBaseUrl: options.queueBaseUrl,
			timeoutMs: options.timeoutMs,
			tracing: options.tracing,
		});
		this.logger = options.logger;
	}

	async addJob<TPayload extends WorkerJobPayload = WorkerJobPayload>(
		taskType: string,
		payload: TPayload,
		options?: WorkerJobOptions,
	): Promise<void> {
		try {
			await this.queue.enqueue(taskType, payload, {
				runAt: options?.runAt,
				maxAttempts: options?.maxAttempts,
				priority: options?.priority,
			});
			this.logger.debug({taskType, payload}, 'Job queued successfully');
		} catch (error) {
			this.logger.error({error, taskType, payload}, 'Failed to queue job');
			throw error;
		}
	}

	async cancelJob(jobId: string): Promise<boolean> {
		try {
			const cancelled = await this.queue.cancelJob(jobId);
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
			const retried = await this.queue.retryDeadLetterJob(jobId);
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

	getQueue(): IQueueProvider {
		return this.queue;
	}
}
