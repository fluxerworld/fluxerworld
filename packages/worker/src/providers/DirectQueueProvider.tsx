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

import type {CronScheduler} from '@fluxer/queue/src/cron/CronScheduler';
import type {QueueEngine} from '@fluxer/queue/src/engine/QueueEngine';
import type {JsonValue} from '@fluxer/queue/src/types/JsonTypes';
import type {
	EnqueueOptions,
	LeasedQueueJob,
	TracingInterface,
	WorkerJobPayload,
} from '@fluxer/worker/src/contracts/WorkerTypes';
import type {IQueueProvider} from '@fluxer/worker/src/providers/IQueueProvider';

export interface DirectQueueProviderOptions {
	engine: QueueEngine;
	cronScheduler: CronScheduler;
	tracing?: TracingInterface;
}

export class DirectQueueProvider implements IQueueProvider {
	private readonly engine: QueueEngine;
	private readonly cronScheduler: CronScheduler;
	private readonly tracing: TracingInterface | undefined;

	constructor(options: DirectQueueProviderOptions) {
		this.engine = options.engine;
		this.cronScheduler = options.cronScheduler;
		this.tracing = options.tracing;
	}

	private async withOptionalSpan<T>(
		options: {name: string; attributes?: Record<string, unknown>},
		fn: () => Promise<T>,
	): Promise<T> {
		if (this.tracing) {
			return this.tracing.withSpan(options, fn);
		}
		return fn();
	}

	async enqueue(taskType: string, payload: WorkerJobPayload, options?: EnqueueOptions): Promise<string> {
		return this.withOptionalSpan(
			{
				name: 'queue.enqueue',
				attributes: {
					'queue.task_type': taskType,
					'queue.priority': options?.priority ?? 0,
					'queue.max_attempts': options?.maxAttempts ?? 5,
					'queue.scheduled': options?.runAt !== undefined,
					'queue.provider': 'direct',
				},
			},
			async () => {
				const runAtMs = options?.runAt ? options.runAt.getTime() : null;
				const result = await this.engine.enqueue(
					taskType,
					payload as JsonValue,
					options?.priority ?? 0,
					runAtMs,
					options?.maxAttempts ?? 5,
					null,
				);
				return result.job.id;
			},
		);
	}

	async dequeue(taskTypes: Array<string>, limit = 1): Promise<Array<LeasedQueueJob>> {
		return this.withOptionalSpan(
			{
				name: 'queue.dequeue',
				attributes: {
					'queue.task_types': taskTypes.join(','),
					'queue.limit': limit,
					'queue.provider': 'direct',
				},
			},
			async () => {
				const leasedJobs = await this.engine.dequeue(taskTypes, limit, 0, null);
				return leasedJobs.map(
					(leasedJob): LeasedQueueJob => ({
						receipt: leasedJob.receipt,
						visibility_deadline: new Date(leasedJob.visibilityDeadlineMs).toISOString(),
						job: {
							id: leasedJob.job.id,
							task_type: leasedJob.job.taskType,
							payload: JSON.parse(Buffer.from(leasedJob.job.payload).toString('utf-8')) as WorkerJobPayload,
							priority: leasedJob.job.priority,
							run_at: new Date(leasedJob.job.runAtMs).toISOString(),
							created_at: new Date(leasedJob.job.createdAtMs).toISOString(),
							attempts: leasedJob.job.attempts,
							max_attempts: leasedJob.job.maxAttempts,
							error: leasedJob.job.error,
							deduplication_id: leasedJob.job.deduplicationId,
						},
					}),
				);
			},
		);
	}

	async upsertCron(id: string, taskType: string, payload: WorkerJobPayload, cronExpression: string): Promise<void> {
		await this.cronScheduler.upsert(id, taskType, payload as JsonValue, cronExpression);
	}

	async complete(receipt: string): Promise<void> {
		return this.withOptionalSpan(
			{
				name: 'queue.complete',
				attributes: {
					'queue.receipt': receipt,
					'queue.provider': 'direct',
				},
			},
			async () => {
				await this.engine.ack(receipt);
			},
		);
	}

	async fail(receipt: string, error: string): Promise<void> {
		return this.withOptionalSpan(
			{
				name: 'queue.fail',
				attributes: {
					'queue.receipt': receipt,
					'queue.error_message': error,
					'queue.provider': 'direct',
				},
			},
			async () => {
				await this.engine.nack(receipt, error);
			},
		);
	}

	async cancelJob(jobId: string): Promise<boolean> {
		return this.engine.deleteJob(jobId);
	}

	async retryDeadLetterJob(jobId: string): Promise<boolean> {
		const result = await this.engine.retryJob(jobId);
		return result !== null;
	}
}
