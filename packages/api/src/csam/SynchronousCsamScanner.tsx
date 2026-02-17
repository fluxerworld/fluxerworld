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

import type {CsamScanContext, ICsamScanQueueService} from '@fluxer/api/src/csam/CsamScanQueueService';
import type {CsamResourceType, FrameSample, PhotoDnaMatchResult} from '@fluxer/api/src/csam/CsamTypes';
import type {ISynchronousCsamScanner} from '@fluxer/api/src/csam/ISynchronousCsamScanner';
import type {IPhotoDnaHashClient} from '@fluxer/api/src/csam/PhotoDnaHashClient';
import type {ILogger} from '@fluxer/api/src/ILogger';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import {withBusinessSpan} from '@fluxer/api/src/telemetry/BusinessSpans';
import {recordCsamMatch, recordCsamScan, recordCsamScanDuration} from '@fluxer/api/src/telemetry/CsamTelemetry';

export interface SynchronousCsamScannerOptions {
	enabled: boolean;
	logger: ILogger;
}

export interface ScanMediaParams {
	bucket: string;
	key: string;
	contentType: string | null;
	context?: CsamScanContext;
}

export interface ScanBase64Params {
	base64: string;
	mimeType: string;
	context?: CsamScanContext;
}

export interface SynchronousCsamScanResult {
	isMatch: boolean;
	matchResult?: PhotoDnaMatchResult;
	frames?: Array<FrameSample>;
	hashes?: Array<string>;
}

const SCANNABLE_IMAGE_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/bmp',
	'image/tiff',
	'image/avif',
	'image/apng',
]);

const SCANNABLE_VIDEO_TYPES = new Set([
	'video/mp4',
	'video/webm',
	'video/quicktime',
	'video/x-msvideo',
	'video/x-matroska',
]);

function isScannableMediaType(contentType: string | null): boolean {
	if (!contentType) {
		return false;
	}
	const normalized = contentType.toLowerCase().split(';')[0].trim();
	return SCANNABLE_IMAGE_TYPES.has(normalized) || SCANNABLE_VIDEO_TYPES.has(normalized);
}

function isVideoType(contentType: string): boolean {
	const normalized = contentType.toLowerCase().split(';')[0].trim();
	return SCANNABLE_VIDEO_TYPES.has(normalized);
}

function createDefaultContext(resourceType: CsamResourceType = 'other'): CsamScanContext {
	return {
		resourceType,
		userId: null,
		guildId: null,
		channelId: null,
		messageId: null,
	};
}

export class SynchronousCsamScanner implements ISynchronousCsamScanner {
	constructor(
		private readonly hashClient: IPhotoDnaHashClient,
		private readonly mediaService: IMediaService,
		private readonly queueService: ICsamScanQueueService | null,
		private readonly options: SynchronousCsamScannerOptions,
	) {}

	async scanMedia(params: ScanMediaParams): Promise<SynchronousCsamScanResult> {
		if (!this.options.enabled || !this.queueService) {
			return {isMatch: false};
		}

		const context = params.context ?? createDefaultContext();
		const mediaType = params.contentType ?? 'unknown';

		if (!isScannableMediaType(params.contentType)) {
			this.options.logger.debug(
				{bucket: params.bucket, key: params.key, contentType: params.contentType},
				'Skipping non-scannable media type',
			);
			recordCsamScan({
				resourceType: context.resourceType,
				mediaType,
				status: 'skipped',
			});
			return {isMatch: false};
		}

		return await withBusinessSpan(
			'fluxer.csam.scan_media',
			'fluxer.csam.scans.media',
			{resource_type: context.resourceType},
			async () => {
				const startTime = Date.now();

				try {
					const frames = await this.extractFramesFromS3(params.bucket, params.key, params.contentType!);
					if (frames.length === 0) {
						this.options.logger.debug({bucket: params.bucket, key: params.key}, 'No frames extracted from media');
						const durationMs = Date.now() - startTime;
						recordCsamScan({
							resourceType: context.resourceType,
							mediaType,
							status: 'success',
						});
						recordCsamScanDuration({
							resourceType: context.resourceType,
							durationMs,
						});
						return {isMatch: false};
					}

					const hashes = await this.hashClient.hashFrames(frames);
					if (hashes.length === 0) {
						this.options.logger.debug('No hashes generated from frames');
						const durationMs = Date.now() - startTime;
						recordCsamScan({
							resourceType: context.resourceType,
							mediaType,
							status: 'success',
						});
						recordCsamScanDuration({
							resourceType: context.resourceType,
							durationMs,
						});
						return {isMatch: false, frames, hashes: []};
					}

					const result = await this.queueService!.submitScan({
						hashes,
						context,
					});

					const durationMs = Date.now() - startTime;

					if (result.isMatch) {
						this.options.logger.warn(
							{trackingId: result.matchResult?.trackingId, matchCount: result.matchResult?.matchDetails.length},
							'CSAM match detected',
						);
						recordCsamMatch({
							resourceType: context.resourceType,
							source: 'synchronous',
							matchCount: result.matchResult?.matchDetails.length ?? 0,
						});
					}

					recordCsamScan({
						resourceType: context.resourceType,
						mediaType,
						status: 'success',
					});
					recordCsamScanDuration({
						resourceType: context.resourceType,
						durationMs,
					});

					return {
						isMatch: result.isMatch,
						matchResult: result.matchResult,
						frames,
						hashes,
					};
				} catch (error) {
					const durationMs = Date.now() - startTime;
					this.options.logger.error({error, bucket: params.bucket, key: params.key}, 'Failed to scan media');
					recordCsamScan({
						resourceType: context.resourceType,
						mediaType,
						status: 'error',
					});
					recordCsamScanDuration({
						resourceType: context.resourceType,
						durationMs,
					});
					throw error;
				}
			},
		);
	}

