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

import crypto from 'node:crypto';
import {createReportID} from '@fluxer/api/src/BrandedTypes';
import {
	type CreateSnapshotParams,
	CsamReportSnapshotService,
	type CsamReportSnapshotServiceDeps,
} from '@fluxer/api/src/csam/CsamReportSnapshotService';
import type {CsamResourceType} from '@fluxer/api/src/csam/CsamTypes';
import {createMockMatchResult, createNoopLogger, TEST_FIXTURES} from '@fluxer/api/src/csam/tests/CsamTestUtils';
import {clearSqliteStore} from '@fluxer/api/src/database/SqliteKV';
import {ReportStatus, ReportType} from '@fluxer/api/src/report/IReportRepository';
import {ReportRepository} from '@fluxer/api/src/report/ReportRepository';
import {MockCsamEvidenceService} from '@fluxer/api/src/test/mocks/MockCsamEvidenceService';
import {MockSnowflakeService} from '@fluxer/api/src/test/mocks/MockSnowflakeService';
import {MockStorageService} from '@fluxer/api/src/test/mocks/MockStorageService';
import {CATEGORY_CHILD_SAFETY} from '@fluxer/constants/src/ReportCategories';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

function createSnapshotParams(overrides?: Partial<CreateSnapshotParams>): CreateSnapshotParams {
	return {
		scanResult: createMockMatchResult({isMatch: true}),
		resourceType: 'attachment',
		userId: '123456789012345678',
		guildId: '234567890123456789',
		channelId: '345678901234567890',
		messageId: '456789012345678901',
		mediaData: TEST_FIXTURES.PNG_1X1_TRANSPARENT,
		filename: 'test-image.png',
		contentType: 'image/png',
		...overrides,
	};
}

