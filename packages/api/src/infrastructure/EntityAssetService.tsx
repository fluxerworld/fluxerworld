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
import {Config} from '@fluxer/api/src/Config';
import type {CsamResourceType} from '@fluxer/api/src/csam/CsamTypes';
import type {ICsamReportSnapshotService} from '@fluxer/api/src/csam/ICsamReportSnapshotService';
import type {ISynchronousCsamScanner} from '@fluxer/api/src/csam/ISynchronousCsamScanner';
import type {IAssetDeletionQueue} from '@fluxer/api/src/infrastructure/IAssetDeletionQueue';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import {Logger} from '@fluxer/api/src/Logger';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import {AVATAR_EXTENSIONS, AVATAR_MAX_SIZE} from '@fluxer/constants/src/LimitConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {ContentBlockedError} from '@fluxer/errors/src/domains/content/ContentBlockedError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {resolveLimit} from '@fluxer/limits/src/LimitResolver';
import {ms} from 'itty-time';

export type AssetType = 'avatar' | 'banner' | 'icon' | 'splash' | 'embed_splash';
export type EntityType = 'user' | 'guild' | 'guild_member';

const ASSET_TYPE_TO_PREFIX: Record<AssetType, string> = {
	avatar: 'avatars',
	banner: 'banners',
	icon: 'icons',
	splash: 'splashes',
	embed_splash: 'embed-splashes',
};

export interface PreparedAssetUpload {
	newHash: string | null;
	previousHash: string | null;
	isAnimated: boolean;
	newS3Key: string | null;
	previousS3Key: string | null;
	newCdnUrl: string | null;
	previousCdnUrl: string | null;
	height?: number;
	width?: number;
	imageBuffer?: Uint8Array;
	format?: string | null;
	contentType?: string | null;
	_uploaded: boolean;
}

export interface PrepareAssetUploadOptions {
	assetType: AssetType;
	entityType: EntityType;
	entityId: bigint;
	guildId?: bigint;
	previousHash: string | null;
	base64Image: string | null;
	errorPath: string;
}

export interface CommitAssetChangeOptions {
	prepared: PreparedAssetUpload;
	deferDeletion?: boolean;
}

type LimitConfigSnapshotProvider = Pick<LimitConfigService, 'getConfigSnapshot'>;

export class EntityAssetService {
	private activeTimeouts: Set<NodeJS.Timeout> = new Set();
	private readonly csamScanner?: ISynchronousCsamScanner;
	private readonly csamReportService?: ICsamReportSnapshotService;

	constructor(
		private readonly storageService: IStorageService,
		private readonly mediaService: IMediaService,
		private readonly assetDeletionQueue: IAssetDeletionQueue,
		private readonly limitConfigService: LimitConfigSnapshotProvider,
		csamScanner?: ISynchronousCsamScanner,
		csamReportService?: ICsamReportSnapshotService,
	) {
		this.csamScanner = csamScanner;
		this.csamReportService = csamReportService;
	}

