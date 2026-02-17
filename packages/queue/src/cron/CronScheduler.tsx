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
import {type CronSchedule, type CronStats, createCronID} from '@fluxer/queue/src/types/JobTypes';
import type {JsonValue} from '@fluxer/queue/src/types/JsonTypes';
import {JsonValueSchema} from '@fluxer/queue/src/types/JsonTypes';
import type {QueueConfig} from '@fluxer/queue/src/types/QueueConfig';
import {nowMs} from '@fluxer/time/src/Clock';
import crc32 from 'crc-32';
import {CronExpressionParser} from 'cron-parser';
import {pack, unpack} from 'msgpackr';

const deflate = promisify(zlib.deflate);

const CRON_SNAPSHOT_FILENAME = 'cron_snapshot.msgpack.zstd';
const CRON_SNAPSHOT_VERSION = 1;

interface CronSnapshot {
	version: number;
	schedules: Array<[string, SerializableCronSchedule]>;
}

interface SerializableCronSchedule {
	id: string;
	taskType: string;
	payload: Array<number>;
	cronExpression: string;
	enabled: boolean;
	lastRunMs: number | null;
	nextRunMs: number | null;
	createdAtMs: number;
	updatedAtMs: number;
}

export interface QueueEngineClient {
	enqueue(
		taskType: string,
		payload: JsonValue,
		priority?: number,
		runAtMs?: number | null,
		maxAttempts?: number,
		deduplicationId?: string | null,
	): Promise<{job: {id: string}; enqueued: boolean}>;
}

export class CronScheduler {
	private config: QueueConfig;
	private queueEngine: QueueEngineClient;
	private logger: LoggerInterface;

	private schedules: Map<string, CronSchedule> = new Map();
	private running: boolean = false;
	private tickTimer: NodeJS.Timeout | null = null;
	private snapshotTimer: NodeJS.Timeout | null = null;
	private operationsSinceSnapshot: number = 0;

	constructor(config: QueueConfig, queueEngine: QueueEngineClient, loggerFactory: LoggerFactory) {
		this.config = config;
		this.queueEngine = queueEngine;
		this.logger = loggerFactory('CronScheduler');
	}

	async start(): Promise<void> {
		this.logger.info({}, 'Starting cron scheduler');

		await this.loadSnapshot();

		for (const schedule of this.schedules.values()) {
			if (schedule.enabled) {
				this.updateNextRun(schedule);
			}
		}

		this.running = true;
		this.startTickLoop();
		this.startSnapshotLoop();

		this.logger.info({schedules: this.schedules.size}, 'Cron scheduler started');
	}

	async stop(): Promise<void> {
		this.logger.info({}, 'Stopping cron scheduler');
		this.running = false;

		if (this.tickTimer) {
			clearTimeout(this.tickTimer);
		}
		if (this.snapshotTimer) {
			clearTimeout(this.snapshotTimer);
		}

		await this.saveSnapshot();

		this.logger.info({}, 'Cron scheduler stopped');
	}

	async upsert(
		id: string,
		taskType: string,
		payload: JsonValue,
		cronExpression: string,
		enabled: boolean = true,
	): Promise<CronSchedule> {
		try {
			CronExpressionParser.parse(cronExpression);
		} catch (_err) {
			throw new Error(`Invalid cron expression: ${cronExpression}`);
		}

		const payloadBytes = new Uint8Array(Buffer.from(JSON.stringify(payload)));
		const existingSchedule = this.schedules.get(id);
		if (
			existingSchedule &&
			this.isScheduleDefinitionUnchanged(existingSchedule, taskType, payloadBytes, cronExpression, enabled)
		) {
			return existingSchedule;
		}

		const now = nowMs();

		const schedule: CronSchedule = {
			id: createCronID(id),
			taskType,
			payload: payloadBytes,
			cronExpression,
			enabled,
			lastRunMs: existingSchedule?.lastRunMs ?? null,
			nextRunMs: null,
			createdAtMs: existingSchedule?.createdAtMs ?? now,
			updatedAtMs: now,
		};

		if (enabled) {
			this.updateNextRun(schedule);
		}

		this.schedules.set(id, schedule);
		this.operationsSinceSnapshot++;

		this.logger.info({id, taskType, cronExpression, enabled, nextRunMs: schedule.nextRunMs}, 'Cron schedule upserted');

		return schedule;
	}

