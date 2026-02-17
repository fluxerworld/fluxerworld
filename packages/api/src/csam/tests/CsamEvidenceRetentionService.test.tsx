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
import {CsamEvidenceRetentionService} from '@fluxer/api/src/csam/CsamEvidenceRetentionService';
import {fetchMany, fetchOne, upsertOne} from '@fluxer/api/src/database/Cassandra';
import {clearSqliteStore} from '@fluxer/api/src/database/SqliteKV';
import type {CsamEvidenceExpirationRow, CsamEvidencePackageRow} from '@fluxer/api/src/database/types/CsamTypes';
import {CsamEvidenceExpirations, CsamEvidencePackages} from '@fluxer/api/src/Tables';
import {MockStorageService} from '@fluxer/api/src/test/mocks/MockStorageService';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

function buildEvidencePackageRow(reportId: bigint, expiresAt: Date): CsamEvidencePackageRow {
	return {
		report_id: reportId,
		resource_type: 'attachment',
		bucket: 'test-source-bucket',
		key: `csam/source/${reportId.toString()}/asset.png`,
		cdn_url: null,
		filename: 'asset.png',
		content_type: 'image/png',
		channel_id: null,
		message_id: null,
		guild_id: null,
		user_id: null,
		match_tracking_id: 'test-tracking-id',
		match_details: JSON.stringify([{source: 'test', matchId: 'match'}]),
		frames: JSON.stringify([{index: 0, timestamp: 0}]),
		hashes: JSON.stringify([{hash: 'deadbeef'}]),
		context_snapshot: JSON.stringify({context: 'snapshot'}),
		created_at: new Date(expiresAt.getTime() - 1000),
		expires_at: expiresAt,
		integrity_sha256: 'deadbeef',
		evidence_zip_key: `csam/evidence/${reportId.toString()}/evidence.zip`,
	};
}

function buildExpirationRow(reportId: bigint, expiresAt: Date): CsamEvidenceExpirationRow {
	return {
		bucket: Config.s3.buckets.reports,
		expires_at: expiresAt,
		report_id: reportId,
	};
}

describe('CsamEvidenceRetentionService', () => {
	let storageService: MockStorageService;
	let retentionService: CsamEvidenceRetentionService;

	beforeEach(() => {
		clearSqliteStore();
		storageService = new MockStorageService();
		retentionService = new CsamEvidenceRetentionService(storageService);
	});

	afterEach(() => {
		storageService.reset();
		clearSqliteStore();
	});

	it('processes all expired evidence across multiple batches', async () => {
		const totalRows = Config.csam.cleanupBatchSize + 1;
		const baseTime = Date.now();

		for (let index = 0; index < totalRows; index += 1) {
			const reportId = BigInt(1000 + index);
			const expiresAt = new Date(baseTime - (index + 1) * 1000);
			const packageRow = buildEvidencePackageRow(reportId, expiresAt);
			const expirationRow = buildExpirationRow(reportId, expiresAt);

			await upsertOne(CsamEvidencePackages.insert(packageRow));
			await upsertOne(CsamEvidenceExpirations.insert(expirationRow));
		}

		await retentionService.cleanupExpired();

		const remainingExpirations = await fetchMany<CsamEvidenceExpirationRow>(
			CsamEvidenceExpirations.select({
				where: CsamEvidenceExpirations.where.eq('bucket', 'bucket'),
			}).bind({bucket: Config.s3.buckets.reports}),
		);

		expect(remainingExpirations).toHaveLength(0);

		const sampleReportId = 1000n;
		const updatedPackage = await fetchOne<CsamEvidencePackageRow>(
			CsamEvidencePackages.select({
				where: [CsamEvidencePackages.where.eq('report_id', 'report_id')],
			}).bind({report_id: sampleReportId}),
		);

		expect(updatedPackage).not.toBeNull();
		expect(updatedPackage!.evidence_zip_key).toBeNull();
		expect(updatedPackage!.expires_at).toBeNull();
		expect(updatedPackage!.hashes).toBeNull();
	});
});
