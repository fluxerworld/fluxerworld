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
import {CronScheduler, type QueueEngineClient} from '@fluxer/queue/src/cron/CronScheduler';
import type {JsonValue} from '@fluxer/queue/src/types/JsonTypes';
import type {QueueConfig} from '@fluxer/queue/src/types/QueueConfig';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const testRoot = `/tmp/fluxer-cron-scheduler-test-${Date.now()}`;

interface EnqueueCall {
	taskType: string;
	payload: JsonValue;
	priority?: number;
	runAtMs?: number | null;
	maxAttempts?: number;
	deduplicationId?: string | null;
}

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

function createMockQueueEngine(): QueueEngineClient & {calls: Array<EnqueueCall>} {
	const calls: Array<EnqueueCall> = [];
	let jobIdCounter = 0;

	return {
		calls,
		async enqueue(taskType, payload, priority, runAtMs, maxAttempts, deduplicationId) {
			calls.push({taskType, payload, priority, runAtMs, maxAttempts, deduplicationId});
			return {job: {id: `job-${++jobIdCounter}`}, enqueued: true};
		},
	};
}

describe('CronScheduler', () => {
	let scheduler: CronScheduler;
	let config: QueueConfig;
	let mockQueueEngine: QueueEngineClient & {calls: Array<EnqueueCall>};

	beforeEach(async () => {
		vi.useFakeTimers();
		await fs.rm(testRoot, {recursive: true, force: true});
		await fs.mkdir(testRoot, {recursive: true});
		config = createTestConfig();
		mockQueueEngine = createMockQueueEngine();
		scheduler = new CronScheduler(config, mockQueueEngine, createLoggerFactory());
		await scheduler.start();
	});

	afterEach(async () => {
		vi.useRealTimers();
		await scheduler.stop();
		await fs.rm(testRoot, {recursive: true, force: true});
	});

	describe('upsert', () => {
		it('should create a new schedule', async () => {
			const schedule = await scheduler.upsert('test-cron', 'test-task', {key: 'value'}, '* * * * *', true);

			expect(schedule.id).toBe('test-cron');
			expect(schedule.taskType).toBe('test-task');
			expect(schedule.cronExpression).toBe('* * * * *');
			expect(schedule.enabled).toBe(true);
			expect(schedule.nextRunMs).not.toBeNull();
		});

		it('should update an existing schedule', async () => {
			await scheduler.upsert('test-cron', 'task-v1', {}, '* * * * *', true);
			const updated = await scheduler.upsert('test-cron', 'task-v2', {updated: true}, '0 * * * *', true);

			expect(updated.taskType).toBe('task-v2');
			expect(updated.cronExpression).toBe('0 * * * *');

			const list = scheduler.list();
			expect(list).toHaveLength(1);
		});

		it('should preserve lastRunMs when updating', async () => {
			await scheduler.upsert('test-cron', 'test-task', {}, '* * * * *', true);

			vi.advanceTimersByTime(120000);

			const before = scheduler.get('test-cron');
			const lastRunMs = before?.lastRunMs;

			const updated = await scheduler.upsert('test-cron', 'test-task', {updated: true}, '* * * * *', true);

			expect(updated.lastRunMs).toBe(lastRunMs);
		});

		it('should not rewrite an unchanged schedule', async () => {
			const original = await scheduler.upsert('test-cron', 'test-task', {unchanged: true}, '* * * * *', true);
			const originalUpdatedAtMs = original.updatedAtMs;

			vi.advanceTimersByTime(1000);

			const unchanged = await scheduler.upsert('test-cron', 'test-task', {unchanged: true}, '* * * * *', true);

			expect(unchanged).toBe(original);
			expect(unchanged.updatedAtMs).toBe(originalUpdatedAtMs);
			expect(scheduler.list()).toHaveLength(1);
		});

		it('should throw error for invalid cron expression', async () => {
			await expect(scheduler.upsert('test-cron', 'test-task', {}, 'invalid cron', true)).rejects.toThrow(
				'Invalid cron expression',
			);
		});

		it('should set nextRunMs to null for disabled schedules', async () => {
			const schedule = await scheduler.upsert('test-cron', 'test-task', {}, '* * * * *', false);

			expect(schedule.enabled).toBe(false);
			expect(schedule.nextRunMs).toBeNull();
		});
	});

	describe('delete', () => {
		it('should delete an existing schedule', async () => {
			await scheduler.upsert('test-cron', 'test-task', {}, '* * * * *', true);

			const result = await scheduler.delete('test-cron');

			expect(result).toBe(true);
			expect(scheduler.get('test-cron')).toBeNull();
		});

		it('should return false when deleting non-existent schedule', async () => {
			const result = await scheduler.delete('non-existent');

			expect(result).toBe(false);
		});
	});

	describe('get', () => {
		it('should return a schedule by id', async () => {
			await scheduler.upsert('test-cron', 'test-task', {}, '* * * * *', true);

			const schedule = scheduler.get('test-cron');

			expect(schedule).not.toBeNull();
			expect(schedule?.id).toBe('test-cron');
		});

		it('should return null for non-existent schedule', () => {
			const schedule = scheduler.get('non-existent');

			expect(schedule).toBeNull();
		});
	});

	describe('list', () => {
		it('should return empty array when no schedules exist', () => {
			const schedules = scheduler.list();

			expect(schedules).toHaveLength(0);
		});

		it('should return all schedules', async () => {
			await scheduler.upsert('cron-1', 'task-1', {}, '* * * * *', true);
			await scheduler.upsert('cron-2', 'task-2', {}, '0 * * * *', true);
			await scheduler.upsert('cron-3', 'task-3', {}, '0 0 * * *', false);

			const schedules = scheduler.list();

			expect(schedules).toHaveLength(3);
		});
	});

	describe('getStats', () => {
		it('should return correct counts', async () => {
			await scheduler.upsert('cron-1', 'task-1', {}, '0 0 1 1 *', true);
			await scheduler.upsert('cron-2', 'task-2', {}, '0 0 2 1 *', true);
			await scheduler.upsert('cron-3', 'task-3', {}, '0 0 3 1 *', false);
			await scheduler.upsert('cron-4', 'task-4', {}, '0 0 4 1 *', false);

			const stats = scheduler.getStats();

			expect(stats.total).toBe(4);
			expect(stats.enabled).toBe(2);
			expect(stats.disabled).toBe(2);
		});

		it('should return zero counts for empty scheduler', () => {
			const stats = scheduler.getStats();

			expect(stats.total).toBe(0);
			expect(stats.enabled).toBe(0);
			expect(stats.disabled).toBe(0);
		});
	});

	describe('cron execution', () => {
		it('should enqueue job when cron fires', async () => {
			await scheduler.upsert('test-cron', 'test-task', {message: 'hello'}, '* * * * *', true);

			vi.advanceTimersByTime(120000);

			expect(mockQueueEngine.calls.length).toBeGreaterThan(0);
			expect(mockQueueEngine.calls[0].taskType).toBe('test-task');
		});

		it('should not enqueue job for disabled schedule', async () => {
			await scheduler.upsert('test-cron', 'test-task', {}, '* * * * *', false);

			vi.advanceTimersByTime(120000);

			expect(mockQueueEngine.calls).toHaveLength(0);
		});

		it('should update lastRunMs after execution', async () => {
			await scheduler.upsert('test-cron', 'test-task', {}, '* * * * *', true);

			const before = scheduler.get('test-cron');
			expect(before?.lastRunMs).toBeNull();

			await vi.advanceTimersByTimeAsync(120000);

			const after = scheduler.get('test-cron');
			expect(after?.lastRunMs).not.toBeNull();
		});

		it('should update nextRunMs after execution', async () => {
			await scheduler.upsert('test-cron', 'test-task', {}, '* * * * *', true);

			const before = scheduler.get('test-cron');
			const nextRunBefore = before?.nextRunMs;

			await vi.advanceTimersByTimeAsync(120000);

			const after = scheduler.get('test-cron');
			expect(after?.nextRunMs).toBeGreaterThan(nextRunBefore!);
		});

		it('should handle multiple schedules', async () => {
			await scheduler.upsert('cron-1', 'task-1', {}, '* * * * *', true);
			await scheduler.upsert('cron-2', 'task-2', {}, '* * * * *', true);

			await vi.advanceTimersByTimeAsync(120000);

			const taskTypes = mockQueueEngine.calls.map((c) => c.taskType);
			expect(taskTypes).toContain('task-1');
			expect(taskTypes).toContain('task-2');
		});
	});

	describe('cron expressions', () => {
		it('should support standard cron expressions', async () => {
			await scheduler.upsert('minutely', 'task', {}, '* * * * *', true);
			await scheduler.upsert('hourly', 'task', {}, '0 * * * *', true);
			await scheduler.upsert('daily', 'task', {}, '0 0 * * *', true);
			await scheduler.upsert('weekly', 'task', {}, '0 0 * * 0', true);
			await scheduler.upsert('monthly', 'task', {}, '0 0 1 * *', true);

			const schedules = scheduler.list();
			expect(schedules).toHaveLength(5);
			schedules.forEach((s) => {
				expect(s.nextRunMs).not.toBeNull();
			});
		});

		it('should support specific minute patterns', async () => {
			await scheduler.upsert('every-5-min', 'task', {}, '*/5 * * * *', true);
			await scheduler.upsert('at-15-30', 'task', {}, '15,30 * * * *', true);
			await scheduler.upsert('range', 'task', {}, '0-10 * * * *', true);

			const schedules = scheduler.list();
			expect(schedules).toHaveLength(3);
			schedules.forEach((s) => {
				expect(s.nextRunMs).not.toBeNull();
			});
		});
	});
});

