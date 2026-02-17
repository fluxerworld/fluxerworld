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
import type {CodecValidator} from '@fluxer/media_proxy/src/lib/CodecValidation';
import type {FFmpegUtilsType} from '@fluxer/media_proxy/src/lib/FFmpegUtils';
import {ffprobe} from '@fluxer/media_proxy/src/lib/FFmpegUtils';
import {generatePlaceholder} from '@fluxer/media_proxy/src/lib/ImageProcessing';
import type {MimeTypeUtils} from '@fluxer/media_proxy/src/lib/MimeTypeUtils';
import sharp from 'sharp';
import {temporaryFile} from 'tempy';

interface ImageMetadata {
	format: string;
	size: number;
	width: number;
	height: number;
	placeholder: string;
	animated: boolean;
}

interface VideoMetadata {
	format: string;
	size: number;
	width: number;
	height: number;
	duration: number;
	placeholder: string;
}

interface AudioMetadata {
	format: string;
	size: number;
	duration: number;
}

type MediaMetadata = ImageMetadata | VideoMetadata | AudioMetadata;

export interface MediaValidator {
	validateMedia: (buffer: Buffer, filename: string) => Promise<string>;
	processMetadata: (mimeType: string, buffer: Buffer) => Promise<MediaMetadata>;
}

export function createMediaValidator(
	mimeTypeUtils: MimeTypeUtils,
	codecValidator: CodecValidator,
	ffmpegUtils: FFmpegUtilsType,
): MediaValidator {
	const {getMimeType, generateFilename, getMediaCategory} = mimeTypeUtils;
	const {validateCodecs} = codecValidator;
	const {createThumbnail} = ffmpegUtils;

	async function validateMedia(buffer: Buffer, filename: string): Promise<string> {
		const mimeType = getMimeType(buffer, filename);

		if (!mimeType) {
			throw new Error('Unsupported file format');
		}

		const mediaType = getMediaCategory(mimeType);

		if (!mediaType) {
			throw new Error('Invalid media type');
		}

		if (mediaType !== 'image') {
			const validationFilename = filename.includes('.') ? filename : generateFilename(mimeType, filename);
			const isValid = await validateCodecs(buffer, validationFilename);
			if (!isValid) {
				throw new Error('File contains unsupported or non-web-compatible codecs');
			}
		}

		return mimeType;
	}

	function toNumericField(value: string | number | undefined): number {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	async function processMetadata(mimeType: string, buffer: Buffer): Promise<MediaMetadata> {
		const mediaType = getMediaCategory(mimeType);

		if (mediaType === 'image') {
			const {
				format: rawFormat = '',
				size = 0,
				width = 0,
				height: rawHeight = 0,
				pages,
			} = await sharp(buffer, {
				animated: true,
			}).metadata();

			const animated = pages ? pages > 1 : false;
			const height = animated ? Math.round(rawHeight / pages!) : rawHeight;

			if (width > 9500 || height > 9500) {
				throw new Error('Image dimensions too large');
			}

			return {
				format: rawFormat.toLowerCase(),
				size,
				width,
				height,
				placeholder: await generatePlaceholder(buffer),
				animated,
			} satisfies ImageMetadata;
		}

		const ext = mimeType.split('/')[1] ?? 'bin';
		const tempPath = temporaryFile({extension: ext});
		const tempFiles: Array<string> = [tempPath];

		try {
			await fs.writeFile(tempPath, buffer);

			if (mediaType === 'video') {
				const thumbnailPath = await createThumbnail(tempPath);
				tempFiles.push(thumbnailPath);

				const thumbnailData = await fs.readFile(thumbnailPath);
				const {width = 0, height = 0} = await sharp(thumbnailData).metadata();
				const probeData = await ffprobe(tempPath);

				return {
					format: (probeData.format?.format_name || '').toLowerCase(),
					size: toNumericField(probeData.format?.size),
					width,
					height,
					duration: Math.ceil(Number(probeData.format?.duration || 0)),
					placeholder: await generatePlaceholder(thumbnailData),
				} satisfies VideoMetadata;
			}

			if (mediaType === 'audio') {
				const probeData = await ffprobe(tempPath);
				return {
					format: (probeData.format?.format_name || '').toLowerCase(),
					size: toNumericField(probeData.format?.size),
					duration: Math.ceil(Number(probeData.format?.duration || 0)),
				} satisfies AudioMetadata;
			}

			throw new Error('Unsupported media type');
		} finally {
			await Promise.all(tempFiles.map((f) => fs.unlink(f).catch(() => {})));
		}
	}

	return {validateMedia, processMetadata};
}
