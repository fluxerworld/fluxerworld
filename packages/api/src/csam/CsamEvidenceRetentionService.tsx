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

import path from 'node:path';
import {Config} from '@fluxer/api/src/Config';
import {Db, deleteOneOrMany, fetchMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {
	CsamEvidenceExpirationRow,
	CsamEvidenceLegalHoldRow,
	CsamEvidencePackageRow,
} from '@fluxer/api/src/database/types/CsamTypes';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import {Logger} from '@fluxer/api/src/Logger';
import {CsamEvidenceExpirations, CsamEvidenceLegalHolds, CsamEvidencePackages} from '@fluxer/api/src/Tables';

export class CsamEvidenceRetentionService {
	private readonly bucket = Config.s3.buckets.reports;
	private readonly batchSize = Config.csam.cleanupBatchSize;

	constructor(private readonly storageService: IStorageService) {}

	async trackExpiration(reportId: bigint, expiresAt: Date | null): Promise<void> {
		if (!expiresAt) {
			return;
		}

		try {
			await upsertOne(
				CsamEvidenceExpirations.insert({
					bucket: this.bucket,
					expires_at: expiresAt,
					report_id: reportId,
				}),
			);
		} catch (error) {
			Logger.error({error, reportId: reportId.toString(), expiresAt}, 'Failed to track CSAM evidence expiration');
		}
	}

	async rescheduleExpiration(reportId: bigint, newExpiresAt: Date): Promise<void> {
		try {
			await upsertOne(CsamEvidencePackages.patchByPk({report_id: reportId}, {expires_at: Db.set(newExpiresAt)}));
			await this.trackExpiration(reportId, newExpiresAt);
		} catch (error) {
			Logger.error(
				{error, reportId: reportId.toString(), newExpiresAt},
				'Failed to reschedule CSAM evidence expiration',
			);
			throw error;
		}
	}

	async rescheduleForHold(reportId: bigint, heldUntil: Date | null): Promise<void> {
		try {
			await upsertOne(
				CsamEvidencePackages.patchByPk(
					{report_id: reportId},
					{
						expires_at: heldUntil ? Db.set(heldUntil) : Db.clear<Date>(),
					},
				),
			);
			if (heldUntil) {
				await this.trackExpiration(reportId, heldUntil);
			}
		} catch (error) {
			Logger.error(
				{error, reportId: reportId.toString(), heldUntil},
				'Failed to reschedule CSAM evidence for legal hold',
			);
			throw error;
		}
	}

	async cleanupExpired(): Promise<void> {
		const now = new Date();
		while (true) {
			const rows = await fetchMany<CsamEvidenceExpirationRow>(
				CsamEvidenceExpirations.select({
					where: [
						CsamEvidenceExpirations.where.eq('bucket', 'bucket'),
						CsamEvidenceExpirations.where.lte('expires_at', 'expires_at'),
					],
					orderBy: {col: 'expires_at', direction: 'ASC'},
					limit: this.batchSize,
				}).bind({
					bucket: this.bucket,
					expires_at: now,
				}),
			);

			if (rows.length === 0) {
				return;
			}

			let processedInBatch = 0;
			for (const row of rows) {
				try {
					await this.processExpiration(row, now);
					processedInBatch += 1;
				} catch (error) {
					Logger.error({error, reportId: row.report_id.toString()}, 'CSAM evidence cleanup failed for report');
				}
			}

			if (processedInBatch === 0) {
				Logger.error(
					{batchSize: rows.length},
					'CSAM evidence cleanup made no progress; stopping to avoid repeated failures',
				);
				return;
			}

			if (rows.length < this.batchSize) {
				return;
			}
		}
	}

	private async processExpiration(row: CsamEvidenceExpirationRow, deadline: Date): Promise<void> {
		const reportId = row.report_id;

		const pkg = await fetchOne<CsamEvidencePackageRow>(
			CsamEvidencePackages.select({
				where: [CsamEvidencePackages.where.eq('report_id', 'report_id')],
			}).bind({report_id: reportId}),
		);

		if (!pkg) {
			Logger.warn({reportId: reportId.toString()}, 'CSAM evidence package missing during cleanup');
			await this.deleteExpirationRow(row);
			return;
		}

		if (!pkg.expires_at || pkg.expires_at.getTime() > deadline.getTime()) {
			await this.deleteExpirationRow(row);
			return;
		}

		const hold = await fetchOne<CsamEvidenceLegalHoldRow>(
			CsamEvidenceLegalHolds.select({
				where: [CsamEvidenceLegalHolds.where.eq('report_id', 'report_id')],
			}).bind({report_id: reportId}),
		);

		if (hold && (!hold.held_until || hold.held_until.getTime() > deadline.getTime())) {
			Logger.debug({reportId: reportId.toString()}, 'CSAM evidence is on legal hold, skipping cleanup');
			await this.deleteExpirationRow(row);
			return;
		}

		await this.deleteEvidenceObjects(reportId, pkg);

		await upsertOne(
			CsamEvidencePackages.patchByPk(
				{report_id: reportId},
				{
					evidence_zip_key: Db.clear<string>(),
					hashes: Db.clear<string>(),
					frames: Db.clear<string>(),
					match_details: Db.clear<string>(),
					context_snapshot: Db.clear<string>(),
					expires_at: Db.clear<Date>(),
				},
			),
		);

		await this.deleteExpirationRow(row);
		Logger.info({reportId: reportId.toString()}, 'CSAM evidence expired and purged');
	}

	private async deleteEvidenceObjects(reportId: bigint, pkg: CsamEvidencePackageRow): Promise<void> {
		const bucket = this.bucket;
		const keysToDelete: Array<string> = [];

		if (pkg.evidence_zip_key) {
			keysToDelete.push(pkg.evidence_zip_key);
		}

		keysToDelete.push(this.buildAssetCopyKey(reportId, pkg));

		await Promise.all(keysToDelete.map((key) => this.storageService.deleteObject(bucket, key)));

		const attachmentsPrefix = `csam/evidence/${reportId.toString()}/attachments/`;
		const attachments = await this.storageService.listObjects({bucket, prefix: attachmentsPrefix});

		if (attachments.length > 0) {
			await this.storageService.deleteObjects({
				bucket,
				objects: attachments.map((entry) => ({Key: entry.key})),
			});
		}
	}

	private buildAssetCopyKey(reportId: bigint, pkg: CsamEvidencePackageRow): string {
		const base = pkg.key ? path.basename(pkg.key) : pkg.filename ? path.basename(pkg.filename) : 'asset';
		return `csam/evidence/${reportId.toString()}/asset/${base}`;
	}

	private async deleteExpirationRow(row: CsamEvidenceExpirationRow): Promise<void> {
		await deleteOneOrMany(
			CsamEvidenceExpirations.delete({
				where: [
					CsamEvidenceExpirations.where.eq('bucket', 'bucket'),
					CsamEvidenceExpirations.where.eq('expires_at', 'expires_at'),
					CsamEvidenceExpirations.where.eq('report_id', 'report_id'),
				],
			}).bind({
				bucket: row.bucket,
				expires_at: row.expires_at,
				report_id: row.report_id,
			}),
		);
	}
}
