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

export type WorkerJobPayload = Record<string, unknown>;
export interface WorkerRuntimeConfig {
	workerId?: string | undefined;
	concurrency?: number | undefined;
	taskTypes?: Array<string> | undefined;
}

export interface WorkerQueueConfig {
	queueBaseUrl: string;
	requestTimeoutMs?: number | undefined;
}

export interface WorkerConfig extends WorkerRuntimeConfig, WorkerQueueConfig {}

export interface TracingInterface {
	withSpan<T>(options: {name: string; attributes?: Record<string, unknown>}, fn: () => Promise<T>): Promise<T>;
	addSpanEvent(name: string, attributes?: Record<string, unknown>): void;
	setSpanAttributes(attributes: Record<string, unknown>): void;
}

export interface MetricsServiceInterface {
	gauge(options: {name: string; value: number; tags?: Record<string, string>}): void;
	counter(options: {name: string; value: number; tags?: Record<string, string>}): void;
}

export interface QueueJob {
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

export interface LeasedQueueJob {
	receipt: string;
	visibility_deadline: string;
	job: QueueJob;
}

export interface EnqueueOptions {
	runAt?: Date | undefined;
	maxAttempts?: number | undefined;
	priority?: number | undefined;
}

export interface WorkerJobOptions {
	queueName?: string | undefined;
	runAt?: Date | undefined;
	maxAttempts?: number | undefined;
	jobKey?: string | undefined;
	priority?: number | undefined;
	flags?: Array<string> | undefined;
}