describe('CsamReportSnapshotService', () => {
	let mockStorageService: MockStorageService;
	let reportRepository: ReportRepository;
	let mockSnowflakeService: MockSnowflakeService;
	let mockCsamEvidenceService: MockCsamEvidenceService;
	let snapshotService: CsamReportSnapshotService;

	beforeEach(async () => {
		clearSqliteStore();
		mockStorageService = new MockStorageService();
		reportRepository = new ReportRepository();
		mockSnowflakeService = new MockSnowflakeService({initialCounter: 1000000000000000000n});
		await mockSnowflakeService.initialize();
		mockCsamEvidenceService = new MockCsamEvidenceService();

		const deps: CsamReportSnapshotServiceDeps = {
			storageService: mockStorageService,
			reportRepository,
			snowflakeService: mockSnowflakeService,
			csamEvidenceService: mockCsamEvidenceService,
			logger: createNoopLogger(),
		};

		snapshotService = new CsamReportSnapshotService(deps);
	});

	afterEach(() => {
		mockStorageService.reset();
		mockSnowflakeService.reset();
		mockCsamEvidenceService.reset();
		clearSqliteStore();
	});

	describe('createSnapshot', () => {
		it('creates report with correct metadata', async () => {
			const scanResult = createMockMatchResult({
				isMatch: true,
				trackingId: 'test-tracking-id-123',
			});
			const params = createSnapshotParams({scanResult});

			const reportId = await snapshotService.createSnapshot(params);

			const report = await reportRepository.getReport(createReportID(reportId));
			expect(report).not.toBeNull();
			expect(report!.status).toBe(ReportStatus.PENDING);
			expect(report!.reportType).toBe(ReportType.MESSAGE);
			expect(report!.category).toBe(CATEGORY_CHILD_SAFETY);
			expect(report!.reporterId).toBeNull();
			expect(report!.auditLogReason).toBe('CSAM match test-tracking-id-123');

			const additionalInfo = JSON.parse(report!.additionalInfo!);
			expect(additionalInfo.trackingId).toBe('test-tracking-id-123');
			expect(additionalInfo.resourceType).toBe('attachment');
			expect(additionalInfo.matchDetails).toBeDefined();
			expect(additionalInfo.hashes).toBeDefined();
			expect(additionalInfo.integrity).toBeDefined();
			expect(additionalInfo.evidenceZip).toBeDefined();
		});

		it('stores evidence to reports bucket', async () => {
			const params = createSnapshotParams();

			await snapshotService.createSnapshot(params);

			expect(mockStorageService.uploadObjectSpy).toHaveBeenCalledOnce();

			const uploadCall = mockStorageService.uploadObjectSpy.mock.calls[0]![0]!;
			expect(uploadCall.bucket).toContain('reports');
			expect(uploadCall.key).toContain('csam/evidence/');
			expect(uploadCall.key).toContain('/asset/');
			expect(uploadCall.body).toEqual(TEST_FIXTURES.PNG_1X1_TRANSPARENT);
			expect(uploadCall.contentType).toBe('image/png');
		});

		it('generates unique report IDs using snowflake service', async () => {
			const params1 = createSnapshotParams();
			const params2 = createSnapshotParams();

			const reportId1 = await snapshotService.createSnapshot(params1);
			const reportId2 = await snapshotService.createSnapshot(params2);

			expect(mockSnowflakeService.generateSpy).toHaveBeenCalledTimes(2);
			expect(reportId1).not.toBe(reportId2);
			const generatedIds = mockSnowflakeService.getGeneratedIds();
			expect(generatedIds).toHaveLength(2);
			expect(generatedIds[0]).toBe(reportId1);
			expect(generatedIds[1]).toBe(reportId2);
		});

		it('preserves user context in report', async () => {
			const params = createSnapshotParams({
				userId: '111111111111111111',
				guildId: '222222222222222222',
				channelId: '333333333333333333',
				messageId: '444444444444444444',
			});

			const reportId = await snapshotService.createSnapshot(params);

			const report = await reportRepository.getReport(createReportID(reportId));
			expect(report).not.toBeNull();
			expect(report!.reportedUserId).toEqual(111111111111111111n);
			expect(report!.reportedGuildId).toEqual(222222222222222222n);
			expect(report!.reportedChannelId).toEqual(333333333333333333n);
			expect(report!.reportedMessageId).toEqual(444444444444444444n);
			expect(report!.guildContextId).toEqual(222222222222222222n);
		});

		it('handles missing user context fields', async () => {
			const params = createSnapshotParams({
				userId: null,
				guildId: null,
				channelId: null,
				messageId: null,
			});

			const reportId = await snapshotService.createSnapshot(params);

			const report = await reportRepository.getReport(createReportID(reportId));
			expect(report).not.toBeNull();
			expect(report!.reportedUserId).toBeNull();
			expect(report!.reportedGuildId).toBeNull();
			expect(report!.reportedChannelId).toBeNull();
			expect(report!.reportedMessageId).toBeNull();
			expect(report!.guildContextId).toBeNull();
		});

		it('handles partial context with only userId', async () => {
			const params = createSnapshotParams({
				userId: '555555555555555555',
				guildId: null,
				channelId: null,
				messageId: null,
			});

			const reportId = await snapshotService.createSnapshot(params);

			const report = await reportRepository.getReport(createReportID(reportId));
			expect(report).not.toBeNull();
			expect(report!.reportedUserId).toEqual(555555555555555555n);
			expect(report!.reportedGuildId).toBeNull();
			expect(report!.reportedChannelId).toBeNull();
			expect(report!.reportedMessageId).toBeNull();
		});

		it('handles partial context with guildId but no messageId', async () => {
			const params = createSnapshotParams({
				userId: '666666666666666666',
				guildId: '777777777777777777',
				channelId: '888888888888888888',
				messageId: null,
			});

			const reportId = await snapshotService.createSnapshot(params);

			const report = await reportRepository.getReport(createReportID(reportId));
			expect(report).not.toBeNull();
			expect(report!.reportedUserId).toEqual(666666666666666666n);
			expect(report!.reportedGuildId).toEqual(777777777777777777n);
			expect(report!.reportedChannelId).toEqual(888888888888888888n);
			expect(report!.reportedMessageId).toBeNull();
			expect(report!.guildContextId).toEqual(777777777777777777n);
		});

		it('computes SHA-256 integrity hash for evidence', async () => {
			const mediaData = TEST_FIXTURES.PNG_1X1_TRANSPARENT;
			const params = createSnapshotParams({mediaData});

			const reportId = await snapshotService.createSnapshot(params);

			const expectedHash = crypto.createHash('sha256').update(mediaData).digest('hex');

			const report = await reportRepository.getReport(createReportID(reportId));
			expect(report).not.toBeNull();
			const additionalInfo = JSON.parse(report!.additionalInfo!);
			expect(additionalInfo.hashes).toContain(expectedHash);

			expect(mockCsamEvidenceService.storeEvidenceSpy).toHaveBeenCalledOnce();
			const evidenceEntry = mockCsamEvidenceService.getStoredEvidence()[0]!;
			expect(evidenceEntry.args.hashes).toContain(expectedHash);
		});

		it('computes different hashes for different media data', async () => {
			const params1 = createSnapshotParams({mediaData: TEST_FIXTURES.PNG_1X1_TRANSPARENT});
			const params2 = createSnapshotParams({mediaData: TEST_FIXTURES.JPEG_1X1_RED});

			const reportId1 = await snapshotService.createSnapshot(params1);
			const reportId2 = await snapshotService.createSnapshot(params2);

			const report1 = await reportRepository.getReport(createReportID(reportId1));
			const report2 = await reportRepository.getReport(createReportID(reportId2));
			expect(report1).not.toBeNull();
			expect(report2).not.toBeNull();

			const additionalInfo1 = JSON.parse(report1!.additionalInfo!);
			const additionalInfo2 = JSON.parse(report2!.additionalInfo!);

			expect(additionalInfo1.hashes[0]).not.toBe(additionalInfo2.hashes[0]);
		});

		describe('different resource types', () => {
			const resourceTypes: Array<CsamResourceType> = ['attachment', 'avatar', 'emoji', 'sticker', 'banner', 'other'];

			for (const resourceType of resourceTypes) {
				it(`works for ${resourceType} resource type`, async () => {
					const params = createSnapshotParams({resourceType});

					const reportId = await snapshotService.createSnapshot(params);

					expect(reportId).toBeDefined();

					const report = await reportRepository.getReport(createReportID(reportId));
					expect(report).not.toBeNull();
					const additionalInfo = JSON.parse(report!.additionalInfo!);
					expect(additionalInfo.resourceType).toBe(resourceType);

					const evidenceEntries = mockCsamEvidenceService.getStoredEvidence();
					expect(evidenceEntries.length).toBeGreaterThan(0);
					const evidenceEntry = evidenceEntries[evidenceEntries.length - 1]!;
					expect(evidenceEntry.args.job.resourceType).toBe(resourceType);
				});
			}
		});

		it('passes correct job payload to evidence service', async () => {
			const params = createSnapshotParams({
				resourceType: 'emoji',
				userId: '999999999999999999',
				guildId: '888888888888888888',
				channelId: null,
				messageId: null,
				filename: 'custom_emoji.png',
				contentType: 'image/png',
			});

			await snapshotService.createSnapshot(params);

			expect(mockCsamEvidenceService.storeEvidenceSpy).toHaveBeenCalledOnce();
			const evidenceEntry = mockCsamEvidenceService.getStoredEvidence()[0]!;

			expect(evidenceEntry.args.job.resourceType).toBe('emoji');
			expect(evidenceEntry.args.job.userId).toBe('999999999999999999');
			expect(evidenceEntry.args.job.guildId).toBe('888888888888888888');
			expect(evidenceEntry.args.job.channelId).toBeNull();
			expect(evidenceEntry.args.job.messageId).toBeNull();
			expect(evidenceEntry.args.job.filename).toBe('custom_emoji.png');
			expect(evidenceEntry.args.job.contentType).toBe('image/png');
			expect(evidenceEntry.args.job.cdnUrl).toBeNull();
		});

		it('includes match result in evidence', async () => {
			const scanResult = createMockMatchResult({
				isMatch: true,
				trackingId: 'specific-tracking-id',
				matchDetails: [
					{
						source: 'test-source',
						violations: ['CSAM', 'EXPLOITATION'],
						matchDistance: 0.005,
						matchId: 'match-id-123',
					},
				],
			});
			const params = createSnapshotParams({scanResult});

			await snapshotService.createSnapshot(params);

			const evidenceEntry = mockCsamEvidenceService.getStoredEvidence()[0]!;
			expect(evidenceEntry.args.matchResult.isMatch).toBe(true);
			expect(evidenceEntry.args.matchResult.trackingId).toBe('specific-tracking-id');
			expect(evidenceEntry.args.matchResult.matchDetails).toHaveLength(1);
			expect(evidenceEntry.args.matchResult.matchDetails[0]!.source).toBe('test-source');
		});

		it('returns the generated report ID', async () => {
			const params = createSnapshotParams();

			const reportId = await snapshotService.createSnapshot(params);

			const generatedIds = mockSnowflakeService.getGeneratedIds();
			expect(reportId).toBe(generatedIds[0]);
			expect(typeof reportId).toBe('bigint');
		});

		it('uses report ID in storage key path', async () => {
			const params = createSnapshotParams();

			const reportId = await snapshotService.createSnapshot(params);

			const uploadCall = mockStorageService.uploadObjectSpy.mock.calls[0]![0]!;
			expect(uploadCall.key).toContain(reportId.toString());
		});

		it('handles null contentType gracefully', async () => {
			const params = createSnapshotParams({contentType: null});

			await snapshotService.createSnapshot(params);

			expect(mockStorageService.uploadObjectSpy).toHaveBeenCalledOnce();
			const uploadCall = mockStorageService.uploadObjectSpy.mock.calls[0]![0]!;
			expect(uploadCall.contentType).toBeUndefined();
		});

		it('propagates storage upload errors', async () => {
			mockStorageService.configure({shouldFailUpload: true});

			const params = createSnapshotParams();

			await expect(snapshotService.createSnapshot(params)).rejects.toThrow('Mock storage upload failure');
		});

		it('records reported_at timestamp', async () => {
			const beforeSnapshot = new Date();
			const params = createSnapshotParams();

			const reportId = await snapshotService.createSnapshot(params);

			const afterSnapshot = new Date();
			const report = await reportRepository.getReport(createReportID(reportId));
			expect(report).not.toBeNull();

			expect(report!.reportedAt.getTime()).toBeGreaterThanOrEqual(beforeSnapshot.getTime());
			expect(report!.reportedAt.getTime()).toBeLessThanOrEqual(afterSnapshot.getTime());
		});

		it('sets correct null fields for system-generated report', async () => {
			const params = createSnapshotParams();

			const reportId = await snapshotService.createSnapshot(params);

			const report = await reportRepository.getReport(createReportID(reportId));
			expect(report).not.toBeNull();
			expect(report!.reporterEmail).toBeNull();
			expect(report!.reporterFullLegalName).toBeNull();
			expect(report!.reporterCountryOfResidence).toBeNull();
			expect(report!.reportedUserAvatarHash).toBeNull();
			expect(report!.reportedGuildName).toBeNull();
			expect(report!.reportedGuildIconHash).toBeNull();
			expect(report!.reportedChannelName).toBeNull();
			expect(report!.messageContext).toBeNull();
			expect(report!.resolvedAt).toBeNull();
			expect(report!.resolvedByAdminId).toBeNull();
			expect(report!.publicComment).toBeNull();
			expect(report!.reportedGuildInviteCode).toBeNull();
		});
	});
});
