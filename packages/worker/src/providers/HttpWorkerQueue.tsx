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

import {DEFAULT_HTTP_WORKER_TIMEOUT_MS} from '@fluxer/constants/src/Timeouts';
import type {
	EnqueueOptions,
	LeasedQueueJob,
	TracingInterface,
	WorkerJobPayload,
} from '@fluxer/worker/src/contracts/WorkerTypes';
import type {IQueueProvider} from '@fluxer/worker/src/providers/IQueueProvider';

export class HttpWorkerQueue implements IQueueProvider {
	private readonly baseUrl: string;
	private readonly timeoutMs: number;
	private readonly tracing: TracingInterface | undefined;

	constructor(options: {baseUrl: string; timeoutMs?: number | undefined; tracing?: TracingInterface | undefined}) {
		this.baseUrl = options.baseUrl;
		this.timeoutMs = options.timeoutMs ?? DEFAULT_HTTP_WORKER_TIMEOUT_MS;
		this.tracing = options.tracing;
	}

	private createTimeoutController(): AbortController {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

		(controller as {timeoutId?: NodeJS.Timeout}).timeoutId = timeoutId;

		return controller;
	}

	private async fetchWithTimeout(input: string | URL, init?: RequestInit): Promise<Response> {
		const controller = this.createTimeoutController();

		try {
			const response = await fetch(input, {
				...init,
				signal: controller.signal,
			});
			return response;
		} finally {
			const timeoutId = (controller as {timeoutId?: NodeJS.Timeout}).timeoutId;
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}
		}
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

	private addSpanEvent(name: string, attributes?: Record<string, unknown>): void {
		if (this.tracing) {
			this.tracing.addSpanEvent(name, attributes);
		}
	}

	private setSpanAttributes(attributes: Record<string, unknown>): void {
		if (this.tracing) {
			this.tracing.setSpanAttributes(attributes);
		}
	}

	async enqueue(taskType: string, payload: WorkerJobPayload, options?: EnqueueOptions): Promise<string> {
		return await this.withOptionalSpan(
			{
				name: 'queue.enqueue',
				attributes: {
					'queue.task_type': taskType,
					'queue.priority': options?.priority ?? 0,
					'queue.max_attempts': options?.maxAttempts ?? 5,
					'queue.scheduled': options?.runAt !== undefined,
					'net.peer.name': new URL(this.baseUrl).hostname,
				},
			},
			async () => {
				const body = {
					task_type: taskType,
					payload,
					priority: options?.priority ?? 0,
					run_at: options?.runAt?.toISOString(),
					max_attempts: options?.maxAttempts ?? 5,
				};

				const response = await this.fetchWithTimeout(`${this.baseUrl}/enqueue`, {
					method: 'POST',
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify(body),
				});

				if (!response.ok) {
					const text = await response.text();
					throw new Error(`Failed to enqueue job: ${response.status} ${text}`);
				}

				const jobIdResult = (await response.json()) as {job_id: string};
				this.setSpanAttributes({'queue.job_id': jobIdResult.job_id});
				return jobIdResult.job_id;
			},
		);
	}

	async dequeue(taskTypes: Array<string>, limit = 1): Promise<Array<LeasedQueueJob>> {
		return await this.withOptionalSpan(
			{
				name: 'queue.dequeue',
				attributes: {
					'queue.task_types': taskTypes.join(','),
					'queue.limit': limit,
					'queue.service': 'fluxer-queue',
				},
			},
			async () => {
				this.addSpanEvent('dequeue.start');

				const url = new URL(`${this.baseUrl}/dequeue`);
				url.searchParams.set('task_types', taskTypes.join(','));
				url.searchParams.set('limit', limit.toString());
				url.searchParams.set('wait_time_ms', '0');

				const response = await this.fetchWithTimeout(url.toString(), {method: 'GET'});

				if (!response.ok) {
					const text = await response.text();
					throw new Error(`Failed to dequeue job: ${response.status} ${text}`);
				}

				this.addSpanEvent('dequeue.parse_response');

				const jobs = (await response.json()) as Array<LeasedQueueJob>;
				const jobCount = jobs?.length ?? 0;

				this.setSpanAttributes({
					'queue.jobs_returned': jobCount,
					'queue.empty': jobCount === 0,
				});

				this.addSpanEvent('dequeue.complete');

				return jobs ?? [];
			},
		);
	}

	async upsertCron(id: string, taskType: string, payload: WorkerJobPayload, cronExpression: string): Promise<void> {
		const response = await this.fetchWithTimeout(`${this.baseUrl}/cron`, {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({id, task_type: taskType, payload, cron_expression: cronExpression}),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Failed to upsert cron job: ${response.status} ${text}`);
		}
	}

	async complete(receipt: string): Promise<void> {
		return await this.withOptionalSpan(
			{
				name: 'queue.complete',
				attributes: {
					'queue.receipt': receipt,
				},
			},
			async () => {
				const response = await this.fetchWithTimeout(`${this.baseUrl}/ack`, {
					method: 'POST',
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify({receipt}),
				});

				if (!response.ok) {
					const text = await response.text();
					throw new Error(`Failed to complete job: ${response.status} ${text}`);
				}
			},
		);
	}

	async fail(receipt: string, error: string): Promise<void> {
		return await this.withOptionalSpan(
			{
				name: 'queue.fail',
				attributes: {
					'queue.receipt': receipt,
					'queue.error_message': error,
				},
			},
			async () => {
				const response = await this.fetchWithTimeout(`${this.baseUrl}/nack`, {
					method: 'POST',
					headers: {'Content-Type': 'application/json'},
					body: JSON.stringify({receipt, error}),
				});

				if (!response.ok) {
					const text = await response.text();
					throw new Error(`Failed to fail job: ${response.status} ${text}`);
				}
			},
		);
	}

	async cancelJob(jobId: string): Promise<boolean> {
		const response = await this.fetchWithTimeout(`${this.baseUrl}/job/${jobId}`, {
			method: 'DELETE',
		});

		if (!response.ok) {
			const text = await response.text();
			if (response.status === 404) {
				return false;
			}
			throw new Error(`Failed to cancel job: ${response.status} ${text}`);
		}

		const result = (await response.json()) as {success: boolean};
		return result.success ?? true;
	}

	async retryDeadLetterJob(jobId: string): Promise<boolean> {
		const response = await this.fetchWithTimeout(`${this.baseUrl}/retry/${jobId}`, {
			method: 'POST',
		});

		if (!response.ok) {
			const text = await response.text();
			if (response.status === 404) {
				return false;
			}
			throw new Error(`Failed to retry job: ${response.status} ${text}`);
		}

		return true;
	}
}