	private isScheduleDefinitionUnchanged(
		schedule: CronSchedule,
		taskType: string,
		payload: Uint8Array,
		cronExpression: string,
		enabled: boolean,
	): boolean {
		return (
			schedule.taskType === taskType &&
			schedule.cronExpression === cronExpression &&
			schedule.enabled === enabled &&
			this.areEqualPayloadBytes(schedule.payload, payload)
		);
	}

	private areEqualPayloadBytes(left: Uint8Array, right: Uint8Array): boolean {
		if (left.length !== right.length) {
			return false;
		}

		for (let i = 0; i < left.length; i++) {
			if (left[i] !== right[i]) {
				return false;
			}
		}

		return true;
	}

	async delete(id: string): Promise<boolean> {
		if (!this.schedules.has(id)) {
			return false;
		}

		this.schedules.delete(id);
		this.operationsSinceSnapshot++;

		this.logger.info({id}, 'Cron schedule deleted');

		return true;
	}

	get(id: string): CronSchedule | null {
		return this.schedules.get(id) ?? null;
	}

	list(): Array<CronSchedule> {
		return Array.from(this.schedules.values());
	}

	getStats(): CronStats {
		let enabled = 0;
		let disabled = 0;

		for (const schedule of this.schedules.values()) {
			if (schedule.enabled) {
				enabled++;
			} else {
				disabled++;
			}
		}

		return {
			total: this.schedules.size,
			enabled,
			disabled,
		};
	}

	private updateNextRun(schedule: CronSchedule): void {
		try {
			const cron = CronExpressionParser.parse(schedule.cronExpression, {
				currentDate: new Date(),
			});
			const next = cron.next();
			schedule.nextRunMs = next.getTime();
		} catch (err) {
			this.logger.error({id: schedule.id, err}, 'Failed to parse cron expression');
			schedule.nextRunMs = null;
		}
	}

	private startTickLoop(): void {
		const tick = async () => {
			if (!this.running) return;

			await this.processDueSchedules();

			let nextTickMs = 60000;
			const now = nowMs();

			for (const schedule of this.schedules.values()) {
				if (schedule.enabled && schedule.nextRunMs !== null) {
					const delay = schedule.nextRunMs - now;
					if (delay > 0 && delay < nextTickMs) {
						nextTickMs = delay;
					}
				}
			}

			nextTickMs = Math.max(100, nextTickMs);

			this.tickTimer = setTimeout(tick, nextTickMs);
		};

		tick();
	}

	private async processDueSchedules(): Promise<void> {
		const now = nowMs();

		for (const schedule of this.schedules.values()) {
			if (!schedule.enabled || schedule.nextRunMs === null) {
				continue;
			}

			if (schedule.nextRunMs <= now) {
				try {
					let payload: JsonValue;
					try {
						payload = JsonValueSchema.parse(JSON.parse(Buffer.from(schedule.payload).toString('utf-8')));
					} catch {
						payload = {};
					}

					const {enqueued} = await this.queueEngine.enqueue(schedule.taskType, payload, 0, null, 3, null);
					if (!enqueued) {
						this.logger.warn({id: schedule.id}, 'Cron job enqueue returned false');
					}

					this.logger.debug({id: schedule.id, taskType: schedule.taskType}, 'Cron job enqueued');

					schedule.lastRunMs = now;
					this.updateNextRun(schedule);
					this.operationsSinceSnapshot++;
				} catch (err) {
					this.logger.error({id: schedule.id, err}, 'Failed to enqueue cron job');
					this.updateNextRun(schedule);
				}
			}
		}
	}