describe('CronScheduler persistence', () => {
	let config: QueueConfig;
	let mockQueueEngine: QueueEngineClient & {calls: Array<EnqueueCall>};

	beforeEach(async () => {
		vi.useFakeTimers();
		await fs.rm(testRoot, {recursive: true, force: true});
		await fs.mkdir(testRoot, {recursive: true});
		config = createTestConfig({snapshotEveryMs: 1000});
		mockQueueEngine = createMockQueueEngine();
	});

	afterEach(async () => {
		vi.useRealTimers();
		await fs.rm(testRoot, {recursive: true, force: true});
	});

	it('should persist and restore schedules', async () => {
		const scheduler1 = new CronScheduler(config, mockQueueEngine, createLoggerFactory());
		await scheduler1.start();

		await scheduler1.upsert('persist-test', 'test-task', {persistent: true}, '* * * * *', true);
		await scheduler1.stop();

		const scheduler2 = new CronScheduler(config, createMockQueueEngine(), createLoggerFactory());
		await scheduler2.start();

		const schedule = scheduler2.get('persist-test');
		expect(schedule).not.toBeNull();
		expect(schedule?.taskType).toBe('test-task');
		expect(schedule?.cronExpression).toBe('* * * * *');

		await scheduler2.stop();
	});

	it('should persist lastRunMs', async () => {
		const scheduler1 = new CronScheduler(config, mockQueueEngine, createLoggerFactory());
		await scheduler1.start();

		await scheduler1.upsert('persist-test', 'test-task', {}, '* * * * *', true);
		await vi.advanceTimersByTimeAsync(120000);

		const before = scheduler1.get('persist-test');
		const lastRunMs = before?.lastRunMs;
		expect(lastRunMs).not.toBeNull();

		await scheduler1.stop();

		const scheduler2 = new CronScheduler(config, createMockQueueEngine(), createLoggerFactory());
		await scheduler2.start();

		const after = scheduler2.get('persist-test');
		expect(after?.lastRunMs).toBe(lastRunMs);

		await scheduler2.stop();
	});
});
