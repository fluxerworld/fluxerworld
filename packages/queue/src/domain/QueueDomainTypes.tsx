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

export interface EnqueueResult {
	job: Job;
	enqueued: boolean;
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
	sequenceCounter: number;
	deduplicationIndex: Array<[string, string]>;
}
