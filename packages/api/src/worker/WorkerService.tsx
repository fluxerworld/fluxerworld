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

import {Logger} from '@fluxer/api/src/Logger';
import {HttpWorkerQueue} from '@fluxer/api/src/worker/HttpWorkerQueue';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';
import type {WorkerJobOptions, WorkerJobPayload} from '@fluxer/worker/src/contracts/WorkerTypes';

export class WorkerService implements IWorkerService {
	private readonly queue: HttpWorkerQueue;

	constructor() {
		this.queue = new HttpWorkerQueue();
	}

	async addJob<TPayload extends WorkerJobPayload = WorkerJobPayload>(
		taskType: string,
		payload: TPayload,
		options?: WorkerJobOptions,
	): Promise<void> {
		try {
			await this.queue.enqueue(taskType, payload, {
				...(options?.runAt !== undefined && {runAt: options.runAt}),
				...(options?.maxAttempts !== undefined && {maxAttempts: options.maxAttempts}),
				...(options?.priority !== undefined && {priority: options.priority}),
			});
			Logger.debug({taskType, payload}, 'Job queued successfully');
		} catch (error) {
			Logger.error({error, taskType, payload}, 'Failed to queue job');
			throw error;
		}
	}

	async cancelJob(jobId: string): Promise<boolean> {
		try {
			const cancelled = await this.queue.cancelJob(jobId);
			if (cancelled) {
				Logger.info({jobId}, 'Job cancelled successfully');
			} else {
				Logger.debug({jobId}, 'Job not found (may have already been processed)');
			}
			return cancelled;
		} catch (error) {
			Logger.error({error, jobId}, 'Failed to cancel job');
			throw error;
		}
	}

	async retryDeadLetterJob(jobId: string): Promise<boolean> {
		try {
			const retried = await this.queue.retryDeadLetterJob(jobId);
			if (retried) {
				Logger.info({jobId}, 'Dead letter job retried successfully');
			} else {
				Logger.debug({jobId}, 'Job not found in dead letter queue');
			}
			return retried;
		} catch (error) {
			Logger.error({error, jobId}, 'Failed to retry dead letter job');
			throw error;
		}
	}
}
