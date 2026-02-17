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

import * as fs from 'node:fs/promises';
import type {LoggerFactory} from '@fluxer/logger/src/LoggerInterface';
import {createMockLogger} from '@fluxer/logger/src/mock';
import {QueueEngine} from '@fluxer/queue/src/engine/QueueEngine';
import {JobStatus} from '@fluxer/queue/src/types/JobTypes';
import type {QueueConfig} from '@fluxer/queue/src/types/QueueConfig';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const testRoot = `/tmp/fluxer-queue-engine-test-${Date.now()}`;

function createTestConfig(overrides: Partial<QueueConfig> = {}): QueueConfig {
	return {
		dataDir: testRoot,
		snapshotEveryMs: 60000,
		snapshotAfterOps: 100000,
		snapshotZstdLevel: 3,
		defaultVisibilityTimeoutMs: 30000,
		visibilityTimeoutBackoffMs: 10000,
		maxReceiveBatch: 100,
		commandBuffer: 8192,
		...overrides,
	};
}

function createLoggerFactory(): LoggerFactory {
	const mockLogger = createMockLogger();
	return () => mockLogger;
}

describe('QueueEngine', () => {
	let engine: QueueEngine;
	let config: QueueConfig;

	beforeEach(async () => {
		vi.useFakeTimers();
		await fs.rm(testRoot, {recursive: true, force: true});
		config = createTestConfig();
		engine = new QueueEngine(config, createLoggerFactory());
		await engine.start();
	});

	afterEach(async () => {
		vi.useRealTimers();
		await engine.stop();
		await fs.rm(testRoot, {recursive: true, force: true});
	});

	describe('enqueue', () => {
		it('should enqueue a job with default values', async () => {
			const result = await engine.enqueue('test-task', {message: 'hello'});

			expect(result.enqueued).toBe(true);
			expect(result.job.taskType).toBe('test-task');
			expect(result.job.priority).toBe(0);
			expect(result.job.attempts).toBe(0);
			expect(result.job.maxAttempts).toBe(3);
		});

		it('should enqueue a job with custom priority', async () => {
			const result = await engine.enqueue('test-task', {}, 10);

			expect(result.enqueued).toBe(true);
			expect(result.job.priority).toBe(10);
		});

		it('should enqueue a scheduled job', async () => {
			const now = Date.now();
			const runAt = now + 60000;
			const result = await engine.enqueue('test-task', {}, 0, runAt);

			expect(result.enqueued).toBe(true);
			expect(result.job.runAtMs).toBe(runAt);

			const stats = engine.getStats();
			expect(stats.scheduled).toBe(1);
			expect(stats.ready).toBe(0);
		});

		it('should enqueue a job with custom max attempts', async () => {
			const result = await engine.enqueue('test-task', {}, 0, null, 5);

			expect(result.enqueued).toBe(true);
			expect(result.job.maxAttempts).toBe(5);
		});

		it('should clamp max attempts to valid range', async () => {
			const resultLow = await engine.enqueue('test-task', {}, 0, null, 0);
			const resultHigh = await engine.enqueue('test-task', {}, 0, null, 9999);

			expect(resultLow.job.maxAttempts).toBe(1);
			expect(resultHigh.job.maxAttempts).toBe(1000);
		});

		it('should handle deduplication', async () => {
			const result1 = await engine.enqueue('test-task', {}, 0, null, 3, 'unique-key');
			const result2 = await engine.enqueue('test-task', {}, 0, null, 3, 'unique-key');

			expect(result1.enqueued).toBe(true);
			expect(result2.enqueued).toBe(false);
			expect(result2.job.id).toBe(result1.job.id);
		});

		it('should allow re-enqueue with same deduplication key after job completes', async () => {
			const result1 = await engine.enqueue('test-task', {}, 0, null, 3, 'unique-key');
			expect(result1.enqueued).toBe(true);

			const jobs = await engine.dequeue(null, 1, 0, 5000);
			expect(jobs).toHaveLength(1);

			await engine.ack(jobs[0].receipt);

			const result2 = await engine.enqueue('test-task', {}, 0, null, 3, 'unique-key');
			expect(result2.enqueued).toBe(true);
			expect(result2.job.id).not.toBe(result1.job.id);
		});
	});

	describe('dequeue', () => {
		it('should return empty array when queue is empty', async () => {
			const jobs = await engine.dequeue(null, 10, 0, 5000);

			expect(jobs).toHaveLength(0);
		});

		it('should dequeue a single job', async () => {
			await engine.enqueue('test-task', {message: 'hello'});

			const jobs = await engine.dequeue(null, 10, 0, 5000);

			expect(jobs).toHaveLength(1);
			expect(jobs[0].job.taskType).toBe('test-task');
			expect(jobs[0].receipt).toBeTruthy();
		});

		it('should dequeue multiple jobs respecting limit', async () => {
			for (let i = 0; i < 5; i++) {
				await engine.enqueue('test-task', {index: i});
			}

			const jobs = await engine.dequeue(null, 3, 0, 5000);

			expect(jobs).toHaveLength(3);
		});

		it('should filter by task type', async () => {
			await engine.enqueue('type-a', {});
			await engine.enqueue('type-b', {});
			await engine.enqueue('type-a', {});

			const jobs = await engine.dequeue(['type-a'], 10, 0, 5000);

			expect(jobs).toHaveLength(2);
			jobs.forEach((job) => {
				expect(job.job.taskType).toBe('type-a');
			});
		});

		it('should increment attempt count on dequeue', async () => {
			await engine.enqueue('test-task', {});

			const jobs = await engine.dequeue(null, 1, 0, 5000);

			expect(jobs[0].job.attempts).toBe(1);
		});

		it('should set visibility deadline', async () => {
			const visibilityTimeout = 10000;
			await engine.enqueue('test-task', {});

			const jobs = await engine.dequeue(null, 1, 0, visibilityTimeout);
			const now = Date.now();

			expect(jobs[0].visibilityDeadlineMs).toBeGreaterThanOrEqual(now);
			expect(jobs[0].visibilityDeadlineMs).toBeLessThanOrEqual(now + visibilityTimeout + 100);
		});

		it('should dequeue jobs in priority order', async () => {
			await engine.enqueue('low-priority', {}, 1);
			await engine.enqueue('high-priority', {}, 10);
			await engine.enqueue('medium-priority', {}, 5);

			const jobs = await engine.dequeue(null, 3, 0, 5000);

			expect(jobs[0].job.taskType).toBe('high-priority');
			expect(jobs[1].job.taskType).toBe('medium-priority');
			expect(jobs[2].job.taskType).toBe('low-priority');
		});

		it('should not return scheduled jobs before their run time', async () => {
			const now = Date.now();
			await engine.enqueue('scheduled-task', {}, 0, now + 60000);

			const jobs = await engine.dequeue(null, 10, 0, 5000);

			expect(jobs).toHaveLength(0);
		});

		it('should return scheduled jobs after their run time', async () => {
			const now = Date.now();
			await engine.enqueue('scheduled-task', {}, 0, now + 1000);

			vi.advanceTimersByTime(2000);

			const jobs = await engine.dequeue(null, 10, 0, 5000);

			expect(jobs).toHaveLength(1);
			expect(jobs[0].job.taskType).toBe('scheduled-task');
		});
	});

	describe('ack', () => {
		it('should acknowledge a job and remove it from the queue', async () => {
			await engine.enqueue('test-task', {});
			const jobs = await engine.dequeue(null, 1, 0, 5000);

			const result = await engine.ack(jobs[0].receipt);

			expect(result).toBe(true);

			const stats = engine.getStats();
			expect(stats.ready).toBe(0);
			expect(stats.processing).toBe(0);
		});

		it('should return false for invalid receipt', async () => {
			const result = await engine.ack('invalid-receipt');

			expect(result).toBe(false);
		});

		it('should clear deduplication index on ack', async () => {
			await engine.enqueue('test-task', {}, 0, null, 3, 'unique-key');
			const jobs = await engine.dequeue(null, 1, 0, 5000);
			await engine.ack(jobs[0].receipt);

			const result = await engine.enqueue('test-task', {}, 0, null, 3, 'unique-key');

			expect(result.enqueued).toBe(true);
		});
	});

	describe('nack', () => {
		it('should nack a job and schedule it for retry', async () => {
			await engine.enqueue('test-task', {}, 0, null, 3);
			const jobs = await engine.dequeue(null, 1, 0, 5000);

			const result = await engine.nack(jobs[0].receipt, 'processing error');

			expect(result).toBe(true);

			const stats = engine.getStats();
			expect(stats.processing).toBe(0);
			expect(stats.scheduled).toBe(1);
		});

		it('should return false for invalid receipt', async () => {
			const result = await engine.nack('invalid-receipt');

			expect(result).toBe(false);
		});

		it('should move job to dead letter after max attempts', async () => {
			await engine.enqueue('test-task', {}, 0, null, 1);
			const jobs = await engine.dequeue(null, 1, 0, 5000);

			await engine.nack(jobs[0].receipt, 'failed');

			const stats = engine.getStats();
			expect(stats.deadLetter).toBe(1);
		});

		it('should store error message on job', async () => {
			await engine.enqueue('test-task', {}, 0, null, 1);
			const jobs = await engine.dequeue(null, 1, 0, 5000);

			await engine.nack(jobs[0].receipt, 'custom error');

			const jobRecord = engine.getJob(jobs[0].job.id);
			expect(jobRecord?.job.error).toBe('custom error');
		});

		it('should schedule retry with exponential backoff', async () => {
			await engine.enqueue('test-task', {}, 0, null, 5);

			const jobs1 = await engine.dequeue(null, 1, 0, 5000);
			await engine.nack(jobs1[0].receipt);

			const jobRecord = engine.getJob(jobs1[0].job.id);
			expect(jobRecord?.status).toBe(JobStatus.Scheduled);
		});
	});

	describe('changeVisibility', () => {
		it('should extend visibility timeout', async () => {
			await engine.enqueue('test-task', {});
			const jobs = await engine.dequeue(null, 1, 0, 5000);
			const originalDeadline = jobs[0].visibilityDeadlineMs;

			const result = await engine.changeVisibility(jobs[0].receipt, 60000);

			expect(result).toBe(true);

			const jobRecord = engine.getJob(jobs[0].job.id);
			expect(jobRecord?.visibilityDeadlineMs).toBeGreaterThan(originalDeadline);
		});

		it('should return false for invalid receipt', async () => {
			const result = await engine.changeVisibility('invalid-receipt', 60000);

			expect(result).toBe(false);
		});

		it('should return false for non-inflight job', async () => {
			await engine.enqueue('test-task', {});
			const jobs = await engine.dequeue(null, 1, 0, 5000);
			await engine.ack(jobs[0].receipt);

			const result = await engine.changeVisibility(jobs[0].receipt, 60000);

			expect(result).toBe(false);
		});
	});

	describe('retryJob', () => {
		it('should retry a dead letter job', async () => {
			await engine.enqueue('test-task', {}, 0, null, 1);
			const jobs = await engine.dequeue(null, 1, 0, 5000);
			await engine.nack(jobs[0].receipt);

			const stats1 = engine.getStats();
			expect(stats1.deadLetter).toBe(1);

			const retried = await engine.retryJob(jobs[0].job.id);

			expect(retried).not.toBeNull();
			expect(retried?.attempts).toBe(0);

			const stats2 = engine.getStats();
			expect(stats2.deadLetter).toBe(0);
			expect(stats2.ready).toBe(1);
		});

		it('should return null for non-dead-letter job', async () => {
			await engine.enqueue('test-task', {});

			const jobs = await engine.dequeue(null, 1, 0, 5000);
			const retried = await engine.retryJob(jobs[0].job.id);

			expect(retried).toBeNull();
		});

		it('should return null for non-existent job', async () => {
			const retried = await engine.retryJob('non-existent-id');

			expect(retried).toBeNull();
		});
	});

	describe('deleteJob', () => {
		it('should delete a ready job', async () => {
			const {job} = await engine.enqueue('test-task', {});

			const result = await engine.deleteJob(job.id);

			expect(result).toBe(true);
			expect(engine.getJob(job.id)).toBeNull();
		});

		it('should delete a scheduled job', async () => {
			const now = Date.now();
			const {job} = await engine.enqueue('test-task', {}, 0, now + 60000);

			const result = await engine.deleteJob(job.id);

			expect(result).toBe(true);
			expect(engine.getJob(job.id)).toBeNull();
		});

		it('should delete an inflight job', async () => {
			await engine.enqueue('test-task', {});
			const jobs = await engine.dequeue(null, 1, 0, 5000);

			const result = await engine.deleteJob(jobs[0].job.id);

			expect(result).toBe(true);
			expect(engine.getJob(jobs[0].job.id)).toBeNull();
		});

		it('should delete a dead letter job', async () => {
			await engine.enqueue('test-task', {}, 0, null, 1);
			const jobs = await engine.dequeue(null, 1, 0, 5000);
			await engine.nack(jobs[0].receipt);

			const result = await engine.deleteJob(jobs[0].job.id);

			expect(result).toBe(true);
			expect(engine.getJob(jobs[0].job.id)).toBeNull();
		});

		it('should return false for non-existent job', async () => {
			const result = await engine.deleteJob('non-existent');

			expect(result).toBe(false);
		});

		it('should clear deduplication index on delete', async () => {
			const {job} = await engine.enqueue('test-task', {}, 0, null, 3, 'unique-key');
			await engine.deleteJob(job.id);

			const result = await engine.enqueue('test-task', {}, 0, null, 3, 'unique-key');

			expect(result.enqueued).toBe(true);
		});
	});

	describe('getStats', () => {
		it('should return correct counts', async () => {
			const now = Date.now();

			await engine.enqueue('ready-1', {});
			await engine.enqueue('ready-2', {});
			await engine.enqueue('scheduled-1', {}, 0, now + 60000);
			await engine.enqueue('to-process', {});
			await engine.enqueue('to-deadletter', {}, 0, null, 1);

			const jobs = await engine.dequeue(['to-process'], 1, 0, 5000);
			expect(jobs).toHaveLength(1);

			const dlJobs = await engine.dequeue(['to-deadletter'], 1, 0, 5000);
			expect(dlJobs).toHaveLength(1);
			await engine.nack(dlJobs[0].receipt);

			const stats = engine.getStats();

			expect(stats.ready).toBe(2);
			expect(stats.scheduled).toBe(1);
			expect(stats.processing).toBe(1);
			expect(stats.deadLetter).toBe(1);
		});
	});

	describe('getJob', () => {
		it('should return job record', async () => {
			const {job} = await engine.enqueue('test-task', {message: 'hello'});

			const record = engine.getJob(job.id);

			expect(record).not.toBeNull();
			expect(record?.job.id).toBe(job.id);
			expect(record?.status).toBe(JobStatus.Ready);
		});

		it('should return null for non-existent job', async () => {
			const record = engine.getJob('non-existent');

			expect(record).toBeNull();
		});
	});

	describe('resetState', () => {
		it('should clear all state', async () => {
			await engine.enqueue('task-1', {});
			await engine.enqueue('task-2', {});
			await engine.enqueue('task-3', {}, 0, Date.now() + 60000);

			await engine.resetState();

			const stats = engine.getStats();
			expect(stats.ready).toBe(0);
			expect(stats.scheduled).toBe(0);
			expect(stats.processing).toBe(0);
			expect(stats.deadLetter).toBe(0);
		});
	});
});

