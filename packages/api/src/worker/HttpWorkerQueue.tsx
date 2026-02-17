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

import {Config} from '@fluxer/api/src/Config';
import {addSpanEvent, setSpanAttributes, withSpan} from '@fluxer/api/src/telemetry/Tracing';
import type {WorkerJobPayload} from '@fluxer/worker/src/contracts/WorkerTypes';
import {ms} from 'itty-time';

let _queueBaseUrl: string | null = null;
function getQueueBaseUrl(): string {
	if (!_queueBaseUrl) {
		_queueBaseUrl = Config.queue.baseUrl;
	}
	return _queueBaseUrl;
}

function getRequestHeaders(): Record<string, string> {
	const headers: Record<string, string> = {'Content-Type': 'application/json'};
	if (Config.queue.authSecret) {
		headers.Authorization = `Bearer ${Config.queue.authSecret}`;
	}
	return headers;
}

function getAuthHeaders(): Record<string, string> | undefined {
	if (Config.queue.authSecret) {
		return {Authorization: `Bearer ${Config.queue.authSecret}`};
	}
	return undefined;
}

interface QueueJob {
	id: string;
	task_type: string;
	payload: WorkerJobPayload;
	priority: number;
	run_at: string;
	created_at: string;
	attempts: number;
	max_attempts: number;
	error?: string | null;
	deduplication_id?: string | null;
}

interface LeasedQueueJob {
	receipt: string;
	visibility_deadline: string;
	job: QueueJob;
}

export class HttpWorkerQueue {
	private createTimeoutController(): AbortController {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), ms('30 seconds'));

		(controller as {timeoutId?: NodeJS.Timeout}).timeoutId = timeoutId;

		return controller;
	}

	private async fetchWithTimeout(input: string | URL | Request, init?: RequestInit): Promise<Response> {
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
	async enqueue(
		taskType: string,
		payload: WorkerJobPayload,
		options?: {
			runAt?: Date;
			maxAttempts?: number;
			priority?: number;
		},
	): Promise<string> {
		return await withSpan(
			{
				name: 'queue.enqueue',
				attributes: {
					'queue.task_type': taskType,
					'queue.priority': options?.priority ?? 0,
					'queue.max_attempts': options?.maxAttempts ?? 5,
					'queue.scheduled': options?.runAt !== undefined,
					'net.peer.name': new URL(getQueueBaseUrl()).hostname,
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

				const response = await this.fetchWithTimeout(`${getQueueBaseUrl()}/enqueue`, {
					method: 'POST',
					headers: getRequestHeaders(),
					body: JSON.stringify(body),
				});

				if (!response.ok) {
					const text = await response.text();
					throw new Error(`Failed to enqueue job: ${response.status} ${text}`);
				}

				const jobIdResult = (await response.json()) as {job_id: string};
				setSpanAttributes({'queue.job_id': jobIdResult.job_id});
				return jobIdResult.job_id;
			},
		);
	}

	async dequeue(taskTypes: Array<string>, limit = 1): Promise<Array<LeasedQueueJob>> {
		return await withSpan(
			{
				name: 'queue.dequeue',
				attributes: {
					'queue.task_types': taskTypes.join(','),
					'queue.limit': limit,
					'queue.service': 'fluxer-queue',
				},
			},
			async () => {
				addSpanEvent('dequeue.start');

				const url = new URL(`${getQueueBaseUrl()}/dequeue`);
				url.searchParams.set('task_types', taskTypes.join(','));
				url.searchParams.set('limit', limit.toString());
				url.searchParams.set('wait_time_ms', '5000');

				const response = await this.fetchWithTimeout(url.toString(), {method: 'GET', headers: getAuthHeaders()});

				if (!response.ok) {
					const text = await response.text();
					throw new Error(`Failed to dequeue job: ${response.status} ${text}`);
				}

				addSpanEvent('dequeue.parse_response');

				const jobs = (await response.json()) as Array<LeasedQueueJob>;
				const jobCount = jobs?.length ?? 0;

				setSpanAttributes({
					'queue.jobs_returned': jobCount,
					'queue.empty': jobCount === 0,
				});

				addSpanEvent('dequeue.complete');

				return jobs ?? [];
			},
		);
	}

	async upsertCron(id: string, taskType: string, payload: WorkerJobPayload, cronExpression: string): Promise<void> {
		const response = await this.fetchWithTimeout(`${getQueueBaseUrl()}/cron`, {
			method: 'POST',
			headers: getRequestHeaders(),
			body: JSON.stringify({id, task_type: taskType, payload, cron_expression: cronExpression}),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Failed to upsert cron job: ${response.status} ${text}`);
		}
	}

	async complete(receipt: string): Promise<void> {
		return await withSpan(
			{
				name: 'queue.complete',
				attributes: {
					'queue.receipt': receipt,
				},
			},
			async () => {
				const response = await this.fetchWithTimeout(`${getQueueBaseUrl()}/ack`, {
					method: 'POST',
					headers: getRequestHeaders(),
					body: JSON.stringify({receipt}),
				});

				if (!response.ok) {
					const text = await response.text();
					throw new Error(`Failed to complete job: ${response.status} ${text}`);
				}
			},
		);
	}

	async extendVisibility(receipt: string, additionalMs: number): Promise<void> {
		return await withSpan(
			{
				name: 'queue.extend_visibility',
				attributes: {
					'queue.receipt': receipt,
					'queue.additional_ms': additionalMs,
				},
			},
			async () => {
				const response = await this.fetchWithTimeout(`${getQueueBaseUrl()}/extend`, {
					method: 'POST',
					headers: getRequestHeaders(),
					body: JSON.stringify({receipt, additional_ms: additionalMs}),
				});

				if (!response.ok) {
					const text = await response.text();
					throw new Error(`Failed to extend visibility: ${response.status} ${text}`);
				}
			},
		);
	}

	async fail(receipt: string, error: string): Promise<void> {
		return await withSpan(
			{
				name: 'queue.fail',
				attributes: {
					'queue.receipt': receipt,
					'queue.error_message': error,
				},
			},
			async () => {
				const response = await this.fetchWithTimeout(`${getQueueBaseUrl()}/nack`, {
					method: 'POST',
					headers: getRequestHeaders(),
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
		const response = await this.fetchWithTimeout(`${getQueueBaseUrl()}/job/${jobId}`, {
			method: 'DELETE',
			headers: getAuthHeaders(),
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
		const response = await this.fetchWithTimeout(`${getQueueBaseUrl()}/retry/${jobId}`, {
			method: 'POST',
			headers: getAuthHeaders(),
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
