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
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import {Logger} from '@fluxer/api/src/Logger';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';
import {
	AVATAR_EXTENSIONS,
	AVATAR_MAX_SIZE,
	EMOJI_EXTENSIONS,
	EMOJI_MAX_SIZE,
	STICKER_EXTENSIONS,
	STICKER_MAX_SIZE,
} from '@fluxer/constants/src/LimitConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {ContentBlockedError} from '@fluxer/errors/src/domains/content/ContentBlockedError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {resolveLimit} from '@fluxer/limits/src/LimitResolver';

export interface CsamUploadContext {
	userId?: string;
	guildId?: string;
	channelId?: string;
	messageId?: string;
}

type LimitConfigSnapshotProvider = Pick<LimitConfigService, 'getConfigSnapshot'>;

export class AvatarService {
	private readonly synchronousCsamScanner?: ISynchronousCsamScanner;
	private readonly csamReportSnapshotService?: ICsamReportSnapshotService;

	constructor(
		private storageService: IStorageService,
		private mediaService: IMediaService,
		private limitConfigService: LimitConfigSnapshotProvider,
		synchronousCsamScanner?: ISynchronousCsamScanner,
		csamReportSnapshotService?: ICsamReportSnapshotService,
	) {
		this.synchronousCsamScanner = synchronousCsamScanner;
		this.csamReportSnapshotService = csamReportSnapshotService;
	}

	private resolveSizeLimit(key: LimitKey, fallback: number): number {
		const ctx = createLimitMatchContext({user: null});
		const resolved = resolveLimit(this.limitConfigService.getConfigSnapshot(), ctx, key);
		if (!Number.isFinite(resolved) || resolved < 0) {
			return fallback;
		}
		return Math.floor(resolved);
	}

