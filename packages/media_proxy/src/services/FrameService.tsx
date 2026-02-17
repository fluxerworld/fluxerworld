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
import fs from 'node:fs/promises';
import type {LoggerInterface} from '@fluxer/logger/src/LoggerInterface';
import {
	computeFrameSampleTimestamps,
	FFmpegTimeoutError,
	type FrameExtractor,
	ffprobe,
} from '@fluxer/media_proxy/src/lib/FFmpegUtils';
import type {MimeTypeUtils} from '@fluxer/media_proxy/src/lib/MimeTypeUtils';
import type {S3Utils} from '@fluxer/media_proxy/src/lib/S3Utils';
import type {FrameRequest, FrameResponse, IFrameService} from '@fluxer/media_proxy/src/types/MediaProxyServices';
import sharp from 'sharp';
import {temporaryFile} from 'tempy';

export interface FrameServiceDeps {
	s3Utils: S3Utils;
	mimeTypeUtils: MimeTypeUtils;
	frameExtractor: FrameExtractor;
	logger: LoggerInterface;
	bucketUploads: string;
}

export function createFrameService(deps: FrameServiceDeps): IFrameService {
	const {s3Utils, mimeTypeUtils, frameExtractor, logger, bucketUploads} = deps;
	const {readS3Object} = s3Utils;
	const {getMimeType, getMediaCategory} = mimeTypeUtils;
	const {extractFramesAtTimes} = frameExtractor;

	async function extractFrames(request: FrameRequest): Promise<FrameResponse> {
		let data: Buffer;
		let filename: string;
		let mimeType: string | null | undefined;

		try {
			if (request.type === 'upload') {
				const result = await readS3Object(bucketUploads, request.upload_filename);
				assert(result.data instanceof Buffer);
				data = result.data;
				filename = request.upload_filename;
			} else {
				const result = await readS3Object(request.bucket, request.key);
				assert(result.data instanceof Buffer);
				data = result.data;
				filename = request.key.split('/').pop() ?? request.key;
			}

			mimeType = getMimeType(data, filename);
			if (!mimeType) {
				logger.warn({source: filename}, 'Unable to determine file type for frame extraction, returning empty frames');
				return {frames: []};
			}
		} catch (error) {
			logger.error({error, request}, 'Failed to read file for frame extraction, returning empty frames');
			return {frames: []};
		}

		if (!mimeType || !data) {
			return {frames: []};
		}

		const tempFilePath = temporaryFile({extension: 'tmp'});
		const tempFiles: Array<string> = [tempFilePath];

		try {
			await fs.writeFile(tempFilePath, data);

			const probeResult = await ffprobe(tempFilePath);
			const rawDuration = probeResult.format?.duration;
			const durationSeconds =
				typeof rawDuration === 'string' && Number.isFinite(Number.parseFloat(rawDuration))
					? Number.parseFloat(rawDuration)
					: null;

			const hasVideoStream = probeResult.streams?.some((stream) => stream.codec_type === 'video') ?? false;

			let isAnimatedImage = false;
			if (getMediaCategory(mimeType) === 'image') {
				try {
					const metadata = await sharp(data, {animated: true}).metadata();
					isAnimatedImage = (metadata.pages ?? 1) > 1;
				} catch (error) {
					logger.debug({error, source: filename}, 'Unable to detect animation pages');
				}
			}

			const isRealVideo = hasVideoStream && durationSeconds !== null && durationSeconds > 0;

			const frames: Array<{timestamp: number; mimeType: string; buffer: Buffer}> = [];
			if (isRealVideo || isAnimatedImage) {
				const timestamps = computeFrameSampleTimestamps(durationSeconds);
				const framePaths = await extractFramesAtTimes(tempFilePath, timestamps);
				for (let i = 0; i < framePaths.length; i++) {
					const framePath = framePaths[i];
					if (!framePath) continue;
					tempFiles.push(framePath);
					const frameData = await fs.readFile(framePath);
					frames.push({
						timestamp: timestamps[i] ?? 0,
						mimeType: 'image/jpeg',
						buffer: frameData,
					});
				}
			} else {
				frames.push({
					timestamp: 0,
					mimeType,
					buffer: data,
				});
			}

			return {
				frames: frames.map((frame) => ({
					timestamp: frame.timestamp,
					mime_type: frame.mimeType,
					base64: frame.buffer.toString('base64'),
				})),
			};
		} catch (error) {
			logger.error({error, source: filename}, 'Failed to extract media frames, returning empty frames');
			if (error instanceof FFmpegTimeoutError) {
				throw new Error(`Frame extraction timed out: ${error.operation}`);
			}
			return {frames: []};
		} finally {
			await Promise.all(
				tempFiles.map((file) => fs.unlink(file).catch(() => logger.error(`Failed to delete temp file: ${file}`))),
			);
		}
	}

	return {
		extractFrames,
	};
}
