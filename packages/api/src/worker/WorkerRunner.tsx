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
import {Logger} from '@fluxer/api/src/Logger';
import {getWorkerService} from '@fluxer/api/src/middleware/ServiceRegistry';
import {addSpanEvent, setSpanAttributes, withSpan} from '@fluxer/api/src/telemetry/Tracing';
import type {HttpWorkerQueue} from '@fluxer/api/src/worker/HttpWorkerQueue';
import {HttpWorkerQueue as HttpWorkerQueueClass} from '@fluxer/api/src/worker/HttpWorkerQueue';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';
import type {WorkerTaskHandler} from '@fluxer/worker/src/contracts/WorkerTask';
import {ms} from 'itty-time';

interface WorkerRunnerOptions {
	tasks: Record<string, WorkerTaskHandler>;
	workerId?: string;
	taskTypes?: Array<string>;
	concurrency?: number;
}

export class WorkerRunner {
	private readonly tasks: Record<string, WorkerTaskHandler>;
	private readonly workerId: string;
	private readonly taskTypes: Array<string>;
	private readonly concurrency: number;
	private readonly queue: HttpWorkerQueue;
	private readonly workerService: IWorkerService;
	private running = false;
	private abortController: AbortController | null = null;

	constructor(options: WorkerRunnerOptions) {
		this.tasks = options.tasks;
		this.workerId = options.workerId ?? `worker-${randomUUID()}`;
		this.taskTypes = options.taskTypes ?? Object.keys(options.tasks);
		this.concurrency = options.concurrency ?? 1;
		this.queue = new HttpWorkerQueueClass();
		this.workerService = getWorkerService();
	}

	async start(): Promise<void> {
		if (this.running) {
			Logger.warn({workerId: this.workerId}, 'Worker already running');
			return;
		}

		this.running = true;
		this.abortController = new AbortController();

		Logger.info({workerId: this.workerId, taskTypes: this.taskTypes, concurrency: this.concurrency}, 'Worker starting');

		const workers = Array.from({length: this.concurrency}, (_, i) => this.workerLoop(i, this.abortController!.signal));

		Promise.all(workers).catch((error) => {
			Logger.error({workerId: this.workerId, error}, 'Worker loop failed unexpectedly');
		});
	}

	async stop(): Promise<void> {
		if (!this.running) {
			return;
		}

		this.running = false;
		this.abortController?.abort();

		await new Promise((resolve) => setTimeout(resolve, ms('5 seconds')));

		Logger.info({workerId: this.workerId}, 'Worker stopped');
	}

	private async workerLoop(workerIndex: number, signal: AbortSignal): Promise<void> {
		Logger.info({workerId: this.workerId, workerIndex}, 'Worker loop started');

		while (!signal.aborted) {
			try {
				const leasedJobs = await this.queue.dequeue(this.taskTypes, 1);

				if (!leasedJobs || leasedJobs.length === 0) {
					continue;
				}

				const leasedJob = leasedJobs[0]!;
				const job = leasedJob.job;

				Logger.info(
					{
						workerId: this.workerId,
						workerIndex,
						jobId: job.id,
						taskType: job.task_type,
						attempts: job.attempts,
						receipt: leasedJob.receipt,
					},
					'Processing job',
				);

				const succeeded = await this.processJob(leasedJob);
				if (succeeded) {
					Logger.info({workerId: this.workerId, workerIndex, jobId: job.id}, 'Job completed successfully');
				}
			} catch (error) {
				Logger.error({workerId: this.workerId, workerIndex, error}, 'Worker loop error');

				await this.sleep(ms('1 second'));
			}
		}

		Logger.info({workerId: this.workerId, workerIndex}, 'Worker loop stopped');
	}

	private async processJob(leasedJob: {
		receipt: string;
		job: {id: string; task_type: string; payload: unknown; attempts: number};
	}): Promise<boolean> {
		return await withSpan(
			{
				name: 'worker.process_job',
				attributes: {
					'worker.id': this.workerId,
					'job.id': leasedJob.job.id,
					'job.task_type': leasedJob.job.task_type,
					'job.attempts': leasedJob.job.attempts,
				},
			},
			async () => {
				const task = this.tasks[leasedJob.job.task_type];
				if (!task) {
					throw new Error(`Unknown task: ${leasedJob.job.task_type}`);
				}

				addSpanEvent('job.execution.start');

				try {
					await task(leasedJob.job.payload as never, {
						logger: Logger.child({jobId: leasedJob.job.id}),
						addJob: this.workerService.addJob.bind(this.workerService),
					});

					addSpanEvent('job.execution.success');
					setSpanAttributes({'job.status': 'success'});

					await this.queue.complete(leasedJob.receipt);
					return true;
				} catch (error) {
					Logger.error({jobId: leasedJob.job.id, error}, 'Job failed');

					setSpanAttributes({
						'job.status': 'failed',
						'job.error': error instanceof Error ? error.message : String(error),
					});
					addSpanEvent('job.execution.failed', {
						error: error instanceof Error ? error.message : String(error),
					});

					await this.queue.fail(leasedJob.receipt, String(error));
					return false;
				}
			},
		);
	}

	private async sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
