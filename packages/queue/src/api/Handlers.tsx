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

import type {AppEnv} from '@fluxer/queue/src/api/QueueApiTypes';
import {
	AckRequestSchema,
	DeleteJobParamsSchema,
	DequeueQuerySchema,
	EnqueueRequestSchema,
	NackRequestSchema,
	RetryJobParamsSchema,
	UpsertCronRequestSchema,
	VisibilityRequestSchema,
} from '@fluxer/queue/src/types/JobTypes';
import type {JsonValue} from '@fluxer/queue/src/types/JsonTypes';
import {JsonValueSchema} from '@fluxer/queue/src/types/JsonTypes';
import {nowMs} from '@fluxer/time/src/Clock';
import {formatRfc3339Timestamp, parseRfc3339TimestampToMs} from '@fluxer/time/src/Rfc3339Timestamp';
import type {Context} from 'hono';

interface EnqueueResponse {
	job_id: string;
	enqueued: boolean;
}

interface ApiJob {
	id: string;
	task_type: string;
	payload: JsonValue | null;
	priority: number;
	run_at: string;
	created_at: string;
	attempts: number;
	max_attempts: number;
	error: string | null;
	deduplication_id: string | null;
}

interface ApiLeasedJob {
	receipt: string;
	visibility_deadline: string;
	job: ApiJob;
}

interface QueueStatsResponse {
	ready: number;
	processing: number;
	scheduled: number;
	dead_letter: number;
}

interface CronStatsResponse {
	id: string;
	task_type: string;
	cron_expression: string;
	enabled: boolean;
	last_run_at: string | null;
	next_run_at: string;
	last_run_age_ms: number | null;
	is_overdue: boolean;
}

interface StatsResponse {
	queue: QueueStatsResponse;
	crons: Array<CronStatsResponse>;
}

interface MetricsResponse {
	queue: QueueStatsResponse;
}

interface HealthResponse {
	status: string;
}

function toApiLeasedJob(leasedJob: {
	job: {
		id: string;
		taskType: string;
		payload: Uint8Array;
		priority: number;
		runAtMs: number;
		createdAtMs: number;
		attempts: number;
		maxAttempts: number;
		error: string | null;
		deduplicationId: string | null;
	};
	receipt: string;
	visibilityDeadlineMs: number;
}): ApiLeasedJob {
	let parsedPayload: JsonValue | null;
	try {
		parsedPayload = JsonValueSchema.parse(JSON.parse(Buffer.from(leasedJob.job.payload).toString('utf-8')));
	} catch {
		parsedPayload = null;
	}

	return {
		receipt: leasedJob.receipt,
		visibility_deadline: formatRfc3339Timestamp(leasedJob.visibilityDeadlineMs),
		job: {
			id: leasedJob.job.id,
			task_type: leasedJob.job.taskType,
			payload: parsedPayload,
			priority: leasedJob.job.priority,
			run_at: formatRfc3339Timestamp(leasedJob.job.runAtMs),
			created_at: formatRfc3339Timestamp(leasedJob.job.createdAtMs),
			attempts: leasedJob.job.attempts,
			max_attempts: leasedJob.job.maxAttempts,
			error: leasedJob.job.error,
			deduplication_id: leasedJob.job.deduplicationId,
		},
	};
}

export async function enqueueJob(ctx: Context<AppEnv>): Promise<Response> {
	const queueEngine = ctx.get('queueEngine');
	const logger = ctx.get('logger');

	let body: JsonValue;
	try {
		body = await ctx.req.json<JsonValue>();
	} catch {
		return ctx.text('Error: Invalid JSON body', 400);
	}

	const parsed = EnqueueRequestSchema.safeParse(body);
	if (!parsed.success) {
		logger.warn({errors: parsed.error.issues}, 'Invalid enqueue request');
		return ctx.text('Error: invalid request body', 400);
	}

	const {task_type, payload, priority, run_at, max_attempts, deduplication_id} = parsed.data;

	const runAtMs = run_at ? parseRfc3339TimestampToMs(run_at) : null;

	try {
		const {job, enqueued} = await queueEngine.enqueue(
			task_type,
			payload,
			priority,
			runAtMs,
			max_attempts,
			deduplication_id ?? null,
		);

		const response: EnqueueResponse = {
			job_id: job.id,
			enqueued,
		};

		return ctx.json(response, 200);
	} catch (err) {
		logger.error({err, taskType: task_type}, 'Failed to enqueue job');
		return ctx.text('Error: internal server error', 500);
	}
}

