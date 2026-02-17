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
import path from 'node:path';
import {Config} from '@fluxer/api/src/Config';
import type {CsamEvidenceRetentionService} from '@fluxer/api/src/csam/CsamEvidenceRetentionService';
import type {AttachmentEvidenceInfo, EvidenceContext} from '@fluxer/api/src/csam/CsamTypes';
import type {
	ICsamEvidenceService,
	StoreEvidenceArgs,
	StoreEvidenceResult,
} from '@fluxer/api/src/csam/ICsamEvidenceService';
import {upsertOne} from '@fluxer/api/src/database/Cassandra';
import type {CsamEvidencePackageRow} from '@fluxer/api/src/database/types/CsamTypes';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import {Logger} from '@fluxer/api/src/Logger';
import {CsamEvidencePackages} from '@fluxer/api/src/Tables';
import {recordCsamEvidenceStorage} from '@fluxer/api/src/telemetry/CsamTelemetry';
import {MS_PER_DAY} from '@fluxer/date_utils/src/DateConstants';
import archiver from 'archiver';

function bigintReplacer(_key: string, value: unknown): unknown {
	return typeof value === 'bigint' ? value.toString() : value;
}

export class CsamEvidenceService implements ICsamEvidenceService {
	constructor(
		private readonly storageService: IStorageService,
		private readonly retentionService: CsamEvidenceRetentionService,
	) {}