	async prepareAssetUpload(options: PrepareAssetUploadOptions): Promise<PreparedAssetUpload> {
		const {assetType, entityType, entityId, guildId, previousHash, base64Image, errorPath} = options;

		const s3KeyBase = this.buildS3KeyBase(assetType, entityType, entityId, guildId);
		const cdnUrlBase = this.buildCdnUrlBase(assetType, entityType, entityId, guildId);

		const previousS3Key = previousHash ? `${s3KeyBase}/${this.stripAnimationPrefix(previousHash)}` : null;
		const previousCdnUrl = previousHash ? `${cdnUrlBase}/${previousHash}` : null;

		if (!base64Image) {
			return {
				newHash: null,
				previousHash,
				isAnimated: false,
				newS3Key: null,
				previousS3Key,
				newCdnUrl: null,
				previousCdnUrl,
				_uploaded: false,
				format: null,
				contentType: null,
			};
		}

		const {imageBuffer, format, height, width, contentType, animated} = await this.validateAndProcessImage(
			base64Image,
			errorPath,
		);

		const imageHash = crypto.createHash('md5').update(Buffer.from(imageBuffer)).digest('hex');
		const imageHashShort = imageHash.slice(0, 8);
		const newHash = animated ? `a_${imageHashShort}` : imageHashShort;
		const isAnimated = animated;

		const newS3Key = `${s3KeyBase}/${imageHashShort}`;
		const newCdnUrl = `${cdnUrlBase}/${newHash}`;

		if (newHash === previousHash) {
			return {
				newHash,
				previousHash,
				isAnimated,
				newS3Key,
				previousS3Key,
				newCdnUrl,
				previousCdnUrl,
				height,
				width,
				_uploaded: false,
				imageBuffer,
				format,
				contentType,
			};
		}

		if (this.csamScanner && this.csamReportService && contentType) {
			const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
			const scanResult = await this.csamScanner.scanBase64({base64: base64Data, mimeType: contentType});

			if (scanResult.isMatch && scanResult.matchResult) {
				const resourceType = this.mapAssetTypeToResourceType(assetType);
				const userId = this.resolveUserId({entityType, entityId, guildId});
				const resolvedGuildId = this.resolveGuildId({entityType, entityId, guildId});

				await this.csamReportService.createSnapshot({
					scanResult: scanResult.matchResult,
					resourceType,
					userId: userId?.toString() ?? null,
					guildId: resolvedGuildId?.toString() ?? null,
					channelId: null,
					messageId: null,
					mediaData: Buffer.from(imageBuffer),
					filename: `${assetType}-${newHash}`,
					contentType,
				});

				Logger.warn(
					{assetType, entityType, entityId: entityId.toString(), trackingId: scanResult.matchResult.trackingId},
					'CSAM detected in entity asset upload - content blocked',
				);

				throw new ContentBlockedError();
			}
		}

		await this.uploadToS3(assetType, entityType, newS3Key, imageBuffer);

		const exists = await this.verifyAssetExistsWithRetry(assetType, entityType, newS3Key);
		if (!exists) {
			Logger.error(
				{newS3Key, assetType, entityType},
				'Asset upload verification failed - object does not exist after upload with retries',
			);
			throw InputValidationError.fromCode(errorPath, ValidationErrorCodes.FAILED_TO_UPLOAD_IMAGE);
		}

		const prepared: PreparedAssetUpload = {
			newHash,
			previousHash,
			isAnimated,
			newS3Key,
			previousS3Key,
			newCdnUrl,
			previousCdnUrl,
			height,
			width,
			_uploaded: true,
			imageBuffer,
			format,
			contentType,
		};

		return prepared;
	}

	async commitAssetChange(options: CommitAssetChangeOptions): Promise<void> {
		const {prepared, deferDeletion = true} = options;

		if (!prepared.previousHash || !prepared.previousS3Key) {
			return;
		}

		if (prepared.newHash === prepared.previousHash) {
			return;
		}

		if (deferDeletion) {
			await this.assetDeletionQueue.queueDeletion({
				s3Key: prepared.previousS3Key,
				cdnUrl: prepared.previousCdnUrl,
				reason: 'asset_replaced',
			});

			Logger.debug(
				{previousS3Key: prepared.previousS3Key, previousCdnUrl: prepared.previousCdnUrl},
				'Queued old asset for deferred deletion',
			);
		} else {
			await this.deleteAssetImmediately(prepared.previousS3Key, prepared.previousCdnUrl);
		}
	}

	async rollbackAssetUpload(prepared: PreparedAssetUpload): Promise<void> {
		if (!prepared._uploaded || !prepared.newS3Key) {
			return;
		}

		try {
			await this.storageService.deleteObject(Config.s3.buckets.cdn, prepared.newS3Key);
			Logger.info({newS3Key: prepared.newS3Key}, 'Rolled back asset upload after DB failure');
		} catch (error) {
			Logger.error({error, newS3Key: prepared.newS3Key}, 'Failed to rollback asset upload - asset may be orphaned');
		}
	}

