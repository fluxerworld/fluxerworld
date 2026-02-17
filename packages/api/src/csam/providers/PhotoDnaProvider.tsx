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

import type {ICsamScanQueueService} from '@fluxer/api/src/csam/CsamScanQueueService';
import type {FrameSample} from '@fluxer/api/src/csam/CsamTypes';
import type {IPhotoDnaHashClient} from '@fluxer/api/src/csam/PhotoDnaHashClient';
import type {
	CsamMatchResult,
	CsamScanContext,
	CsamScanProvider,
	CsamScanResult,
	ICsamScanProvider,
	ScanBase64Params,
	ScanMediaParams,
} from '@fluxer/api/src/csam/providers/ICsamScanProvider';
import type {ILogger} from '@fluxer/api/src/ILogger';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import {withBusinessSpan} from '@fluxer/api/src/telemetry/BusinessSpans';
import {recordCsamMatch, recordCsamScan, recordCsamScanDuration} from '@fluxer/api/src/telemetry/CsamTelemetry';

export interface PhotoDnaProviderOptions {
	logger: ILogger;
}

function isScannableMediaType(contentType: string | null): boolean {
	if (!contentType) {
		return false;
	}
	const normalized = contentType.toLowerCase().split(';')[0].trim();
	return normalized.startsWith('image/') || normalized.startsWith('video/');
}

function isVideoType(contentType: string): boolean {
	const normalized = contentType.toLowerCase().split(';')[0].trim();
	return normalized.startsWith('video/');
}

function createDefaultContext(): CsamScanContext {
	return {
		resourceType: 'other',
		userId: null,
		guildId: null,
		channelId: null,
		messageId: null,
	};
}

export class PhotoDnaProvider implements ICsamScanProvider {
	readonly providerName: CsamScanProvider = 'photo_dna';

	constructor(
		private readonly hashClient: IPhotoDnaHashClient,
		private readonly mediaService: IMediaService,
		private readonly queueService: ICsamScanQueueService,
		private readonly options: PhotoDnaProviderOptions,
	) {}

	async scanMedia(params: ScanMediaParams): Promise<CsamScanResult> {
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
			{resource_type: context.resourceType, provider: this.providerName},
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

					const result = await this.queueService.submitScan({
						hashes,
						context: {
							resourceType: context.resourceType,
							userId: context.userId,
							guildId: context.guildId,
							channelId: context.channelId,
							messageId: context.messageId,
						},
					});

					const durationMs = Date.now() - startTime;

					let matchResult: CsamMatchResult | undefined;
					if (result.matchResult) {
						matchResult = {
							isMatch: result.matchResult.isMatch,
							trackingId: result.matchResult.trackingId,
							matchDetails: result.matchResult.matchDetails.map((detail) => ({
								source: detail.source,
								violations: detail.violations,
								matchDistance: detail.matchDistance,
								matchId: detail.matchId,
							})),
							timestamp: result.matchResult.timestamp,
							provider: this.providerName,
						};
					}

					if (result.isMatch) {
						const matchCount = matchResult?.matchDetails.length ?? 0;
						this.options.logger.warn({trackingId: matchResult?.trackingId, matchCount}, 'CSAM match detected');
						recordCsamMatch({
							resourceType: context.resourceType,
							source: 'synchronous',
							matchCount,
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
						matchResult,
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

	async scanBase64(params: ScanBase64Params): Promise<CsamScanResult> {
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
			{resource_type: context.resourceType, provider: this.providerName},
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

					const result = await this.queueService.submitScan({
						hashes,
						context: {
							resourceType: context.resourceType,
							userId: context.userId,
							guildId: context.guildId,
							channelId: context.channelId,
							messageId: context.messageId,
						},
					});

					const durationMs = Date.now() - startTime;

					let matchResult: CsamMatchResult | undefined;
					if (result.matchResult) {
						matchResult = {
							isMatch: result.matchResult.isMatch,
							trackingId: result.matchResult.trackingId,
							matchDetails: result.matchResult.matchDetails.map((detail) => ({
								source: detail.source,
								violations: detail.violations,
								matchDistance: detail.matchDistance,
								matchId: detail.matchId,
							})),
							timestamp: result.matchResult.timestamp,
							provider: this.providerName,
						};
					}

					if (result.isMatch) {
						const matchCount = matchResult?.matchDetails.length ?? 0;
						this.options.logger.warn({trackingId: matchResult?.trackingId, matchCount}, 'CSAM match detected');
						recordCsamMatch({
							resourceType: context.resourceType,
							source: 'synchronous',
							matchCount,
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
						matchResult,
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

		if (!metadata?.base64) {
			return [];
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
