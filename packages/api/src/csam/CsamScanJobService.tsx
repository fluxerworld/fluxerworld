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
import type {CsamScanJobStatus, CsamScanTarget, PhotoDnaMatchResult} from '@fluxer/api/src/csam/CsamTypes';
import type {DbOp} from '@fluxer/api/src/database/Cassandra';
import {Db, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {CsamScanJobRow} from '@fluxer/api/src/database/types/CsamTypes';
import {Logger} from '@fluxer/api/src/Logger';
import {CsamScanJobs} from '@fluxer/api/src/Tables';
import {MS_PER_DAY} from '@fluxer/date_utils/src/DateConstants';

export interface CreateCsamScanJobArgs {
	jobId: string;
	target: CsamScanTarget;
}

export interface ICsamScanJobService {
	createJob(args: CreateCsamScanJobArgs): Promise<void>;
}

type CsamScanJobPatchOps = Partial<{[K in keyof CsamScanJobRow]: DbOp<CsamScanJobRow[K]>}>;

export class CsamScanJobService implements ICsamScanJobService {
	private readonly retentionMs: number;

	constructor(private readonly logger = Logger) {
		const retentionDays = Math.max(1, Config.csam.jobRetentionDays);
		this.retentionMs = retentionDays * MS_PER_DAY;
	}

	private extendExpiry(): Date {
		return new Date(Date.now() + this.retentionMs);
	}

	private buildPatchOps(patch: Partial<CsamScanJobRow>): CsamScanJobPatchOps {
		const ops: CsamScanJobPatchOps = {};

		const setStringColumn = (
			column: 'status' | 'hashes' | 'match_tracking_id' | 'match_details' | 'error_message',
			value: string | null | undefined,
		): void => {
			if (value === undefined) {
				return;
			}

			if (value === null) {
				ops[column] = Db.clear<string>();
				return;
			}

			ops[column] = Db.set(value);
		};

		setStringColumn('status', patch.status ?? undefined);
		setStringColumn('hashes', patch.hashes ?? undefined);
		setStringColumn('match_tracking_id', patch.match_tracking_id ?? undefined);
		setStringColumn('match_details', patch.match_details ?? undefined);
		setStringColumn('error_message', patch.error_message ?? undefined);

		ops.last_updated = Db.set(new Date());
		ops.expires_at = Db.set(this.extendExpiry());
		return ops;
	}

	private async patchJob(jobId: string, patch: Partial<CsamScanJobRow>): Promise<void> {
		const ops = this.buildPatchOps(patch);
		try {
			await upsertOne(CsamScanJobs.patchByPk({job_id: jobId}, ops));
		} catch (error) {
			this.logger.error({error, jobId, patch}, 'Failed to update CSAM scan job');
		}
	}

	async createJob(args: CreateCsamScanJobArgs): Promise<void> {
		const now = new Date();
		const row: CsamScanJobRow = {
			job_id: args.jobId,
			resource_type: args.target.resourceType,
			bucket: args.target.bucket ?? null,
			key: args.target.key ?? null,
			cdn_url: args.target.cdnUrl ?? null,
			filename: args.target.filename ?? null,
			content_type: args.target.contentType ?? null,
			channel_id: args.target.channelId ? BigInt(args.target.channelId) : null,
			message_id: args.target.messageId ? BigInt(args.target.messageId) : null,
			guild_id: args.target.guildId ? BigInt(args.target.guildId) : null,
			user_id: args.target.userId ? BigInt(args.target.userId) : null,
			status: 'pending',
			enqueue_time: now,
			last_updated: now,
			match_tracking_id: null,
			match_details: null,
			hashes: null,
			error_message: null,
			expires_at: this.extendExpiry(),
		};

		try {
			await upsertOne(CsamScanJobs.insert(row));
		} catch (error) {
			this.logger.error({error, jobId: args.jobId}, 'Failed to persist CSAM scan job');
		}
	}

	async markProcessing(jobId: string): Promise<void> {
		await this.patchJob(jobId, {
			status: 'processing',
		});
	}

	async recordHashes(jobId: string, hashes: Array<string>): Promise<void> {
		await this.patchJob(jobId, {
			status: 'hashing',
			hashes: JSON.stringify(hashes),
		});
	}

	async recordMatchResult(jobId: string, matchResult: PhotoDnaMatchResult): Promise<void> {
		const status: CsamScanJobStatus = matchResult.isMatch ? 'matched' : 'no_match';
		await this.patchJob(jobId, {
			status,
			match_tracking_id: matchResult.trackingId || null,
			match_details: JSON.stringify(matchResult.matchDetails ?? []),
		});
	}

	async recordError(jobId: string, error: unknown): Promise<void> {
		await this.patchJob(jobId, {
			status: 'failed',
			error_message: error instanceof Error ? error.message : String(error),
		});
	}
}