	private mapAssetTypeToResourceType(assetType: AssetType): CsamResourceType {
		switch (assetType) {
			case 'avatar':
			case 'icon':
				return 'avatar';
			case 'banner':
			case 'splash':
			case 'embed_splash':
				return 'banner';
			default:
				return 'other';
		}
	}

	private resolveUserId(params: {entityType: EntityType; entityId: bigint; guildId?: bigint}): bigint | null {
		if (params.entityType === 'user') {
			return params.entityId;
		}
		if (params.entityType === 'guild_member') {
			return params.entityId;
		}
		return null;
	}

	private resolveGuildId(params: {entityType: EntityType; entityId: bigint; guildId?: bigint}): bigint | null {
		if (params.entityType === 'guild') {
			return params.entityId;
		}
		if (params.entityType === 'guild_member' && params.guildId) {
			return params.guildId;
		}
		return null;
	}

	async verifyAssetExists(assetType: AssetType, entityType: EntityType, s3Key: string): Promise<boolean> {
		try {
			const metadata = await this.storageService.getObjectMetadata(Config.s3.buckets.cdn, s3Key);
			return metadata !== null;
		} catch (error) {
			Logger.error({error, s3Key, assetType, entityType}, 'Error checking asset existence');
			return false;
		}
	}

	private resolveAvatarSizeLimit(): number {
		const ctx = createLimitMatchContext({user: null});
		const resolved = resolveLimit(this.limitConfigService.getConfigSnapshot(), ctx, 'avatar_max_size');
		if (!Number.isFinite(resolved) || resolved < 0) {
			return AVATAR_MAX_SIZE;
		}
		return Math.floor(resolved);
	}

	async verifyAssetExistsWithRetry(
		assetType: AssetType,
		entityType: EntityType,
		s3Key: string,
		maxRetries: number = 3,
		delayMs: number = ms('500 milliseconds'),
	): Promise<boolean> {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				const metadata = await this.storageService.getObjectMetadata(Config.s3.buckets.cdn, s3Key);
				if (metadata !== null) {
					if (attempt > 1) {
						Logger.info({s3Key, assetType, entityType, attempt}, 'Asset verification succeeded after retry');
					}
					return true;
				}
			} catch (error) {
				Logger.warn({error, s3Key, assetType, entityType, attempt}, 'Asset verification attempt failed');
			}