	async storeEvidence(args: StoreEvidenceArgs): Promise<StoreEvidenceResult> {
		const {reportId, job, matchResult, frames, hashes, context} = args;
		if (!job.bucket || !job.key) {
			throw new Error('CSAM job missing bucket or key');
		}

		const idString = reportId.toString();
		const assetCopyKey = `csam/evidence/${idString}/asset/${path.basename(job.key) || 'asset'}`;
		try {
			await this.storageService.copyObject({
				sourceBucket: job.bucket,
				sourceKey: job.key,
				destinationBucket: Config.s3.buckets.reports,
				destinationKey: assetCopyKey,
			});
		} catch (error) {
			Logger.error({error, reportId: idString, source: job.key}, 'Failed to copy CSAM asset to reports bucket');
			throw error;
		}

		const assetBuffer = await this.storageService.readObject(job.bucket, job.key);
		const integrityHash = crypto.createHash('sha256').update(assetBuffer).digest('hex');

		const contextSnapshot: EvidenceContext | null = context ?? null;
		const assetEntryName = `asset/${path.basename(job.key) || job.filename || 'asset'}`;
		const evidenceZipKey = `csam/evidence/${idString}/evidence.zip`;

		const metadataPayload = {
			reportId: idString,
			job,
			matchResult,
			frames,
			hashes,
			context: contextSnapshot,
			createdAt: new Date().toISOString(),
			assetEntryName,
			evidenceZipKey,
		};

		const archiveEntries: Array<{name: string; content: Buffer}> = [
			{
				name: 'metadata.json',
				content: Buffer.from(JSON.stringify(metadataPayload, bigintReplacer, 2)),
			},
			{
				name: 'match.json',
				content: Buffer.from(JSON.stringify(matchResult, bigintReplacer, 2)),
			},
			{
				name: 'frames.json',
				content: Buffer.from(JSON.stringify(frames, bigintReplacer, 2)),
			},
		];

		for (let index = 0; index < frames.length; index += 1) {
			const frame = frames[index];
			let frameBuffer: Buffer;
			try {
				frameBuffer = Buffer.from(frame.base64, 'base64');
			} catch (error) {
				Logger.warn({error, reportId: idString, frameIndex: index}, 'Failed to decode frame for archive');
				recordCsamEvidenceStorage({status: 'error', evidenceType: 'frame'});
				continue;
			}
			archiveEntries.push({
				name: `frames/frame-${index + 1}.jpg`,
				content: frameBuffer,
			});
			recordCsamEvidenceStorage({status: 'success', evidenceType: 'frame'});
		}

		if (hashes.length > 0) {
			archiveEntries.push({
				name: 'hashes.json',
				content: Buffer.from(JSON.stringify(hashes, bigintReplacer, 2)),
			});
		}

		if (contextSnapshot) {
			archiveEntries.push({
				name: 'context.json',
				content: Buffer.from(JSON.stringify(contextSnapshot, bigintReplacer, 2)),
			});
			if (contextSnapshot.contactLogs && contextSnapshot.contactLogs.length > 0) {
				archiveEntries.push({
					name: 'contact_logs.json',
					content: Buffer.from(JSON.stringify(contextSnapshot.contactLogs, bigintReplacer, 2)),
				});
			}
			const attachments: Array<AttachmentEvidenceInfo> =
				contextSnapshot.attachments?.filter(
					(entry: Record<string, unknown> | AttachmentEvidenceInfo): entry is AttachmentEvidenceInfo =>
						typeof entry === 'object' &&
						entry !== null &&
						typeof (entry as AttachmentEvidenceInfo).attachmentId === 'string' &&
						typeof (entry as AttachmentEvidenceInfo).evidenceKey === 'string',
				) ?? [];
			for (const attachment of attachments) {
				try {
					const attachmentBuffer = await this.storageService.readObject(
						Config.s3.buckets.reports,
						attachment.evidenceKey,
					);
					const attachmentName = `attachments/${attachment.attachmentId}/${attachment.filename}`;
					archiveEntries.push({
						name: attachmentName,
						content: Buffer.from(attachmentBuffer),
					});
					recordCsamEvidenceStorage({status: 'success', evidenceType: 'attachment'});
				} catch (error) {
					Logger.error(
						{error, reportId: idString, attachmentId: attachment.attachmentId},
						'Failed to include attachment in CSAM evidence archive',
					);
					recordCsamEvidenceStorage({status: 'error', evidenceType: 'attachment'});
				}
			}
		}

		archiveEntries.push({
			name: assetEntryName,
			content: Buffer.from(assetBuffer),
		});

		const archiveBuffer = await this.buildEvidenceArchive(archiveEntries);
		try {
			await this.storageService.uploadObject({
				bucket: Config.s3.buckets.reports,
				key: evidenceZipKey,
				body: archiveBuffer,
				contentType: 'application/zip',
			});
			recordCsamEvidenceStorage({status: 'success', evidenceType: 'package'});
		} catch (error) {
			Logger.error({error, reportId: idString, evidenceZipKey}, 'Failed to upload CSAM evidence package');
			recordCsamEvidenceStorage({status: 'error', evidenceType: 'package'});
			throw error;
		}

		const now = new Date();
		const retentionMs = Math.max(1, Config.csam.evidenceRetentionDays) * MS_PER_DAY;
		const expiresAt = new Date(now.getTime() + retentionMs);

		const packageRow: CsamEvidencePackageRow = {
			report_id: reportId,
			resource_type: job.resourceType,
			bucket: job.bucket,
			key: job.key,
			cdn_url: job.cdnUrl,
			filename: job.filename,
			content_type: job.contentType,
			channel_id: job.channelId ? BigInt(job.channelId) : null,
			message_id: job.messageId ? BigInt(job.messageId) : null,
			guild_id: job.guildId ? BigInt(job.guildId) : null,
			user_id: job.userId ? BigInt(job.userId) : null,
			match_tracking_id: matchResult.trackingId || null,
			match_details: JSON.stringify(matchResult.matchDetails ?? [], bigintReplacer),
			frames: JSON.stringify(frames, bigintReplacer),
			hashes: JSON.stringify(hashes, bigintReplacer),
			context_snapshot: contextSnapshot ? JSON.stringify(contextSnapshot, bigintReplacer) : null,
			created_at: now,
			expires_at: expiresAt,
			integrity_sha256: integrityHash,
			evidence_zip_key: evidenceZipKey,
		};

		await upsertOne(CsamEvidencePackages.insert(packageRow));
		await this.retentionService.trackExpiration(reportId, expiresAt);

		return {
			integrityHash,
			evidenceZipKey,
			assetCopyKey,
		};
	}

	private async buildEvidenceArchive(entries: Array<{name: string; content: Buffer}>): Promise<Buffer> {
		const archive = archiver('zip', {zlib: {level: 9}});
		const chunks: Array<Buffer> = [];

		archive.on('data', (chunk) => {
			chunks.push(Buffer.from(chunk));
		});

		const done = new Promise<void>((resolve, reject) => {
			archive.once('error', reject);
			archive.once('end', () => resolve());
		});

		for (const entry of entries) {
			archive.append(entry.content, {name: entry.name});
		}

		archive.finalize();
		await done;

		return Buffer.concat(chunks);
	}
}