describe('QueueEngine visibility timeout', () => {
	let engine: QueueEngine;
	let config: QueueConfig;

	beforeEach(async () => {
		vi.useFakeTimers();
		await fs.rm(testRoot, {recursive: true, force: true});
		config = createTestConfig({
			defaultVisibilityTimeoutMs: 5000,
			visibilityTimeoutBackoffMs: 1000,
		});
		engine = new QueueEngine(config, createLoggerFactory());
		await engine.start();
	});

	afterEach(async () => {
		vi.useRealTimers();
		await engine.stop();
		await fs.rm(testRoot, {recursive: true, force: true});
	});

	it('should return job to ready queue after visibility timeout expires', async () => {
		await engine.enqueue('test-task', {}, 0, null, 3);
		const jobs = await engine.dequeue(null, 1, 0, 5000);
		expect(jobs).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(6000);

		const stats = engine.getStats();
		expect(stats.processing).toBe(0);

		const jobRecord = engine.getJob(jobs[0].job.id);
		expect(jobRecord).not.toBeNull();
		expect(jobRecord?.status).toBe(JobStatus.Ready);
		expect(jobRecord?.job.error).toBe('visibility timeout');
		expect(jobRecord?.job.attempts).toBe(1);
	});

	it('should move job to dead letter after max attempts with visibility timeout', async () => {
		await engine.enqueue('test-task', {}, 0, null, 1);

		const jobs = await engine.dequeue(null, 1, 0, 5000);
		expect(jobs).toHaveLength(1);

		await vi.advanceTimersByTimeAsync(6000);

		const stats = engine.getStats();
		expect(stats.deadLetter).toBe(1);
	});
});