	async uploadAvatar(params: {
		prefix: 'avatars' | 'icons' | 'banners' | 'splashes';
		entityId?: bigint;
		keyPath?: string;
		errorPath: string;
		previousKey?: string | null;
		base64Image?: string | null;
		csamContext?: CsamUploadContext;
	}): Promise<string | null> {
		const {prefix, entityId, keyPath, errorPath, previousKey, base64Image, csamContext} = params;

		const fullKeyPath = keyPath ?? (entityId ? entityId.toString() : '');

		if (!base64Image) {
			if (previousKey) {
				await this.storageService.deleteAvatar({
					prefix,
					key: `${fullKeyPath}/${this.stripAnimationPrefix(previousKey)}`,
				});
			}
			return null;
		}

		const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

		let imageBuffer: Uint8Array;
		try {
			imageBuffer = new Uint8Array(Buffer.from(base64Data, 'base64'));
		} catch {
			throw InputValidationError.fromCode(errorPath, ValidationErrorCodes.INVALID_IMAGE_DATA);
		}

		const maxAvatarSize = this.resolveSizeLimit('avatar_max_size', AVATAR_MAX_SIZE);
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
				supportedExtensions: this.formatSupportedExtensions(AVATAR_EXTENSIONS),
			});
		}

		const imageHash = crypto.createHash('md5').update(Buffer.from(imageBuffer)).digest('hex');
		const imageHashShort = imageHash.slice(0, 8);
		const isAnimatedAvatar = metadata.animated ?? false;
		const storedHash = isAnimatedAvatar ? `a_${imageHashShort}` : imageHashShort;
		const label = fullKeyPath ? `${prefix}-${fullKeyPath}-${storedHash}` : `${prefix}-${storedHash}`;

		await this.scanAndBlockCsam({
			base64Data,
			contentType: metadata.content_type,
			imageBuffer,
			resourceType: this.getResourceTypeForPrefix(prefix),
			filename: label,
			csamContext,
		});

		await this.storageService.uploadAvatar({prefix, key: `${fullKeyPath}/${imageHashShort}`, body: imageBuffer});

		if (previousKey) {
			await this.storageService.deleteAvatar({
				prefix,
				key: `${fullKeyPath}/${this.stripAnimationPrefix(previousKey)}`,
			});
		}

		return storedHash;
	}

	async uploadAvatarToPath(params: {
		bucket: string;
		keyPath: string;
		errorPath: string;
		previousKey?: string | null;
		base64Image?: string | null;
		csamContext?: CsamUploadContext;
	}): Promise<string | null> {
		const {bucket, keyPath, errorPath, previousKey, base64Image, csamContext} = params;

		const stripAnimationPrefix = (key: string) => (key.startsWith('a_') ? key.substring(2) : key);

		if (!base64Image) {
			if (previousKey) {
				await this.storageService.deleteObject(bucket, `${keyPath}/${stripAnimationPrefix(previousKey)}`);
			}
			return null;
		}

		const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

		let imageBuffer: Uint8Array;
		try {
			imageBuffer = new Uint8Array(Buffer.from(base64Data, 'base64'));
		} catch {
			throw InputValidationError.fromCode(errorPath, ValidationErrorCodes.INVALID_IMAGE_DATA);
		}

		const maxAvatarSize = this.resolveSizeLimit('avatar_max_size', AVATAR_MAX_SIZE);
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
				supportedExtensions: this.formatSupportedExtensions(AVATAR_EXTENSIONS),
			});
		}

		const imageHash = crypto.createHash('md5').update(Buffer.from(imageBuffer)).digest('hex');
		const imageHashShort = imageHash.slice(0, 8);
		const isAnimatedAvatar = metadata.animated ?? false;
		const storedHash = isAnimatedAvatar ? `a_${imageHashShort}` : imageHashShort;
		const label = `${keyPath}-${storedHash}`;

		await this.scanAndBlockCsam({
			base64Data,
			contentType: metadata.content_type,
			imageBuffer,
			resourceType: 'other',
			filename: label,
			csamContext,
		});

		await this.storageService.uploadObject({
			bucket,
			key: `${keyPath}/${imageHashShort}`,
			body: imageBuffer,
		});

		if (previousKey) {
			await this.storageService.deleteObject(bucket, `${keyPath}/${stripAnimationPrefix(previousKey)}`);
		}

		return storedHash;
	}

	async processEmoji(params: {errorPath: string; base64Image: string}): Promise<{
		imageBuffer: Uint8Array;
		animated: boolean;
		format: string;
		contentType: string;
	}> {
		const {errorPath, base64Image} = params;

		const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

		let imageBuffer: Uint8Array;
		try {
			imageBuffer = new Uint8Array(Buffer.from(base64Data, 'base64'));
		} catch {
			throw InputValidationError.fromCode(errorPath, ValidationErrorCodes.INVALID_IMAGE_DATA);
		}

		const maxEmojiSize = this.resolveSizeLimit('emoji_max_size', EMOJI_MAX_SIZE);
		if (imageBuffer.length > maxEmojiSize) {
			throw InputValidationError.fromCode(errorPath, ValidationErrorCodes.IMAGE_SIZE_EXCEEDS_LIMIT, {
				maxSize: maxEmojiSize,
			});
		}

		const metadata = await this.mediaService.getMetadata({
			type: 'base64',
			base64: base64Data,
			isNSFWAllowed: false,
		});

		if (metadata == null || !EMOJI_EXTENSIONS.has(metadata.format)) {
			throw InputValidationError.fromCode(errorPath, ValidationErrorCodes.INVALID_IMAGE_FORMAT, {
				supportedExtensions: this.formatSupportedExtensions(EMOJI_EXTENSIONS),
			});
		}

		const animated = metadata.animated ?? false;

		return {imageBuffer, animated, format: metadata.format, contentType: metadata.content_type};
	}

	async uploadEmoji(params: {
		prefix: 'emojis';
		emojiId: bigint;
		imageBuffer: Uint8Array;
		contentType?: string | null;
		csamContext?: CsamUploadContext;
	}): Promise<void> {
		const {prefix, emojiId, imageBuffer, contentType, csamContext} = params;
		const base64Data = Buffer.from(imageBuffer).toString('base64');
		const label = `${prefix}-${emojiId}`;

		await this.scanAndBlockCsam({
			base64Data,
			contentType: contentType ?? 'image/png',
			imageBuffer,
			resourceType: 'emoji',
			filename: label,
			csamContext,
		});

		await this.storageService.uploadAvatar({prefix, key: emojiId.toString(), body: imageBuffer});
	}

	async processSticker(params: {errorPath: string; base64Image: string}): Promise<{
		imageBuffer: Uint8Array;
		animated: boolean;
		format: string;
		contentType: string;
	}> {
		const {errorPath, base64Image} = params;

		const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

		let imageBuffer: Uint8Array;
		try {
			imageBuffer = new Uint8Array(Buffer.from(base64Data, 'base64'));
		} catch {
			throw InputValidationError.fromCode(errorPath, ValidationErrorCodes.INVALID_IMAGE_DATA);
		}

		const maxStickerSize = this.resolveSizeLimit('sticker_max_size', STICKER_MAX_SIZE);
		if (imageBuffer.length > maxStickerSize) {
			throw InputValidationError.fromCode(errorPath, ValidationErrorCodes.IMAGE_SIZE_EXCEEDS_LIMIT, {
				maxSize: maxStickerSize,
			});
		}

		const metadata = await this.mediaService.getMetadata({
			type: 'base64',
			base64: base64Data,
			isNSFWAllowed: false,
		});

		if (metadata == null || !STICKER_EXTENSIONS.has(metadata.format)) {
			throw InputValidationError.fromCode(errorPath, ValidationErrorCodes.INVALID_IMAGE_FORMAT, {
				supportedExtensions: this.formatSupportedExtensions(STICKER_EXTENSIONS),
			});
		}

		const animated = metadata.animated ?? false;

		return {imageBuffer, animated, format: metadata.format, contentType: metadata.content_type};
	}

	async uploadSticker(params: {
		prefix: 'stickers';
		stickerId: bigint;
		imageBuffer: Uint8Array;
		contentType?: string | null;
		csamContext?: CsamUploadContext;
	}): Promise<void> {
		const {prefix, stickerId, imageBuffer, contentType, csamContext} = params;
		const base64Data = Buffer.from(imageBuffer).toString('base64');
		const label = `${prefix}-${stickerId}`;

		await this.scanAndBlockCsam({
			base64Data,
			contentType: contentType ?? 'image/png',
			imageBuffer,
			resourceType: 'sticker',
			filename: label,
			csamContext,
		});

		await this.storageService.uploadAvatar({prefix, key: stickerId.toString(), body: imageBuffer});
	}

	async checkStickerAnimated(stickerId: bigint): Promise<boolean | null> {
		try {
			const metadata = await this.mediaService.getMetadata({
				type: 's3',
				bucket: Config.s3.buckets.cdn,
				key: `stickers/${stickerId}`,
				isNSFWAllowed: false,
			});
			return metadata?.animated ?? null;
		} catch (_error) {
			Logger.warn({stickerId}, 'Failed to check sticker animation status');
			return null;
		}
	}

	private async scanAndBlockCsam(params: {
		base64Data: string;
		contentType: string;
		imageBuffer: Uint8Array;
		resourceType: CsamResourceType;
		filename: string;
		csamContext?: CsamUploadContext;
	}): Promise<void> {
		if (!this.synchronousCsamScanner) {
			return;
		}

		const scanResult = await this.synchronousCsamScanner.scanBase64({
			base64: params.base64Data,
			mimeType: params.contentType,
		});

		if (scanResult.isMatch && scanResult.matchResult && this.csamReportSnapshotService) {
			await this.csamReportSnapshotService.createSnapshot({
				scanResult: scanResult.matchResult,
				resourceType: params.resourceType,
				userId: params.csamContext?.userId ?? null,
				guildId: params.csamContext?.guildId ?? null,
				channelId: params.csamContext?.channelId ?? null,
				messageId: params.csamContext?.messageId ?? null,
				mediaData: Buffer.from(params.imageBuffer),
				filename: params.filename,
				contentType: params.contentType,
			});

			throw new ContentBlockedError();
		}
	}

	private getResourceTypeForPrefix(prefix: string): CsamResourceType {
		switch (prefix) {
			case 'avatars':
			case 'icons':
				return 'avatar';
			case 'banners':
			case 'splashes':
			case 'embed-splashes':
				return 'banner';
			case 'emojis':
				return 'emoji';
			case 'stickers':
				return 'sticker';
			default:
				return 'other';
		}
	}

	private stripAnimationPrefix(hash: string): string {
		return hash.startsWith('a_') ? hash.substring(2) : hash;
	}

	private formatSupportedExtensions(extSet: ReadonlySet<string>): string {
		return [...extSet].join(', ');
	}
}
