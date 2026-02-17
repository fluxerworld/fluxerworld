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

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import type {HttpClient} from '@fluxer/http_client/src/HttpClientTypes';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import type {FFmpegUtilsType} from '@fluxer/media_proxy/src/lib/FFmpegUtils';
import type {InMemoryCoalescer} from '@fluxer/media_proxy/src/lib/InMemoryCoalescer';
import type {MediaValidator} from '@fluxer/media_proxy/src/lib/MediaValidation';
import type {MimeTypeUtils} from '@fluxer/media_proxy/src/lib/MimeTypeUtils';
import type {NSFWDetectionService} from '@fluxer/media_proxy/src/lib/NSFWDetectionService';
import type {S3Utils} from '@fluxer/media_proxy/src/lib/S3Utils';
import {streamToBuffer} from '@fluxer/media_proxy/src/lib/S3Utils';
import type {
	IMetadataService,
	MetadataRequest,
	MetadataResponse,
	ThumbnailRequest,
} from '@fluxer/media_proxy/src/types/MediaProxyServices';
import sharp from 'sharp';
import {temporaryFile} from 'tempy';

export interface MetadataServiceDeps {
	coalescer: InMemoryCoalescer;
	nsfwDetectionService: NSFWDetectionService;
	s3Utils: S3Utils;
	httpClient: HttpClient;
	mimeTypeUtils: MimeTypeUtils;
	mediaValidator: MediaValidator;
	ffmpegUtils: FFmpegUtilsType;
	logger: LoggerInterface;
	bucketUploads: string;
}

export function createMetadataService(deps: MetadataServiceDeps): IMetadataService {
	const {
		coalescer,
		nsfwDetectionService,
		s3Utils,
		httpClient,
		mimeTypeUtils,
		mediaValidator,
		ffmpegUtils,
		logger,
		bucketUploads,
	} = deps;
	const {readS3Object} = s3Utils;
	const {getMimeType, generateFilename} = mimeTypeUtils;
	const {validateMedia, processMetadata} = mediaValidator;
	const {createThumbnail} = ffmpegUtils;

	async function getMetadata(request: MetadataRequest): Promise<MetadataResponse> {
		const cacheKey = (() => {
			switch (request.type) {
				case 'base64':
					return `base64_${request.base64}`;
				case 'upload':
					return `upload_${request.upload_filename}`;
				case 'external':
					return `external_${request.url}_${request.with_base64}`;
				case 's3':
					return `s3_${request.bucket}_${request.key}_${request.with_base64}`;
			}
		})();

		return coalescer.coalesce(cacheKey, async () => {
			const tempFiles: Array<string> = [];
			try {
				const {buffer, filename} = await (async () => {
					switch (request.type) {
						case 'base64':
							return {buffer: Buffer.from(request.base64, 'base64'), filename: undefined};

						case 'upload': {
							const {data} = await readS3Object(bucketUploads, request.upload_filename);
							assert(data instanceof Buffer);
							return {buffer: data, filename: request.filename ?? request.upload_filename};
						}

						case 's3': {
							const {data} = await readS3Object(request.bucket, request.key);
							assert(data instanceof Buffer);
							const fname = request.key.substring(request.key.lastIndexOf('/') + 1);
							return {buffer: data, filename: fname || undefined};
						}

						case 'external': {
							const response = await httpClient.sendRequest({url: request.url});
							if (response.status !== 200) {
								throw new Error('Failed to fetch media');
							}

							const url = new URL(request.url);
							const fname = url.pathname.substring(url.pathname.lastIndexOf('/') + 1);
							return {buffer: await streamToBuffer(response.stream), filename: fname || undefined};
						}

						default:
							throw new Error('Invalid request type');
					}
				})();

				let effectiveFilename = filename;
				if (!effectiveFilename && request.type === 'base64') {
					const detectedMime = getMimeType(buffer);
					if (detectedMime) {
						effectiveFilename = generateFilename(detectedMime);
					} else {
						const metadata = await sharp(buffer).metadata();
						if (metadata.format) {
							effectiveFilename = `image.${metadata.format.toLowerCase()}`;
						}
					}
				}

				if (!effectiveFilename) {
					throw new Error('Cannot determine file type');
				}

				const mimeType = await validateMedia(buffer, effectiveFilename);
				const metadata = await processMetadata(mimeType, buffer);
				const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

				let nsfw = false;
				let nsfwProbability = 0;
				let nsfwPredictions: Record<string, number> = {};
				if (!request.isNSFWAllowed) {
					const isImageOrVideo = mimeType.startsWith('image/') || mimeType.startsWith('video/');
					if (isImageOrVideo) {
						try {
							let checkBuffer = buffer;
							if (mimeType.startsWith('video/')) {
								const videoExtension = mimeType.split('/')[1] ?? 'tmp';
								const tempPath = temporaryFile({extension: videoExtension});
								tempFiles.push(tempPath);
								await fs.writeFile(tempPath, buffer);

								const thumbnailPath = await createThumbnail(tempPath);
								tempFiles.push(thumbnailPath);

								checkBuffer = await fs.readFile(thumbnailPath);
							}
							const nsfwResult = await nsfwDetectionService.checkNSFWBuffer(checkBuffer);
							nsfw = nsfwResult.isNSFW;
							nsfwProbability = nsfwResult.probability;
							nsfwPredictions = nsfwResult.predictions ?? {};
						} catch (error) {
							logger.error({error}, 'Failed to perform NSFW detection');
						}
					}
				}

				return {
					...metadata,
					content_type: mimeType,
					content_hash: contentHash,
					nsfw,
					nsfw_probability: nsfwProbability,
					nsfw_predictions: nsfwPredictions,
					base64:
						(request.type === 'external' || request.type === 's3') && request.with_base64
							? buffer.toString('base64')
							: undefined,
				};
			} finally {
				await Promise.all(
					tempFiles.map((file) => fs.unlink(file).catch(() => logger.error(`Failed to delete temp file: ${file}`))),
				);
			}
		});
	}

	async function getThumbnail(request: ThumbnailRequest): Promise<Buffer> {
		const {data} = await readS3Object(bucketUploads, request.upload_filename);
		assert(data instanceof Buffer);

		const mimeType = getMimeType(data, request.upload_filename);
		if (!mimeType || !mimeType.startsWith('video/')) {
			throw new Error('File is not a video');
		}

		const videoExtension = mimeType.split('/')[1] ?? 'tmp';
		const tempPath = temporaryFile({extension: videoExtension});
		const tempFiles: Array<string> = [tempPath];

		try {
			await fs.writeFile(tempPath, data);
			const thumbnailPath = await createThumbnail(tempPath);
			tempFiles.push(thumbnailPath);
			return await fs.readFile(thumbnailPath);
		} finally {
			await Promise.all(
				tempFiles.map((file) => fs.unlink(file).catch(() => logger.error(`Failed to delete temp file: ${file}`))),
			);
		}
	}

	return {
		getMetadata,
		getThumbnail,
	};
}