describe('QueueEngine concurrency', () => {
	let engine: QueueEngine;
	let config: QueueConfig;

	beforeEach(async () => {
		await fs.rm(testRoot, {recursive: true, force: true});
		config = createTestConfig();
		engine = new QueueEngine(config, createLoggerFactory());
		await engine.start();
	});

	afterEach(async () => {
		await engine.stop();
		await fs.rm(testRoot, {recursive: true, force: true});
	});

	it('should handle concurrent enqueue operations', async () => {
		const promises: Array<Promise<{job: {id: string}; enqueued: boolean}>> = [];
		for (let i = 0; i < 100; i++) {
			promises.push(engine.enqueue(`task-${i}`, {index: i}));
		}

		const results = await Promise.all(promises);

		expect(results.every((r) => r.enqueued)).toBe(true);

		const stats = engine.getStats();
		expect(stats.ready).toBe(100);
	});

	it('should handle concurrent dequeue operations', async () => {
		for (let i = 0; i < 50; i++) {
			await engine.enqueue(`task-${i}`, {index: i});
		}

		const dequeuePromises: Array<Promise<Array<{job: {id: string}}>>> = [];
		for (let i = 0; i < 10; i++) {
			dequeuePromises.push(engine.dequeue(null, 10, 0, 5000));
		}

		const results = await Promise.all(dequeuePromises);
		const allJobs = results.flat();

		expect(allJobs.length).toBe(50);

		const jobIds = new Set(allJobs.map((j) => j.job.id));
		expect(jobIds.size).toBe(50);
	});

	it('should handle mixed enqueue and dequeue operations', async () => {
		const operations: Array<Promise<unknown>> = [];

		for (let i = 0; i < 50; i++) {
			operations.push(engine.enqueue(`task-${i}`, {index: i}));
		}

		for (let i = 0; i < 10; i++) {
			operations.push(engine.dequeue(null, 5, 0, 5000));
		}

		await Promise.all(operations);

		const stats = engine.getStats();
		expect(stats.ready + stats.processing).toBe(50);
	});
});
