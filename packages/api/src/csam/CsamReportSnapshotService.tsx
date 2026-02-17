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
import {createChannelID, createGuildID, createMessageID, createUserID} from '@fluxer/api/src/BrandedTypes';
import {Config} from '@fluxer/api/src/Config';
import {SYSTEM_USER_ID} from '@fluxer/api/src/constants/Core';
import type {CsamResourceType, PhotoDnaMatchResult} from '@fluxer/api/src/csam/CsamTypes';
import type {ICsamEvidenceService} from '@fluxer/api/src/csam/ICsamEvidenceService';
import type {ICsamReportSnapshotService} from '@fluxer/api/src/csam/ICsamReportSnapshotService';
import type {ILogger} from '@fluxer/api/src/ILogger';
import type {ISnowflakeService} from '@fluxer/api/src/infrastructure/ISnowflakeService';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import type {IReportRepository} from '@fluxer/api/src/report/IReportRepository';
import {ReportStatus, ReportType} from '@fluxer/api/src/report/IReportRepository';
import {CATEGORY_CHILD_SAFETY} from '@fluxer/constants/src/ReportCategories';

export interface CreateSnapshotParams {
	scanResult: PhotoDnaMatchResult;
	resourceType: CsamResourceType;
	userId: string | null;
	guildId: string | null;
	channelId: string | null;
	messageId: string | null;
	mediaData: Buffer;
	filename: string;
	contentType: string | null;
}

export interface CsamReportSnapshotServiceDeps {
	storageService: IStorageService;
	reportRepository: IReportRepository;
	snowflakeService: ISnowflakeService;
	csamEvidenceService: ICsamEvidenceService;
	logger: ILogger;
}

export class CsamReportSnapshotService implements ICsamReportSnapshotService {
	private readonly storageService: IStorageService;
	private readonly reportRepository: IReportRepository;
	private readonly snowflakeService: ISnowflakeService;
	private readonly csamEvidenceService: ICsamEvidenceService;
	private readonly logger: ILogger;

	constructor(deps: CsamReportSnapshotServiceDeps) {
		this.storageService = deps.storageService;
		this.reportRepository = deps.reportRepository;
		this.snowflakeService = deps.snowflakeService;
		this.csamEvidenceService = deps.csamEvidenceService;
		this.logger = deps.logger;
	}

	async createSnapshot(params: CreateSnapshotParams): Promise<bigint> {
		const {scanResult, resourceType, userId, guildId, channelId, messageId, mediaData, filename, contentType} = params;

		const reportId = await this.snowflakeService.generate();
		const idString = reportId.toString();

		const integrityHash = crypto.createHash('sha256').update(mediaData).digest('hex');

		const assetKey = `csam/evidence/${idString}/asset/${filename}`;

		try {
			await this.storageService.uploadObject({
				bucket: Config.s3.buckets.reports,
				key: assetKey,
				body: mediaData,
				contentType: contentType ?? undefined,
			});
		} catch (error) {
			this.logger.error({error, reportId: idString, filename}, 'Failed to upload CSAM evidence asset');
			throw error;
		}

		const evidenceResult = await this.csamEvidenceService.storeEvidence({
			reportId,
			job: {
				jobId: idString,
				resourceType,
				bucket: Config.s3.buckets.reports,
				key: assetKey,
				cdnUrl: null,
				filename,
				contentType,
				channelId,
				messageId,
				guildId,
				userId,
			},
			matchResult: scanResult,
			frames: [],
			hashes: [integrityHash],
		});

		const reportRow = {
			report_id: reportId,
			reporter_id: SYSTEM_USER_ID,
			reporter_email: null,
			reporter_full_legal_name: null,
			reporter_country_of_residence: null,
			reported_at: new Date(),
			status: ReportStatus.PENDING,
			report_type: ReportType.MESSAGE,
			category: CATEGORY_CHILD_SAFETY,
			additional_info: JSON.stringify({
				trackingId: scanResult.trackingId,
				matchDetails: scanResult.matchDetails,
				hashes: [integrityHash],
				integrity: evidenceResult.integrityHash,
				evidenceZip: evidenceResult.evidenceZipKey,
				resourceType,
			}),
			reported_user_id: userId ? createUserID(BigInt(userId)) : null,
			reported_user_avatar_hash: null,
			reported_guild_id: guildId ? createGuildID(BigInt(guildId)) : null,
			reported_guild_name: null,
			reported_guild_icon_hash: null,
			reported_message_id: messageId ? createMessageID(BigInt(messageId)) : null,
			reported_channel_id: channelId ? createChannelID(BigInt(channelId)) : null,
			reported_channel_name: null,
			message_context: null,
			guild_context_id: guildId ? createGuildID(BigInt(guildId)) : null,
			resolved_at: null,
			resolved_by_admin_id: null,
			public_comment: null,
			audit_log_reason: `CSAM match ${scanResult.trackingId}`,
			reported_guild_invite_code: null,
		};

		await this.reportRepository.createReport(reportRow);

		this.logger.info(
			{reportId: idString, resourceType, trackingId: scanResult.trackingId},
			'CSAM report snapshot created',
		);

		return reportId;
	}
}