	async scanBase64(params: ScanBase64Params): Promise<SynchronousCsamScanResult> {
		if (!this.options.enabled || !this.queueService) {
			return {isMatch: false};
		}

		const context = params.context ?? createDefaultContext();

		if (!isScannableMediaType(params.mimeType)) {
			this.options.logger.debug({mimeType: params.mimeType}, 'Skipping non-scannable media type');
			recordCsamScan({
				resourceType: context.resourceType,
				mediaType: params.mimeType,
				status: 'skipped',
			});
			return {isMatch: false};
		}

		return await withBusinessSpan(
			'fluxer.csam.scan_base64',
			'fluxer.csam.scans.base64',
			{resource_type: context.resourceType},
			async () => {
				const startTime = Date.now();

				try {
					const frames: Array<FrameSample> = [
						{
							timestamp: 0,
							mimeType: params.mimeType,
							base64: params.base64,
						},
					];

					const hashes = await this.hashClient.hashFrames(frames);
					if (hashes.length === 0) {
						this.options.logger.debug('No hashes generated from frames');
						const durationMs = Date.now() - startTime;
						recordCsamScan({
							resourceType: context.resourceType,
							mediaType: params.mimeType,
							status: 'success',
						});
						recordCsamScanDuration({
							resourceType: context.resourceType,
							durationMs,
						});
						return {isMatch: false, frames, hashes: []};
					}

					const result = await this.queueService!.submitScan({
						hashes,
						context,
					});

					const durationMs = Date.now() - startTime;

					if (result.isMatch) {
						this.options.logger.warn(
							{trackingId: result.matchResult?.trackingId, matchCount: result.matchResult?.matchDetails.length},
							'CSAM match detected',
						);
						recordCsamMatch({
							resourceType: context.resourceType,
							source: 'synchronous',
							matchCount: result.matchResult?.matchDetails.length ?? 0,
						});
					}

					recordCsamScan({
						resourceType: context.resourceType,
						mediaType: params.mimeType,
						status: 'success',
					});
					recordCsamScanDuration({
						resourceType: context.resourceType,
						durationMs,
					});

					return {
						isMatch: result.isMatch,
						matchResult: result.matchResult,
						frames,
						hashes,
					};
				} catch (error) {
					const durationMs = Date.now() - startTime;
					this.options.logger.error({error, mimeType: params.mimeType}, 'Failed to scan base64 media');
					recordCsamScan({
						resourceType: context.resourceType,
						mediaType: params.mimeType,
						status: 'error',
					});
					recordCsamScanDuration({
						resourceType: context.resourceType,
						durationMs,
					});
					throw error;
				}
			},
		);
	}

	private async extractFramesFromS3(bucket: string, key: string, contentType: string): Promise<Array<FrameSample>> {
		if (isVideoType(contentType)) {
			const response = await this.mediaService.extractFrames({
				type: 's3',
				bucket,
				key,
			});

			return response.frames.map((frame) => ({
				timestamp: frame.timestamp,
				mimeType: frame.mime_type,
				base64: frame.base64,
			}));
		}

		const metadata = await this.mediaService.getMetadata({
			type: 's3',
			bucket,
			key,
			with_base64: true,
			isNSFWAllowed: true,
		});

		if (!metadata) {
			throw new Error('Media proxy returned no metadata for image scan');
		}

		if (!metadata.base64) {
			throw new Error('Media proxy returned metadata without base64 for image scan');
		}

		return [
			{
				timestamp: 0,
				mimeType: metadata.content_type,
				base64: metadata.base64,
			},
		];
	}
}