export async function dequeueJobs(ctx: Context<AppEnv>): Promise<Response> {
	const queueEngine = ctx.get('queueEngine');
	const logger = ctx.get('logger');

	const query = ctx.req.query();
	const parsed = DequeueQuerySchema.safeParse({
		task_types: query['task_types'],
		limit: query['limit'],
		wait_time_ms: query['wait_time_ms'],
		visibility_timeout_ms: query['visibility_timeout_ms'],
	});

	if (!parsed.success) {
		logger.warn({errors: parsed.error.issues}, 'Invalid dequeue request');
		return ctx.text('Error: invalid request parameters', 400);
	}

	const {task_types, limit, wait_time_ms, visibility_timeout_ms} = parsed.data;

	if (!task_types || task_types.trim() === '') {
		return ctx.text('Error: task_types must not be empty', 400);
	}

	const taskTypesArray = task_types
		.split(',')
		.map((t) => t.trim())
		.filter((t) => t.length > 0);

	if (taskTypesArray.length === 0) {
		return ctx.text('Error: task_types must not be empty', 400);
	}

	const effectiveLimit = Math.min(Math.max(limit, 1), 100);
	const effectiveWaitTime = Math.min(wait_time_ms, 20000);
	const effectiveVisibilityTimeout = visibility_timeout_ms
		? Math.min(Math.max(visibility_timeout_ms, 1000), 12 * 60 * 60 * 1000)
		: null;

	try {
		const leasedJobs = await queueEngine.dequeue(
			taskTypesArray,
			effectiveLimit,
			effectiveWaitTime,
			effectiveVisibilityTimeout,
		);

		const response: Array<ApiLeasedJob> = leasedJobs.map(toApiLeasedJob);

		return ctx.json(response, 200);
	} catch (err) {
		logger.error({err}, 'Failed to dequeue jobs');
		return ctx.text('Error: internal server error', 500);
	}
}

export async function ackJob(ctx: Context<AppEnv>): Promise<Response> {
	const queueEngine = ctx.get('queueEngine');
	const logger = ctx.get('logger');

	let body: JsonValue;
	try {
		body = await ctx.req.json<JsonValue>();
	} catch {
		return ctx.text('Error: Invalid JSON body', 400);
	}

	const parsed = AckRequestSchema.safeParse(body);
	if (!parsed.success) {
		return ctx.text('Error: invalid receipt', 400);
	}

	const {receipt} = parsed.data;

	try {
		const success = await queueEngine.ack(receipt);
		if (!success) {
			return ctx.text('Error: receipt not found', 404);
		}

		return ctx.json(null, 200);
	} catch (err) {
		logger.error({err, receipt}, 'Failed to ack job');
		return ctx.text('Error: internal server error', 500);
	}
}

export async function nackJob(ctx: Context<AppEnv>): Promise<Response> {
	const queueEngine = ctx.get('queueEngine');
	const logger = ctx.get('logger');

	let body: JsonValue;
	try {
		body = await ctx.req.json<JsonValue>();
	} catch {
		return ctx.text('Error: Invalid JSON body', 400);
	}

	const parsed = NackRequestSchema.safeParse(body);
	if (!parsed.success) {
		return ctx.text('Error: invalid receipt', 400);
	}

	const {receipt, error} = parsed.data;

	try {
		const success = await queueEngine.nack(receipt, error);
		if (!success) {
			return ctx.text('Error: receipt not found', 404);
		}

		return ctx.json(null, 200);
	} catch (err) {
		logger.error({err, receipt}, 'Failed to nack job');
		return ctx.text('Error: internal server error', 500);
	}
}

export async function changeVisibility(ctx: Context<AppEnv>): Promise<Response> {
	const queueEngine = ctx.get('queueEngine');
	const logger = ctx.get('logger');

	let body: JsonValue;
	try {
		body = await ctx.req.json<JsonValue>();
	} catch {
		return ctx.text('Error: Invalid JSON body', 400);
	}

	const parsed = VisibilityRequestSchema.safeParse(body);
	if (!parsed.success) {
		return ctx.text('Error: invalid receipt', 400);
	}

	const {receipt, timeout_ms} = parsed.data;

	const effectiveTimeout = Math.min(Math.max(timeout_ms, 1000), 12 * 60 * 60 * 1000);

	try {
		const success = await queueEngine.changeVisibility(receipt, effectiveTimeout);
		if (!success) {
			return ctx.text('Error: receipt not found', 404);
		}

		return ctx.json(null, 200);
	} catch (err) {
		logger.error({err, receipt}, 'Failed to change visibility');
		return ctx.text('Error: internal server error', 500);
	}
}

