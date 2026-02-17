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

import {S3ServiceException} from '@aws-sdk/client-s3';
import type {CsamResourceType} from '@fluxer/api/src/csam/CsamTypes';
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
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import {withBusinessSpan} from '@fluxer/api/src/telemetry/BusinessSpans';
import {
	recordArachnidApiCall,
	recordArachnidApiDuration,
	recordCsamMatch,
	recordCsamScan,
	recordCsamScanDuration,
} from '@fluxer/api/src/telemetry/CsamTelemetry';

export interface ArachnidShieldConfig {
	endpoint: string;
	username: string;
	password: string;
	timeoutMs: number;
	maxRetries: number;
	retryBackoffMs: number;
}

export interface ArachnidShieldProviderOptions {
	config: ArachnidShieldConfig;
	logger: ILogger;
	storageService: IStorageService;
}

type ArachnidClassification = 'csam' | 'harmful-abusive-material' | 'no-known-match' | 'test';

interface ArachnidNearMatchDetail {
	classification: ArachnidClassification;
	sha1_base32: string;
	sha256_hex: string;
	timestamp: number;
}

interface ArachnidShieldResponse {
	classification: ArachnidClassification;
	match_type: 'exact' | 'near' | null;
	near_match_details?: Array<ArachnidNearMatchDetail>;
	sha1_base32: string;
	sha256_hex: string;
	size_bytes: number;
}

class NonRetryableApiError extends Error {
	readonly statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.name = 'NonRetryableApiError';
		this.statusCode = statusCode;
	}
}

function normaliseMediaType(contentType: string): string {
	return contentType.toLowerCase().split(';')[0].trim();
}

function isScannableMediaType(contentType: string | null): boolean {
	if (!contentType) {
		return false;
	}
	const t = normaliseMediaType(contentType);
	return t.startsWith('image/') || t.startsWith('video/');
}

function defaultContext(): CsamScanContext {
	return {
		resourceType: 'other',
		userId: null,
		guildId: null,
		channelId: null,
		messageId: null,
	};
}

function parseRateLimitHeader(header: string | null): {remaining: number; resetSeconds: number} | null {
	if (!header) {
		return null;
	}
	const match = header.match(/r=(\d+);t=(\d+)/);
	if (!match) {
		return null;
	}
	return {
		remaining: Number.parseInt(match[1], 10),
		resetSeconds: Number.parseInt(match[2], 10),
	};
}

function isRetryableStatus(status: number): boolean {
	return status === 429 || status === 503 || status >= 500;
}

function matchesClassification(classification: ArachnidClassification): boolean {
	return classification === 'csam' || classification === 'harmful-abusive-material';
}

export class ArachnidShieldProvider implements ICsamScanProvider {
	readonly providerName: CsamScanProvider = 'arachnid_shield';

	private readonly config: ArachnidShieldConfig;
	private readonly logger: ILogger;
	private readonly storageService: IStorageService;
	private readonly authHeader: string;

	constructor(options: ArachnidShieldProviderOptions) {
		this.config = options.config;
		this.logger = options.logger;
		this.storageService = options.storageService;
		this.authHeader = `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')}`;
	}

	async scanMedia(params: ScanMediaParams): Promise<CsamScanResult> {
		const context = params.context ?? defaultContext();
		const mediaType = params.contentType ?? 'unknown';

		if (!isScannableMediaType(params.contentType)) {
			this.logger.debug(
				{bucket: params.bucket, key: params.key, contentType: params.contentType},
				'Skipping non-scannable media type',
			);
			recordCsamScan({resourceType: context.resourceType, mediaType, status: 'skipped'});
			return {isMatch: false};
		}

		return this.withSpan('fluxer.csam.scan_media', 'fluxer.csam.scans.media', context, async () => {
			const start = Date.now();

			try {
				let data: Uint8Array;
				try {
					data = await this.storageService.readObject(params.bucket, params.key);
				} catch (storageError) {
					if (
						storageError instanceof S3ServiceException &&
						(storageError.name === 'NoSuchKey' || storageError.name === 'NotFound')
					) {
						this.logger.debug({bucket: params.bucket, key: params.key}, 'File not found in storage');
						this.recordScan(context.resourceType, mediaType, 'error', Date.now() - start);
						return {isMatch: false};
					}
					throw storageError;
				}

				const response = await this.submitToArachnid(data, normaliseMediaType(params.contentType!));
				const result = this.translateResponse(response);

				if (result.isMatch) {
					const matchCount = result.matchResult?.matchDetails.length ?? 0;
					this.logger.warn({trackingId: result.matchResult?.trackingId, matchCount}, 'CSAM match detected');
					recordCsamMatch({
						resourceType: context.resourceType,
						source: 'synchronous',
						matchCount,
					});
				}

				this.recordScan(context.resourceType, mediaType, 'success', Date.now() - start);

				return {
					...result,
					hashes: [response.sha256_hex],
				};
			} catch (error) {
				this.logger.error({error, bucket: params.bucket, key: params.key}, 'Failed to scan media');
				this.recordScan(context.resourceType, mediaType, 'error', Date.now() - start);
				throw error;
			}
		});
	}

