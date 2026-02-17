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

import fs from 'node:fs';
import path from 'node:path';
import {Config} from '@fluxer/api/src/Config';
import {encodeKey} from '@fluxer/api/src/database/SqliteKV';
import {
	type DirectS3ExpirationEntry,
	DirectS3ExpirationStore,
} from '@fluxer/api/src/infrastructure/DirectS3ExpirationStore';
import {Logger} from '@fluxer/api/src/Logger';
import {
	DIRECT_S3_EXPIRATION_DB_FILENAME,
	DIRECT_S3_EXPIRATION_RETRY_DELAY_MS,
	DIRECT_S3_EXPIRATION_TIMER_MAX_DELAY_MS,
} from '@fluxer/constants/src/StorageConstants';
import type {S3Service} from '@fluxer/s3/src/s3/S3Service';

function resolveExpirationDbPath(): string {
	const basePath = Config.database.sqlitePath ?? ':memory:';
	if (basePath === ':memory:') {
		return basePath;
	}
	const dir = path.dirname(basePath);
	fs.mkdirSync(dir, {recursive: true});
	return path.join(dir, DIRECT_S3_EXPIRATION_DB_FILENAME);
}

function buildExpirationKey(bucket: string, key: string): string {
	return encodeKey([bucket, key]);
}

function buildBucketPrefix(bucket: string): string {
	return `${encodeKey([bucket])}|`;
}

export class DirectS3ExpirationManager {
	private readonly store: DirectS3ExpirationStore;
	private readonly timers = new Map<string, NodeJS.Timeout>();
	private readonly s3Service: S3Service;
	private bootstrapPromise: Promise<void>;

	constructor(s3Service: S3Service) {
		this.s3Service = s3Service;
		this.store = new DirectS3ExpirationStore(resolveExpirationDbPath());
		this.bootstrapPromise = this.bootstrap().catch((error) => {
			Logger.error({error}, 'Failed to bootstrap direct S3 expirations');
		});
	}

	async trackExpiration(params: {bucket: string; key: string; expiresAt: Date}): Promise<void> {
		await this.bootstrapPromise;
		const expiresAtMs = this.normaliseExpiresAt(params.expiresAt);
		const entry: DirectS3ExpirationEntry = {
			bucket: params.bucket,
			key: params.key,
			expiresAtMs,
		};
		this.store.upsert(entry);
		Logger.debug({bucket: params.bucket, key: params.key, expiresAt: params.expiresAt}, 'Tracked S3 expiration');

		if (expiresAtMs <= Date.now()) {
			await this.expireObject(entry);
			return;
		}

		this.scheduleExpiration(entry);
	}

	clearExpiration(bucket: string, key: string): void {
		this.store.delete(bucket, key);
		this.clearTimer(bucket, key);
		Logger.debug({bucket, key}, 'Cleared S3 expiration');
	}

	clearBucket(bucket: string): void {
		this.store.deleteBucket(bucket);
		const prefix = buildBucketPrefix(bucket);
		for (const [timerKey, timer] of this.timers) {
			if (timerKey.startsWith(prefix)) {
				clearTimeout(timer);
				this.timers.delete(timerKey);
			}
		}
		Logger.debug({bucket}, 'Cleared S3 expiration bucket');
	}

	getExpiration(bucket: string, key: string): Date | null {
		const expiresAtMs = this.store.getExpiresAtMs(bucket, key);
		if (expiresAtMs === null) {
			return null;
		}
		return new Date(expiresAtMs);
	}

	async expireIfNeeded(bucket: string, key: string): Promise<boolean> {
		await this.bootstrapPromise;
		const expiresAtMs = this.store.getExpiresAtMs(bucket, key);
		if (expiresAtMs === null) {
			return false;
		}
		if (expiresAtMs > Date.now()) {
			return false;
		}
		Logger.debug({bucket, key, expiresAt: new Date(expiresAtMs)}, 'S3 object expired');
		await this.expireObject({bucket, key, expiresAtMs});
		return true;
	}

