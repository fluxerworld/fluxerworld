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

import type {JsonValue} from '@fluxer/queue/src/types/JsonTypes';
import {JsonValueSchema} from '@fluxer/queue/src/types/JsonTypes';
import {z} from 'zod';

export type JobID = string & {readonly __brand: 'JobID'};
export type Receipt = string & {readonly __brand: 'Receipt'};
export type CronID = string & {readonly __brand: 'CronID'};
export type DeduplicationID = string & {readonly __brand: 'DeduplicationID'};
export function createJobID(id: string): JobID {
	return id as JobID;
}

export function createReceipt(id: string): Receipt {
	return id as Receipt;
}

export function createCronID(id: string): CronID {
	return id as CronID;
}

export function createDeduplicationID(id: string): DeduplicationID {
	return id as DeduplicationID;
}

export enum JobStatus {
	Ready = 'ready',
	Scheduled = 'scheduled',
	Inflight = 'inflight',
	DeadLetter = 'dead_letter',
}

export interface Job {
	id: JobID;
	taskType: string;
	payload: Uint8Array;
	priority: number;
	runAtMs: number;
	createdAtMs: number;
	attempts: number;
	maxAttempts: number;
	error: string | null;
	deduplicationId: DeduplicationID | null;
}

export interface LeasedJob {
	job: Job;
	receipt: Receipt;
	visibilityDeadlineMs: number;
}

export interface CronSchedule {
	id: CronID;
	taskType: string;
	payload: Uint8Array;
	cronExpression: string;
	enabled: boolean;
	lastRunMs: number | null;
	nextRunMs: number | null;
	createdAtMs: number;
	updatedAtMs: number;
}

export interface QueueStats {
	ready: number;
	processing: number;
	scheduled: number;
	deadLetter: number;
}

export interface CronStats {
	total: number;
	enabled: number;
	disabled: number;
}

export interface Stats {
	queue: QueueStats;
	cron: CronStats;
}

export interface ReadyItem {
	jobId: JobID;
	priority: number;
	runAtMs: number;
	createdAtMs: number;
	sequence: number;
}

export interface JobRecord {
	job: Job;
	status: JobStatus;
	receipt: Receipt | null;
	visibilityDeadlineMs: number | null;
}

export interface QueueSnapshot {
	version: number;
	jobs: Map<string, JobRecord>;
	cronSchedules: Map<string, CronSchedule>;
	sequenceCounter: number;
	deduplicationIndex: Map<string, string>;
	checksum: number;
}

export interface SerializableJob {
	id: JobID;
	taskType: string;
	payload: Array<number>;
	priority: number;
	runAtMs: number;
	createdAtMs: number;
	attempts: number;
	maxAttempts: number;
	error: string | null;
	deduplicationId: DeduplicationID | null;
}

export interface SerializableJobRecord {
	job: SerializableJob;
	status: JobStatus;
	receipt: Receipt | null;
	visibilityDeadlineMs: number | null;
}

export interface SerializableSnapshot {
	version: number;
	jobs: Array<[string, SerializableJobRecord]>;
	cronSchedules: Array<[string, CronSchedule]>;
	sequenceCounter: number;
	deduplicationIndex: Array<[string, string]>;
}

export const EnqueueRequestSchema = z.object({
	task_type: z.string().min(1).max(256),
	payload: JsonValueSchema,
	priority: z.number().int().min(0).max(100).default(0),
	run_at: z.iso.datetime().optional(),
	max_attempts: z.number().int().min(1).max(100).default(3),
	deduplication_id: z.string().max(256).optional(),
});

export type EnqueueRequest = z.infer<typeof EnqueueRequestSchema>;

export const DequeueQuerySchema = z.object({
	task_types: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(1),
	wait_time_ms: z.coerce.number().int().min(0).max(30000).default(0),
	visibility_timeout_ms: z.coerce.number().int().min(1000).max(43200000).optional(),
});

export type DequeueQuery = z.infer<typeof DequeueQuerySchema>;

export const AckRequestSchema = z.object({
	receipt: z.string().uuid(),
});

export type AckRequest = z.infer<typeof AckRequestSchema>;

export const NackRequestSchema = z.object({
	receipt: z.string().uuid(),
	error: z.string().max(4096).optional(),
});

export type NackRequest = z.infer<typeof NackRequestSchema>;

export const VisibilityRequestSchema = z.object({
	receipt: z.string().uuid(),
	timeout_ms: z.number().int().min(1000).max(43200000),
});

export type VisibilityRequest = z.infer<typeof VisibilityRequestSchema>;

export const UpsertCronRequestSchema = z.object({
	id: z.string().min(1).max(256),
	task_type: z.string().min(1).max(256),
	payload: JsonValueSchema,
	cron_expression: z.string().min(1).max(256),
	enabled: z.boolean().default(true),
});

export type UpsertCronRequest = z.infer<typeof UpsertCronRequestSchema>;

export const RetryJobParamsSchema = z.object({
	job_id: z.string().uuid(),
});

export type RetryJobParams = z.infer<typeof RetryJobParamsSchema>;

export const DeleteJobParamsSchema = z.object({
	job_id: z.string().uuid(),
});

export type DeleteJobParams = z.infer<typeof DeleteJobParamsSchema>;

export interface EnqueueResponse {
	job_id: string;
	task_type: string;
	priority: number;
	run_at: string;
	max_attempts: number;
	deduplication_id: string | null;
}

export interface LeasedJobResponse {
	job_id: string;
	task_type: string;
	payload: JsonValue | null;
	priority: number;
	run_at: string;
	created_at: string;
	attempts: number;
	max_attempts: number;
	receipt: string;
	visibility_deadline: string;
}

export interface DequeueResponse {
	jobs: Array<LeasedJobResponse>;
}

export interface StatsResponse {
	queue: {
		ready: number;
		processing: number;
		scheduled: number;
		dead_letter: number;
	};
	cron: {
		total: number;
		enabled: number;
		disabled: number;
	};
}

export interface CronResponse {
	id: string;
	task_type: string;
	cron_expression: string;
	enabled: boolean;
	last_run: string | null;
	next_run: string | null;
	created_at: string;
	updated_at: string;
}

export interface JobResponse {
	job_id: string;
	task_type: string;
	payload: JsonValue | null;
	priority: number;
	run_at: string;
	created_at: string;
	attempts: number;
	max_attempts: number;
	error: string | null;
	status: string;
}