	async scanBase64(params: ScanBase64Params): Promise<CsamScanResult> {
		const context = params.context ?? defaultContext();

		if (!isScannableMediaType(params.mimeType)) {
			this.logger.debug({mimeType: params.mimeType}, 'Skipping non-scannable media type');
			recordCsamScan({resourceType: context.resourceType, mediaType: params.mimeType, status: 'skipped'});
			return {isMatch: false};
		}

		return this.withSpan('fluxer.csam.scan_base64', 'fluxer.csam.scans.base64', context, async () => {
			const start = Date.now();

			try {
				const data = new Uint8Array(Buffer.from(params.base64, 'base64'));
				const response = await this.submitToArachnid(data, normaliseMediaType(params.mimeType));
				const result = this.translateResponse(response);

				if (result.isMatch) {
					const matchCount = result.matchResult?.matchDetails.length ?? 0;
					this.logger.warn({trackingId: result.matchResult?.trackingId, matchCount}, 'CSAM match detected');
					recordCsamMatch({
						resourceType: context.resourceType,
						source: 'synchronous',
						matchCount,
					});
				}

				this.recordScan(context.resourceType, params.mimeType, 'success', Date.now() - start);

				return {
					...result,
					hashes: [response.sha256_hex],
				};
			} catch (error) {
				this.logger.error({error, mimeType: params.mimeType}, 'Failed to scan base64 media');
				this.recordScan(context.resourceType, params.mimeType, 'error', Date.now() - start);
				throw error;
			}
		});
	}

	private async withSpan<T>(
		spanName: string,
		metricName: string,
		context: CsamScanContext,
		fn: () => Promise<T>,
	): Promise<T> {
		return withBusinessSpan(
			spanName,
			metricName,
			{resource_type: context.resourceType, provider: this.providerName},
			fn,
		);
	}

	private recordScan(
		resourceType: CsamResourceType,
		mediaType: string,
		status: 'success' | 'error' | 'skipped',
		durationMs: number,
	): void {
		recordCsamScan({resourceType, mediaType, status});
		recordCsamScanDuration({resourceType, durationMs});
	}

	private async submitToArachnid(fileData: Uint8Array, contentType: string): Promise<ArachnidShieldResponse> {
		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
			const apiStart = Date.now();

			try {
				const response = await this.fetchWithTimeout(fileData, contentType);
				recordArachnidApiDuration({durationMs: Date.now() - apiStart});

				if (response.ok) {
					recordArachnidApiCall({status: 'success'});
					return (await response.json()) as ArachnidShieldResponse;
				}

				recordArachnidApiCall({status: 'error'});

				if (!isRetryableStatus(response.status)) {
					const text = await response.text().catch(() => '<no body>');
					throw new NonRetryableApiError(`Arachnid Shield API returned ${response.status}: ${text}`, response.status);
				}

				const rateLimit = parseRateLimitHeader(response.headers.get('ratelimit'));
				const waitMs = this.computeWaitMs(attempt, rateLimit);

				if (attempt < this.config.maxRetries) {
					this.logger.warn(
						{attempt, status: response.status, waitMs, rateLimit},
						'Arachnid Shield API request failed, retrying',
					);
					await this.sleep(waitMs);
					continue;
				}

				throw new Error(`Arachnid Shield API returned ${response.status} after ${attempt + 1} attempts`);
			} catch (error) {
				if (error instanceof NonRetryableApiError) {
					throw error;
				}

				if (error instanceof Error && error.name === 'AbortError') {
					recordArachnidApiCall({status: 'timeout'});
					lastError = new Error(`Arachnid Shield API request timed out after ${this.config.timeoutMs}ms`);
				} else {
					lastError = error instanceof Error ? error : new Error(String(error));
				}

				if (attempt < this.config.maxRetries) {
					const waitMs = this.computeWaitMs(attempt, null);
					this.logger.warn({attempt, error: lastError.message, waitMs}, 'Arachnid Shield API request failed, retrying');
					await this.sleep(waitMs);
				}
			}
		}

		throw lastError ?? new Error('Arachnid Shield API request failed');
	}

	private computeWaitMs(attempt: number, rateLimit: {remaining: number; resetSeconds: number} | null): number {
		if (rateLimit && rateLimit.remaining === 0) {
			return rateLimit.resetSeconds * 1000;
		}
		return Math.min(this.config.retryBackoffMs * 2 ** attempt, 60000);
	}

	private async fetchWithTimeout(fileData: Uint8Array, contentType: string): Promise<Response> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

		try {
			return await fetch(this.config.endpoint, {
				method: 'POST',
				headers: {
					Authorization: this.authHeader,
					'Content-Type': contentType,
				},
				body: fileData,
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timeout);
		}
	}

	private translateResponse(response: ArachnidShieldResponse): CsamScanResult {
		if (!matchesClassification(response.classification)) {
			return {isMatch: false};
		}

		const matchDistance = response.match_type === 'near' ? 1 : 0;

		const matchDetails = response.near_match_details?.map((detail) => ({
			source: 'arachnid',
			violations: [detail.classification],
			matchDistance,
			matchId: detail.sha256_hex,
		})) ?? [
			{
				source: 'arachnid',
				violations: [response.classification],
				matchDistance,
				matchId: response.sha256_hex,
			},
		];

		const matchResult: CsamMatchResult = {
			isMatch: true,
			trackingId: response.sha256_hex,
			matchDetails,
			timestamp: new Date().toISOString(),
			provider: this.providerName,
		};

		return {isMatch: true, matchResult};
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