	private normaliseExpiresAt(expiresAt: Date): number {
		const ms = expiresAt.getTime();
		if (!Number.isFinite(ms)) {
			throw new TypeError('expiresAt must be a valid Date');
		}
		return Number.isSafeInteger(ms) ? ms : Number.MAX_SAFE_INTEGER;
	}

	private clearTimer(bucket: string, key: string): void {
		const timerKey = buildExpirationKey(bucket, key);
		const timer = this.timers.get(timerKey);
		if (!timer) {
			return;
		}
		clearTimeout(timer);
		this.timers.delete(timerKey);
	}

	private scheduleExpiration(entry: DirectS3ExpirationEntry): void {
		const now = Date.now();
		const delay = Math.min(entry.expiresAtMs - now, DIRECT_S3_EXPIRATION_TIMER_MAX_DELAY_MS);
		if (delay <= 0) {
			void this.handleTimer(entry);
			return;
		}
		const timerKey = buildExpirationKey(entry.bucket, entry.key);
		const existingTimer = this.timers.get(timerKey);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}
		const timer = setTimeout(() => {
			void this.handleTimer(entry);
		}, delay);
		this.timers.set(timerKey, timer);
		Logger.debug(
			{bucket: entry.bucket, key: entry.key, expiresAt: new Date(entry.expiresAtMs), delayMs: delay},
			'Scheduled S3 expiration',
		);
	}

	private scheduleRetry(entry: DirectS3ExpirationEntry): void {
		const timerKey = buildExpirationKey(entry.bucket, entry.key);
		const existingTimer = this.timers.get(timerKey);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}
		const timer = setTimeout(() => {
			void this.handleTimer(entry);
		}, DIRECT_S3_EXPIRATION_RETRY_DELAY_MS);
		this.timers.set(timerKey, timer);
		Logger.debug(
			{
				bucket: entry.bucket,
				key: entry.key,
				expiresAt: new Date(entry.expiresAtMs),
				delayMs: DIRECT_S3_EXPIRATION_RETRY_DELAY_MS,
			},
			'Rescheduled S3 expiration cleanup',
		);
	}

	private async handleTimer(entry: DirectS3ExpirationEntry): Promise<void> {
		const expiresAtMs = this.store.getExpiresAtMs(entry.bucket, entry.key);
		if (expiresAtMs === null) {
			this.clearTimer(entry.bucket, entry.key);
			return;
		}
		if (expiresAtMs > Date.now()) {
			this.scheduleExpiration({bucket: entry.bucket, key: entry.key, expiresAtMs});
			return;
		}
		await this.expireObject({bucket: entry.bucket, key: entry.key, expiresAtMs});
	}

	private async expireObject(entry: DirectS3ExpirationEntry): Promise<void> {
		const currentExpiresAtMs = this.store.getExpiresAtMs(entry.bucket, entry.key);
		if (currentExpiresAtMs === null) {
			this.clearTimer(entry.bucket, entry.key);
			return;
		}
		if (currentExpiresAtMs !== entry.expiresAtMs) {
			if (currentExpiresAtMs > Date.now()) {
				this.scheduleExpiration({bucket: entry.bucket, key: entry.key, expiresAtMs: currentExpiresAtMs});
				return;
			}
			entry = {bucket: entry.bucket, key: entry.key, expiresAtMs: currentExpiresAtMs};
		}
		try {
			await this.s3Service.deleteObject(entry.bucket, entry.key);
			this.store.delete(entry.bucket, entry.key);
			this.clearTimer(entry.bucket, entry.key);
			Logger.debug({bucket: entry.bucket, key: entry.key}, 'Expired S3 object deleted');
		} catch (error) {
			Logger.error({error, bucket: entry.bucket, key: entry.key}, 'Failed to delete expired S3 object');
			this.scheduleRetry(entry);
		}
	}

	private async bootstrap(): Promise<void> {
		const entries = this.store.listAll();
		for (const entry of entries) {
			if (entry.expiresAtMs <= Date.now()) {
				await this.expireObject(entry);
			} else {
				this.scheduleExpiration(entry);
			}
		}
	}
}