			if (attempt < maxRetries) {
				await new Promise<void>((resolve) => {
					const timeout = setTimeout(() => {
						this.activeTimeouts.delete(timeout);
						resolve();
					}, delayMs * attempt);
					this.activeTimeouts.add(timeout);
					timeout.unref?.();
				});
			}
		}

		Logger.error({s3Key, assetType, entityType, maxRetries}, 'Asset verification failed after all retries');
		return false;
	}

	public cleanup(): void {
		for (const timeout of this.activeTimeouts) {
			clearTimeout(timeout);
		}
		this.activeTimeouts.clear();
	}

	public getActiveTimeoutCount(): number {
		return this.activeTimeouts.size;
	}

	getS3KeyForHash(
		assetType: AssetType,
		entityType: EntityType,
		entityId: bigint,
		hash: string,
		guildId?: bigint,
	): string {
		const s3KeyBase = this.buildS3KeyBase(assetType, entityType, entityId, guildId);
		return `${s3KeyBase}/${this.stripAnimationPrefix(hash)}`;
	}

	getCdnUrlForHash(
		assetType: AssetType,
		entityType: EntityType,
		entityId: bigint,
		hash: string,
		guildId?: bigint,
	): string {
		const cdnUrlBase = this.buildCdnUrlBase(assetType, entityType, entityId, guildId);
		return `${cdnUrlBase}/${hash}`;
	}

	async queueAssetDeletion(
		assetType: AssetType,
		entityType: EntityType,
		entityId: bigint,
		hash: string,
		guildId?: bigint,
		reason: string = 'manual_clear',
	): Promise<void> {
		const s3Key = this.getS3KeyForHash(assetType, entityType, entityId, hash, guildId);
		const cdnUrl = this.getCdnUrlForHash(assetType, entityType, entityId, hash, guildId);

		await this.assetDeletionQueue.queueDeletion({
			s3Key,
			cdnUrl,
			reason,
		});
	}

	private stripAnimationPrefix(hash: string): string {
		return hash.startsWith('a_') ? hash.substring(2) : hash;
	}

	private buildS3KeyBase(assetType: AssetType, entityType: EntityType, entityId: bigint, guildId?: bigint): string {
		const prefix = ASSET_TYPE_TO_PREFIX[assetType];

		if (entityType === 'guild_member') {
			if (!guildId) {
				throw new Error('guildId is required for guild_member assets');
			}
			return `guilds/${guildId}/users/${entityId}/${prefix}`;
		}

		return `${prefix}/${entityId}`;
	}

	private buildCdnUrlBase(assetType: AssetType, entityType: EntityType, entityId: bigint, guildId?: bigint): string {
		const prefix = ASSET_TYPE_TO_PREFIX[assetType];

		if (entityType === 'guild_member') {
			if (!guildId) {
				throw new Error('guildId is required for guild_member assets');
			}
			return `${Config.endpoints.media}/guilds/${guildId}/users/${entityId}/${prefix}`;
		}

		return `${Config.endpoints.media}/${prefix}/${entityId}`;
	}

	private async validateAndProcessImage(
		base64Image: string,
		errorPath: string,
	): Promise<{
		imageBuffer: Uint8Array;
		format: string;
		height?: number;
		width?: number;
		contentType: string | null;
		animated: boolean;
	}> {
		const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

		let imageBuffer: Uint8Array;
		try {
			imageBuffer = new Uint8Array(Buffer.from(base64Data, 'base64'));
		} catch {
			throw InputValidationError.fromCode(errorPath, ValidationErrorCodes.INVALID_IMAGE_DATA);
		}

		const maxAvatarSize = this.resolveAvatarSizeLimit();
		if (imageBuffer.length > maxAvatarSize) {
			throw InputValidationError.fromCode(errorPath, ValidationErrorCodes.IMAGE_SIZE_EXCEEDS_LIMIT, {
				maxSize: maxAvatarSize,
			});
		}

		const metadata = await this.mediaService.getMetadata({
			type: 'base64',
			base64: base64Data,
			isNSFWAllowed: false,
		});

		if (metadata == null || !AVATAR_EXTENSIONS.has(metadata.format)) {
			throw InputValidationError.fromCode(errorPath, ValidationErrorCodes.INVALID_IMAGE_FORMAT, {
				supportedExtensions: [...AVATAR_EXTENSIONS].join(', '),
			});
		}

		const isAnimatedImage = metadata.animated ?? false;

		return {
			imageBuffer,
			format: metadata.format,
			height: metadata.height,
			width: metadata.width,
			contentType: metadata.content_type ?? null,
			animated: isAnimatedImage,
		};
	}

	private async uploadToS3(
		assetType: AssetType,
		entityType: EntityType,
		s3Key: string,
		imageBuffer: Uint8Array,
	): Promise<void> {
		try {
			Logger.info({s3Key, assetType, entityType, size: imageBuffer.length}, 'Starting asset upload to S3');
			await this.storageService.uploadObject({
				bucket: Config.s3.buckets.cdn,
				key: s3Key,
				body: imageBuffer,
			});
			Logger.info({s3Key, assetType, entityType}, 'Asset upload to S3 completed successfully');
		} catch (error) {
			Logger.error({error, s3Key, assetType, entityType}, 'Asset upload to S3 failed');
			throw new Error(`Failed to upload asset to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	private async deleteAssetImmediately(s3Key: string, cdnUrl: string | null): Promise<void> {
		try {
			await this.storageService.deleteObject(Config.s3.buckets.cdn, s3Key);
			Logger.debug({s3Key}, 'Deleted asset from S3');
		} catch (error) {
			Logger.error({error, s3Key}, 'Failed to delete asset from S3');
		}

		if (cdnUrl) {
			await this.assetDeletionQueue.queueCdnPurge(cdnUrl);
		}
	}
}
