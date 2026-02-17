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
import * as path from 'node:path';
import {promisify} from 'node:util';
import * as zlib from 'node:zlib';
import type {LoggerFactory, LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import {DelayQueue} from '@fluxer/queue/src/engine/DelayQueue';
import {PriorityQueue} from '@fluxer/queue/src/engine/PriorityQueue';
import {
	createDeduplicationID,
	createJobID,
	createReceipt,
	type Job,
	type JobID,
	type JobRecord,
	JobStatus,
	type LeasedJob,
	type QueueStats,
	type ReadyItem,
	type Receipt,
	type SerializableSnapshot,
} from '@fluxer/queue/src/types/JobTypes';
import type {JsonValue} from '@fluxer/queue/src/types/JsonTypes';
import type {QueueConfig} from '@fluxer/queue/src/types/QueueConfig';
import {nowMs} from '@fluxer/time/src/Clock';
import {computeExponentialBackoffSeconds} from '@fluxer/time/src/ExponentialBackoff';
import crc32 from 'crc-32';
import {pack, unpack} from 'msgpackr';
import {v4 as uuidv4} from 'uuid';

const deflate = promisify(zlib.deflate);

const SNAPSHOT_VERSION = 1;
const SNAPSHOT_FILENAME = 'snapshot.msgpack.zstd';

interface InflightEntry {
	jobId: JobID;
	receipt: Receipt;
}

export class QueueEngine {
	private config: QueueConfig;
	private logger: LoggerInterface;

	private jobs: Map<string, JobRecord> = new Map();

	private readyQueue: PriorityQueue = new PriorityQueue();

	private scheduledQueue: DelayQueue<JobID>;

	private inflightQueue: DelayQueue<InflightEntry>;

	private deduplicationIndex: Map<string, string> = new Map();

	private sequenceCounter: number = 0;

	private operationsSinceSnapshot: number = 0;
	private lastSnapshotTime: number = nowMs();
	private snapshotPromise: Promise<void> | null = null;

	private schedulerTimer: NodeJS.Timeout | null = null;
	private visibilityTimer: NodeJS.Timeout | null = null;
	private snapshotTimer: NodeJS.Timeout | null = null;

	private running: boolean = false;

	constructor(config: QueueConfig, loggerFactory: LoggerFactory) {
		this.config = config;
		this.logger = loggerFactory('QueueEngine');

		this.scheduledQueue = new DelayQueue<JobID>((id: JobID) => id);
		this.inflightQueue = new DelayQueue<InflightEntry>((entry: InflightEntry) => entry.receipt);
	}

	async start(): Promise<void> {
		this.logger.info({}, 'Starting queue engine');

		await fs.mkdir(this.config.dataDir, {recursive: true});

		await this.loadSnapshot();

		this.running = true;

		this.startSchedulerLoop();
		this.startVisibilityLoop();
		this.startSnapshotLoop();

		this.logger.info(
			{
				ready: this.readyQueue.size,
				scheduled: this.scheduledQueue.size,
				inflight: this.inflightQueue.size,
				deadLetter: this.countDeadLetter(),
			},
			'Queue engine started',
		);
	}

	async stop(): Promise<void> {
		this.logger.info({}, 'Stopping queue engine');
		this.running = false;

		if (this.schedulerTimer) {
			clearTimeout(this.schedulerTimer);
		}
		if (this.visibilityTimer) {
			clearTimeout(this.visibilityTimer);
		}
		if (this.snapshotTimer) {
			clearTimeout(this.snapshotTimer);
		}

		await this.saveSnapshot();

		this.logger.info({}, 'Queue engine stopped');
	}

	async enqueue(
		taskType: string,
		payload: JsonValue,
		priority: number = 0,
		runAtMs: number | null = null,
		maxAttempts: number = 3,
		deduplicationId: string | null = null,
	): Promise<{job: Job; enqueued: boolean}> {
		const now = nowMs();
		const effectiveRunAt = runAtMs ?? now;

		if (deduplicationId) {
			const existingJobId = this.deduplicationIndex.get(deduplicationId);
			if (existingJobId) {
				const existingRecord = this.jobs.get(existingJobId);
				if (existingRecord && existingRecord.status !== JobStatus.DeadLetter) {
					this.logger.debug({deduplicationId, existingJobId}, 'Duplicate job rejected');
					return {job: existingRecord.job, enqueued: false};
				}
			}
		}

		const jobId = createJobID(uuidv4());
		const payloadBytes = new Uint8Array(Buffer.from(JSON.stringify(payload)));

		const effectiveMaxAttempts = Math.min(Math.max(maxAttempts, 1), 1000);

		const job: Job = {
			id: jobId,
			taskType,
			payload: payloadBytes,
			priority,
			runAtMs: effectiveRunAt,
			createdAtMs: now,
			attempts: 0,
			maxAttempts: effectiveMaxAttempts,
			error: null,
			deduplicationId: deduplicationId ? createDeduplicationID(deduplicationId) : null,
		};

		const isScheduled = effectiveRunAt > now;

		const record: JobRecord = {
			job,
			status: isScheduled ? JobStatus.Scheduled : JobStatus.Ready,
			receipt: null,
			visibilityDeadlineMs: null,
		};

		this.jobs.set(jobId, record);

		if (deduplicationId) {
			this.deduplicationIndex.set(deduplicationId, jobId);
		}

		if (isScheduled) {
			this.scheduledQueue.push(jobId, effectiveRunAt);
		} else {
			this.addToReadyQueue(job);
		}

		this.recordOperation();

		this.logger.debug({jobId, taskType, priority, runAtMs: effectiveRunAt, isScheduled}, 'Job enqueued');

		return {job, enqueued: true};
	}

	async dequeue(
		taskTypes: Array<string> | null,
		limit: number,
		waitTimeMs: number,
		visibilityTimeoutMs: number | null,
	): Promise<Array<LeasedJob>> {
		const effectiveTimeout = visibilityTimeoutMs ?? this.config.defaultVisibilityTimeoutMs;
		const deadline = nowMs() + waitTimeMs;

		const results: Array<LeasedJob> = [];

		while (results.length < limit) {
			const leasedJob = this.tryDequeueOne(taskTypes, effectiveTimeout);
			if (leasedJob) {
				results.push(leasedJob);
				continue;
			}

			if (waitTimeMs === 0 || nowMs() >= deadline) {
				break;
			}

			await new Promise((resolve) => setTimeout(resolve, Math.min(100, deadline - nowMs())));
		}

		if (results.length > 0) {
			this.recordOperation();
			this.logger.debug({count: results.length, taskTypes}, 'Jobs dequeued');
		}

		return results;
	}

	private tryDequeueOne(taskTypes: Array<string> | null, visibilityTimeoutMs: number): LeasedJob | null {
		this.processScheduledJobs();

		const jobId = this.findMatchingJob(taskTypes);
		if (!jobId) {
			return null;
		}

		const record = this.jobs.get(jobId);
		if (!record) {
			return null;
		}

		const receipt = createReceipt(uuidv4());
		const now = nowMs();
		const visibilityDeadline = now + visibilityTimeoutMs;

		record.status = JobStatus.Inflight;
		record.receipt = receipt;
		record.visibilityDeadlineMs = visibilityDeadline;
		record.job.attempts += 1;

		this.inflightQueue.push({jobId, receipt}, visibilityDeadline);

		this.readyQueue.remove(jobId);

		return {
			job: record.job,
			receipt,
			visibilityDeadlineMs: visibilityDeadline,
		};
	}

	private findMatchingJob(taskTypes: Array<string> | null): JobID | null {
		if (!taskTypes || taskTypes.length === 0) {
			const item = this.readyQueue.peek();
			return item?.jobId ?? null;
		}

		const taskTypeSet = new Set(taskTypes);
		const tempItems: Array<ReadyItem> = [];
		let found: JobID | null = null;

		while (!this.readyQueue.isEmpty) {
			const item = this.readyQueue.pop();
			if (!item) break;

			const record = this.jobs.get(item.jobId);
			if (record && taskTypeSet.has(record.job.taskType)) {
				found = item.jobId;
				for (const tempItem of tempItems) {
					this.readyQueue.push(tempItem);
				}
				this.readyQueue.push(item);
				break;
			}
			tempItems.push(item);
		}

		if (!found) {
			for (const item of tempItems) {
				this.readyQueue.push(item);
			}
		}

		return found;
	}

	async ack(receipt: string): Promise<boolean> {
		const record = this.findByReceipt(receipt);
		if (!record) {
			return false;
		}

		const jobId = record.job.id;
		const deduplicationId = record.job.deduplicationId;

		this.inflightQueue.removeByKey(receipt);
		this.jobs.delete(jobId);

		if (deduplicationId) {
			this.deduplicationIndex.delete(deduplicationId);
		}

		this.recordOperation();
		this.logger.debug({jobId, receipt}, 'Job acknowledged');

		return true;
	}

	async nack(receipt: string, error?: string): Promise<boolean> {
		const record = this.findByReceipt(receipt);
		if (!record) {
			return false;
		}

		const jobId = record.job.id;

		this.inflightQueue.removeByKey(receipt);

		if (error) {
			record.job.error = error;
		}

		record.receipt = null;
		record.visibilityDeadlineMs = null;

		if (record.job.attempts >= record.job.maxAttempts) {
			record.status = JobStatus.DeadLetter;
			record.job.error = error ?? 'max_attempts exceeded';

			if (record.job.deduplicationId) {
				this.deduplicationIndex.delete(record.job.deduplicationId);
			}

			this.logger.info({jobId, attempts: record.job.attempts, error}, 'Job moved to dead letter queue');
		} else {
			const backoffMs =
				computeExponentialBackoffSeconds({
					attemptCount: record.job.attempts,
				}) * 1000;
			const retryAtMs = nowMs() + backoffMs;

			record.status = JobStatus.Scheduled;
			record.job.runAtMs = retryAtMs;
			record.job.error = error ?? null;
			this.scheduledQueue.push(jobId, retryAtMs);

			this.logger.debug({jobId, attempts: record.job.attempts, retryAtMs, error}, 'Job scheduled for retry');
		}

		this.recordOperation();
		return true;
	}

	async changeVisibility(receipt: string, timeoutMs: number): Promise<boolean> {
		const record = this.findByReceipt(receipt);
		if (!record || record.status !== JobStatus.Inflight) {
			return false;
		}

		const newDeadline = nowMs() + timeoutMs;

		this.inflightQueue.removeByKey(receipt);
		this.inflightQueue.push({jobId: record.job.id, receipt: record.receipt!}, newDeadline);

		record.visibilityDeadlineMs = newDeadline;

		this.recordOperation();
		this.logger.debug({jobId: record.job.id, newDeadline}, 'Visibility timeout changed');

		return true;
	}

	async retryJob(jobId: string): Promise<Job | null> {
		const record = this.jobs.get(jobId);
		if (!record || record.status !== JobStatus.DeadLetter) {
			return null;
		}

		record.job.attempts = 0;
		record.job.error = null;
		record.job.runAtMs = nowMs();
		record.status = JobStatus.Ready;
		record.receipt = null;
		record.visibilityDeadlineMs = null;

		this.addToReadyQueue(record.job);

		this.recordOperation();
		this.logger.info({jobId}, 'Job retried from dead letter queue');

		return record.job;
	}

	async deleteJob(jobId: string): Promise<boolean> {
		const record = this.jobs.get(jobId);
		if (!record) {
			return false;
		}

		switch (record.status) {
			case JobStatus.Ready:
				this.readyQueue.remove(createJobID(jobId));
				break;
			case JobStatus.Scheduled:
				this.scheduledQueue.removeByKey(jobId);
				break;
			case JobStatus.Inflight:
				if (record.receipt) {
					this.inflightQueue.removeByKey(record.receipt);
				}
				break;
		}

		if (record.job.deduplicationId) {
			this.deduplicationIndex.delete(record.job.deduplicationId);
		}

		this.jobs.delete(jobId);

		this.recordOperation();
		this.logger.debug({jobId}, 'Job deleted');

		return true;
	}

	getStats(): QueueStats {
		const now = nowMs();
		let ready = 0;
		let scheduled = 0;
		let processing = 0;
		let deadLetter = 0;

		for (const record of this.jobs.values()) {
			switch (record.status) {
				case JobStatus.Ready:
					ready++;
					break;
				case JobStatus.Scheduled:
					if (record.job.runAtMs <= now) {
						ready++;
					} else {
						scheduled++;
					}
					break;
				case JobStatus.Inflight:
					processing++;
					break;
				case JobStatus.DeadLetter:
					deadLetter++;
					break;
			}
		}

		return {ready, processing, scheduled, deadLetter};
	}

	getJob(jobId: string): JobRecord | null {
		return this.jobs.get(jobId) ?? null;
	}

	private findByReceipt(receipt: string): JobRecord | null {
		for (const record of this.jobs.values()) {
			if (record.receipt === receipt) {
				return record;
			}
		}
		return null;
	}

	private addToReadyQueue(job: Job): void {
		const item: ReadyItem = {
			jobId: job.id,
			priority: job.priority,
			runAtMs: job.runAtMs,
			createdAtMs: job.createdAtMs,
			sequence: this.sequenceCounter++,
		};
		this.readyQueue.push(item);
	}

	private processScheduledJobs(): void {
		const expiredIds = this.scheduledQueue.popExpired();
		for (const jobId of expiredIds) {
			const record = this.jobs.get(jobId);
			if (record && record.status === JobStatus.Scheduled) {
				record.status = JobStatus.Ready;
				this.addToReadyQueue(record.job);
			}
		}
	}

	private processVisibilityTimeouts(): void {
		const expired = this.inflightQueue.popExpired();
		for (const entry of expired) {
			const record = this.jobs.get(entry.jobId);
			if (record && record.status === JobStatus.Inflight && record.receipt === entry.receipt) {
				record.receipt = null;
				record.visibilityDeadlineMs = null;
				record.job.error = 'visibility timeout';

				if (record.job.attempts >= record.job.maxAttempts) {
					record.status = JobStatus.DeadLetter;

					if (record.job.deduplicationId) {
						this.deduplicationIndex.delete(record.job.deduplicationId);
					}

					this.logger.info({jobId: entry.jobId}, 'Job moved to dead letter queue after visibility timeout');
				} else {
					const retryAtMs = nowMs() + this.config.visibilityTimeoutBackoffMs;
					record.status = JobStatus.Scheduled;
					record.job.runAtMs = retryAtMs;
					this.scheduledQueue.push(entry.jobId, retryAtMs);
					this.logger.debug({jobId: entry.jobId, retryAtMs}, 'Job scheduled for retry after visibility timeout');
				}

				this.recordOperation();
			}
		}
	}

	private countDeadLetter(): number {
		let count = 0;
		for (const record of this.jobs.values()) {
			if (record.status === JobStatus.DeadLetter) {
				count++;
			}
		}
		return count;
	}

	private startSchedulerLoop(): void {
		const tick = () => {
			if (!this.running) return;

			this.processScheduledJobs();

			const nextDelay = this.scheduledQueue.nextDelay();
			const delay = nextDelay !== null ? Math.min(nextDelay, 1000) : 1000;

			this.schedulerTimer = setTimeout(tick, delay);
		};

		tick();
	}

	private startVisibilityLoop(): void {
		const tick = () => {
			if (!this.running) return;

			this.processVisibilityTimeouts();

			const nextDelay = this.inflightQueue.nextDelay();
			const delay = nextDelay !== null ? Math.min(nextDelay, 1000) : 1000;

			this.visibilityTimer = setTimeout(tick, delay);
		};

		tick();
	}

	private startSnapshotLoop(): void {
		const tick = () => {
			if (!this.running) return;

			this.maybeSnapshot();

			this.snapshotTimer = setTimeout(tick, this.config.snapshotEveryMs);
		};

		this.snapshotTimer = setTimeout(tick, this.config.snapshotEveryMs);
	}

	private recordOperation(): void {
		this.operationsSinceSnapshot++;
	}

	private async maybeSnapshot(): Promise<void> {
		const now = nowMs();
		const timeSinceSnapshot = now - this.lastSnapshotTime;

		if (
			!this.snapshotPromise &&
			(this.operationsSinceSnapshot >= this.config.snapshotAfterOps || timeSinceSnapshot >= this.config.snapshotEveryMs)
		) {
			await this.saveSnapshot();
		}
	}

	private async saveSnapshot(): Promise<void> {
		if (this.snapshotPromise) return this.snapshotPromise;

		this.snapshotPromise = (async () => {
			try {
				const snapshot: SerializableSnapshot = {
					version: SNAPSHOT_VERSION,
					jobs: Array.from(this.jobs.entries()).map(([key, record]) => [
						key,
						{
							job: {
								id: record.job.id,
								taskType: record.job.taskType,
								payload: Array.from(record.job.payload),
								priority: record.job.priority,
								runAtMs: record.job.runAtMs,
								createdAtMs: record.job.createdAtMs,
								attempts: record.job.attempts,
								maxAttempts: record.job.maxAttempts,
								error: record.job.error,
								deduplicationId: record.job.deduplicationId,
							},
							status: record.status,
							receipt: record.receipt,
							visibilityDeadlineMs: record.visibilityDeadlineMs,
						},
					]),
					cronSchedules: [],
					sequenceCounter: this.sequenceCounter,
					deduplicationIndex: Array.from(this.deduplicationIndex.entries()),
				};

				const packed = pack(snapshot);
				const compressed = await deflate(Buffer.from(packed), {level: this.config.snapshotZstdLevel});

				const checksum = crc32.buf(compressed);

				const finalBuffer = Buffer.alloc(4 + compressed.length);
				finalBuffer.writeInt32LE(checksum, 0);
				finalBuffer.set(compressed, 4);

				const snapshotPath = path.join(this.config.dataDir, SNAPSHOT_FILENAME);
				const tempPath = `${snapshotPath}.tmp`;

				await fs.writeFile(tempPath, finalBuffer);
				await fs.rename(tempPath, snapshotPath);

				this.operationsSinceSnapshot = 0;
				this.lastSnapshotTime = nowMs();
			} catch (err) {
				this.logger.error({err}, 'Failed to save snapshot');
			} finally {
				this.snapshotPromise = null;
			}
		})();

		return this.snapshotPromise;
	}

	private async loadSnapshot(): Promise<void> {
		const snapshotPath = path.join(this.config.dataDir, SNAPSHOT_FILENAME);

		try {
			const data = await fs.readFile(snapshotPath);

			if (data.length < 4) {
				this.logger.warn('Snapshot file too small, starting fresh');
				return;
			}

			const storedChecksum = data.readInt32LE(0);
			const compressed = data.subarray(4);

			const calculatedChecksum = crc32.buf(compressed);
			if (storedChecksum !== calculatedChecksum) {
				this.logger.error({storedChecksum, calculatedChecksum}, 'Snapshot checksum mismatch');
				return;
			}

			const decompressed = await promisify(zlib.inflate)(compressed);
			const snapshot = unpack(Buffer.from(decompressed)) as SerializableSnapshot;

			if (snapshot.version !== SNAPSHOT_VERSION) {
				this.logger.warn({version: snapshot.version, expected: SNAPSHOT_VERSION}, 'Snapshot version mismatch');
				return;
			}

			this.jobs.clear();
			this.readyQueue.clear();
			this.scheduledQueue.clear();
			this.inflightQueue.clear();
			this.deduplicationIndex.clear();

			for (const [key, record] of snapshot.jobs) {
				const restoredRecord: JobRecord = {
					...record,
					job: {
						...record.job,
						id: createJobID(record.job.id),
						payload: new Uint8Array(record.job.payload),
						deduplicationId: record.job.deduplicationId ? createDeduplicationID(record.job.deduplicationId) : null,
					},
					receipt: record.receipt ? createReceipt(record.receipt) : null,
				};

				this.jobs.set(key, restoredRecord);

				switch (restoredRecord.status) {
					case JobStatus.Ready:
						this.addToReadyQueue(restoredRecord.job);
						break;
					case JobStatus.Scheduled:
						this.scheduledQueue.push(restoredRecord.job.id, restoredRecord.job.runAtMs);
						break;
					case JobStatus.Inflight:
						restoredRecord.status = JobStatus.Ready;
						restoredRecord.receipt = null;
						restoredRecord.visibilityDeadlineMs = null;
						this.addToReadyQueue(restoredRecord.job);
						break;
				}
			}

			for (const [key, value] of snapshot.deduplicationIndex) {
				this.deduplicationIndex.set(key, value);
			}

			this.sequenceCounter = snapshot.sequenceCounter;

			this.logger.info(
				{
					jobs: this.jobs.size,
					ready: this.readyQueue.size,
					scheduled: this.scheduledQueue.size,
				},
				'Snapshot loaded',
			);
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
				this.logger.info({}, 'No snapshot found, starting fresh');
			} else {
				this.logger.error({err}, 'Failed to load snapshot');
			}
		}
	}

	private getSnapshotPath(): string {
		return path.join(this.config.dataDir, SNAPSHOT_FILENAME);
	}

	private async removeSnapshotFile(): Promise<void> {
		try {
			await fs.rm(this.getSnapshotPath(), {force: true});
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				this.logger.debug({error}, 'Failed to remove queue snapshot');
			}
		}
	}

	async resetState(): Promise<void> {
		this.jobs.clear();
		this.readyQueue.clear();
		this.scheduledQueue.clear();
		this.inflightQueue.clear();
		this.deduplicationIndex.clear();
		this.sequenceCounter = 0;
		this.operationsSinceSnapshot = 0;
		this.lastSnapshotTime = nowMs();
		await this.removeSnapshotFile();
	}
}