export async function upsertCron(ctx: Context<AppEnv>): Promise<Response> {
	const cronScheduler = ctx.get('cronScheduler');
	const logger = ctx.get('logger');

	let body: JsonValue;
	try {
		body = await ctx.req.json<JsonValue>();
	} catch {
		return ctx.text('Error: Invalid JSON body', 400);
	}

	const parsed = UpsertCronRequestSchema.safeParse(body);
	if (!parsed.success) {
		logger.warn({errors: parsed.error.issues}, 'Invalid cron request');
		return ctx.text('Error: invalid request body', 400);
	}

	const {id, task_type, payload, cron_expression, enabled} = parsed.data;

	try {
		await cronScheduler.upsert(id, task_type, payload, cron_expression, enabled);

		return ctx.json(null, 200);
	} catch (err) {
		const message = err instanceof Error ? err.message : '';
		if (message.includes('Invalid cron expression')) {
			return ctx.text('Error: invalid cron expression', 400);
		}
		logger.error({err, id, cronExpression: cron_expression}, 'Failed to upsert cron');
		return ctx.text('Error: internal server error', 500);
	}
}

export async function retryJob(ctx: Context<AppEnv>): Promise<Response> {
	const queueEngine = ctx.get('queueEngine');
	const logger = ctx.get('logger');
	const jobId = ctx.req.param('job_id');
	const parsed = RetryJobParamsSchema.safeParse({job_id: jobId});
	if (!parsed.success) {
		return ctx.text('Error: invalid job_id', 400);
	}

	try {
		const job = await queueEngine.retryJob(parsed.data.job_id);
		if (!job) {
			return ctx.text('Error: job not found in dead letter', 404);
		}

		return ctx.json(null, 200);
	} catch (err) {
		logger.error({err, jobId: parsed.data.job_id}, 'Failed to retry job');
		return ctx.text('Error: internal server error', 500);
	}
}

export async function deleteJob(ctx: Context<AppEnv>): Promise<Response> {
	const queueEngine = ctx.get('queueEngine');
	const logger = ctx.get('logger');
	const jobId = ctx.req.param('job_id');
	const parsed = DeleteJobParamsSchema.safeParse({job_id: jobId});
	if (!parsed.success) {
		return ctx.text('Error: invalid job_id', 400);
	}

	try {
		const success = await queueEngine.deleteJob(parsed.data.job_id);
		if (!success) {
			return ctx.text('Error: job not found', 404);
		}

		return ctx.json(null, 200);
	} catch (err) {
		logger.error({err, jobId: parsed.data.job_id}, 'Failed to delete job');
		return ctx.text('Error: internal server error', 500);
	}
}

export async function getStats(ctx: Context<AppEnv>): Promise<Response> {
	const queueEngine = ctx.get('queueEngine');
	const cronScheduler = ctx.get('cronScheduler');

	const queueStats = queueEngine.getStats();
	const cronList = cronScheduler.list();
	const now = nowMs();

	const cronStats: Array<CronStatsResponse> = cronList.map((schedule) => {
		const lastRunAt = schedule.lastRunMs ? formatRfc3339Timestamp(schedule.lastRunMs) : null;
		const nextRunAt = schedule.nextRunMs ? formatRfc3339Timestamp(schedule.nextRunMs) : formatRfc3339Timestamp(now);
		const lastRunAgeMs = schedule.lastRunMs ? now - schedule.lastRunMs : null;
		const isOverdue = schedule.enabled && schedule.nextRunMs !== null && schedule.nextRunMs <= now;

		return {
			id: schedule.id,
			task_type: schedule.taskType,
			cron_expression: schedule.cronExpression,
			enabled: schedule.enabled,
			last_run_at: lastRunAt,
			next_run_at: nextRunAt,
			last_run_age_ms: lastRunAgeMs,
			is_overdue: isOverdue,
		};
	});

	const response: StatsResponse = {
		queue: {
			ready: queueStats.ready,
			processing: queueStats.processing,
			scheduled: queueStats.scheduled,
			dead_letter: queueStats.deadLetter,
		},
		crons: cronStats,
	};

	return ctx.json(response, 200);
}

export async function getMetrics(ctx: Context<AppEnv>): Promise<Response> {
	const queueEngine = ctx.get('queueEngine');

	const queueStats = queueEngine.getStats();

	const response: MetricsResponse = {
		queue: {
			ready: queueStats.ready,
			processing: queueStats.processing,
			scheduled: queueStats.scheduled,
			dead_letter: queueStats.deadLetter,
		},
	};

	return ctx.json(response, 200);
}

export async function healthCheck(ctx: Context<AppEnv>): Promise<Response> {
	const response: HealthResponse = {
		status: 'ok',
	};
	return ctx.json(response, 200);
}
