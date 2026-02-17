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

import fs from 'node:fs/promises';
import type {FFmpegUtilsType} from '@fluxer/media_proxy/src/lib/FFmpegUtils';
import type {ImageProcessor} from '@fluxer/media_proxy/src/lib/ImageProcessing';
import type {MimeTypeUtils} from '@fluxer/media_proxy/src/lib/MimeTypeUtils';
import sharp from 'sharp';
import {temporaryFile} from 'tempy';

interface TransformResult {
	data: Buffer;
	contentType: string;
}

interface ImageTransformOptions {
	width?: number;
	height?: number;
	format?: string;
	quality: string;
	animated: boolean;
	fallbackContentType: string;
}

interface VideoThumbnailTransformOptions {
	width?: number;
	height?: number;
	format: string;
	quality: string;
}

interface MediaTransformServiceDeps {
	imageProcessor: ImageProcessor;
	ffmpegUtils: FFmpegUtilsType;
	mimeTypeUtils: MimeTypeUtils;
}

export function createMediaTransformService(deps: MediaTransformServiceDeps) {
	const {imageProcessor, ffmpegUtils, mimeTypeUtils} = deps;
	const {processImage} = imageProcessor;
	const {createThumbnail} = ffmpegUtils;
	const {getMimeType} = mimeTypeUtils;

	async function transformImage(buffer: Buffer, options: ImageTransformOptions): Promise<TransformResult> {
		const metadata = await sharp(buffer).metadata();
		const targetWidth = options.width ? Math.min(options.width, metadata.width || 0) : metadata.width || 0;
		const targetHeight = options.height ? Math.min(options.height, metadata.height || 0) : metadata.height || 0;

		const outputFormat = (options.format || metadata.format?.toLowerCase() || '').toLowerCase();
		const image = await processImage({
			buffer,
			width: targetWidth,
			height: targetHeight,
			format: outputFormat,
			quality: options.quality,
			animated: options.animated,
		});

		const contentType = options.format
			? getMimeType(Buffer.from(''), `image.${options.format}`) || 'application/octet-stream'
			: options.fallbackContentType;

		return {data: image, contentType};
	}

	async function transformVideoThumbnail(
		buffer: Buffer,
		mimeType: string,
		options: VideoThumbnailTransformOptions,
	): Promise<TransformResult> {
		const ext = mimeType.split('/')[1] ?? 'bin';
		const tempPath = temporaryFile({extension: ext});
		const tempFiles: Array<string> = [tempPath];

		try {
			await fs.writeFile(tempPath, buffer);

			const thumbnailPath = await createThumbnail(tempPath);
			tempFiles.push(thumbnailPath);

			const thumbnailData = await fs.readFile(thumbnailPath);
			const thumbMeta = await sharp(thumbnailData).metadata();

			const targetWidth = options.width ? Math.min(options.width, thumbMeta.width || 0) : thumbMeta.width || 0;
			const targetHeight = options.height ? Math.min(options.height, thumbMeta.height || 0) : thumbMeta.height || 0;

			const processedThumbnail = await processImage({
				buffer: thumbnailData,
				width: targetWidth,
				height: targetHeight,
				format: options.format,
				quality: options.quality,
				animated: false,
			});

			const contentType = getMimeType(Buffer.from(''), `image.${options.format}`);
			if (!contentType) {
				throw new Error('Unsupported image format');
			}

			return {data: processedThumbnail, contentType};
		} finally {
			await Promise.all(tempFiles.map((f) => fs.unlink(f).catch(() => {})));
		}
	}

	return {transformImage, transformVideoThumbnail};
}

export type MediaTransformService = ReturnType<typeof createMediaTransformService>;