	private startSnapshotLoop(): void {
		const tick = async () => {
			if (!this.running) return;

			if (this.operationsSinceSnapshot > 0) {
				await this.saveSnapshot();
			}

			this.snapshotTimer = setTimeout(tick, this.config.snapshotEveryMs);
		};

		this.snapshotTimer = setTimeout(tick, this.config.snapshotEveryMs);
	}

	private async saveSnapshot(): Promise<void> {
		try {
			const snapshot: CronSnapshot = {
				version: CRON_SNAPSHOT_VERSION,
				schedules: Array.from(this.schedules.entries()).map(([key, schedule]) => [
					key,
					{
						id: schedule.id,
						taskType: schedule.taskType,
						payload: Array.from(schedule.payload),
						cronExpression: schedule.cronExpression,
						enabled: schedule.enabled,
						lastRunMs: schedule.lastRunMs,
						nextRunMs: schedule.nextRunMs,
						createdAtMs: schedule.createdAtMs,
						updatedAtMs: schedule.updatedAtMs,
					},
				]),
			};

			const packed = pack(snapshot);
			const compressed = await deflate(Buffer.from(packed), {level: this.config.snapshotZstdLevel});

			const checksum = crc32.buf(compressed);

			const finalBuffer = Buffer.alloc(4 + compressed.length);
			finalBuffer.writeInt32LE(checksum, 0);
			finalBuffer.set(compressed, 4);

			const snapshotPath = path.join(this.config.dataDir, CRON_SNAPSHOT_FILENAME);
			const tempPath = `${snapshotPath}.tmp`;

			await fs.writeFile(tempPath, finalBuffer);
			await fs.rename(tempPath, snapshotPath);

			this.operationsSinceSnapshot = 0;

			this.logger.debug({schedules: this.schedules.size, path: snapshotPath}, 'Cron snapshot saved');
		} catch (err) {
			this.logger.error({err}, 'Failed to save cron snapshot');
		}
	}

	private async loadSnapshot(): Promise<void> {
		const snapshotPath = path.join(this.config.dataDir, CRON_SNAPSHOT_FILENAME);

		try {
			const data = await fs.readFile(snapshotPath);

			if (data.length < 4) {
				this.logger.warn('Cron snapshot file too small, starting fresh');
				return;
			}

			const storedChecksum = data.readInt32LE(0);
			const compressed = data.subarray(4);

			const calculatedChecksum = crc32.buf(compressed);
			if (storedChecksum !== calculatedChecksum) {
				this.logger.error({storedChecksum, calculatedChecksum}, 'Cron snapshot checksum mismatch');
				return;
			}

			const decompressed = await promisify(zlib.inflate)(compressed);
			const snapshot = unpack(Buffer.from(decompressed)) as CronSnapshot;

			if (snapshot.version !== CRON_SNAPSHOT_VERSION) {
				this.logger.warn(
					{version: snapshot.version, expected: CRON_SNAPSHOT_VERSION},
					'Cron snapshot version mismatch',
				);
				return;
			}

			this.schedules.clear();

			for (const [key, serialized] of snapshot.schedules) {
				const schedule: CronSchedule = {
					id: createCronID(serialized.id),
					taskType: serialized.taskType,
					payload: new Uint8Array(serialized.payload),
					cronExpression: serialized.cronExpression,
					enabled: serialized.enabled,
					lastRunMs: serialized.lastRunMs,
					nextRunMs: serialized.nextRunMs,
					createdAtMs: serialized.createdAtMs,
					updatedAtMs: serialized.updatedAtMs,
				};
				this.schedules.set(key, schedule);
			}

			this.logger.info({schedules: this.schedules.size}, 'Cron snapshot loaded');
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
				this.logger.info({}, 'No cron snapshot found, starting fresh');
			} else {
				this.logger.error({err}, 'Failed to load cron snapshot');
			}
		}
	}
}
