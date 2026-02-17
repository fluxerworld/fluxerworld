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

import {
	cropAndRotateApng,
	cropAndRotateGif,
	cropAndRotateImage,
	detectAnimatedImage,
	ensureLibfluxcoreReady,
} from '@app/lib/LibFluxcore';
import type {CropParams, FrameBatch} from '@app/workers/AnimatedImageCropWorkerPool';

type StaticImageFormat = 'webp' | 'avif' | 'apng' | 'png' | 'jpeg';
type AnimatedImageFormat = 'gif' | StaticImageFormat;

function getStaticFormatHint(format: StaticImageFormat): string {
	switch (format) {
		case 'apng':
		case 'png':
			return 'png';
		case 'jpeg':
			return 'jpeg';
		default:
			return format;
	}
}

const logger = {
	error: (...args: Array<unknown>) => {
		if (typeof console !== 'undefined') {
			console.error('[AnimatedImageCrop Worker]', ...args);
		}
	},
};

export enum CropAnimatedImageMessageType {
	CROP_ANIMATED_IMAGE_START = 0,
	CROP_ANIMATED_IMAGE_COMPLETE = 1,
	CROP_ANIMATED_IMAGE_ERROR = 2,
	PROCESS_BATCH = 3,
	BATCH_COMPLETE = 4,
}

export interface CropAnimatedImageStartMessage {
	type: CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_START;
	imageBytes: Uint8Array;
	format: AnimatedImageFormat;
	x: number;
	y: number;
	width: number;
	height: number;
	imageRotation?: number;
	resizeWidth?: number | null;
	resizeHeight?: number | null;
}

export interface CropAnimatedImageCompleteMessage {
	type: CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_COMPLETE;
	result: Uint8Array;
}

export interface CropAnimatedImageErrorMessage {
	type: CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_ERROR;
	error: string;
}

export interface ProcessBatchMessage {
	type: CropAnimatedImageMessageType.PROCESS_BATCH;
	jobId: number;
	batch: FrameBatch;
	cropParams: CropParams;
}

export interface ProcessBatchCompleteMessage {
	type: CropAnimatedImageMessageType.BATCH_COMPLETE;
	jobId: number;
	processedFrames: Array<Uint8Array>;
}

type IncomingMessage = CropAnimatedImageStartMessage | ProcessBatchMessage;

declare const self: DedicatedWorkerGlobalScope;

self.addEventListener('message', async (event: MessageEvent<IncomingMessage>) => {
	const msg = event.data;

	switch (msg?.type) {
		case CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_START:
			await handleCropStart(msg);
			break;
		case CropAnimatedImageMessageType.PROCESS_BATCH:
			await handleProcessBatch(msg);
			break;
		default:
			return;
	}
});

async function handleCropStart(msg: CropAnimatedImageStartMessage): Promise<void> {
	const {imageBytes, format, x, y, width, height, imageRotation = 0, resizeWidth = null, resizeHeight = null} = msg;

	try {
		await ensureLibfluxcoreReady();
		let result: Uint8Array;

		switch (format) {
			case 'gif':
				result = cropAndRotateGif(imageBytes, x, y, width, height, imageRotation, resizeWidth, resizeHeight);
				break;
			case 'apng': {
				const isActuallyAnimated = await detectAnimatedImage(imageBytes);
				if (isActuallyAnimated) {
					result = await cropAndRotateApng(imageBytes, x, y, width, height, imageRotation, resizeWidth, resizeHeight);
				} else {
					result = cropAndRotateImage(imageBytes, 'png', x, y, width, height, imageRotation, resizeWidth, resizeHeight);
				}
				break;
			}
			case 'webp':
			case 'avif': {
				const isAnimated = await detectAnimatedImage(imageBytes);
				if (isAnimated) {
					throw new Error(
						`Animated ${format.toUpperCase()} is not supported for cropping. Please use a static image or GIF format.`,
					);
				}
				const formatHint = getStaticFormatHint(format);
				result = cropAndRotateImage(
					imageBytes,
					formatHint,
					x,
					y,
					width,
					height,
					imageRotation,
					resizeWidth,
					resizeHeight,
				);
				break;
			}
			case 'png':
			case 'jpeg': {
				const formatHint = getStaticFormatHint(format);
				result = cropAndRotateImage(
					imageBytes,
					formatHint,
					x,
					y,
					width,
					height,
					imageRotation,
					resizeWidth,
					resizeHeight,
				);
				break;
			}
			default:
				throw new Error(`Unsupported animated image format: ${format}`);
		}

		const transferables: Array<Transferable> = [];
		if (result?.buffer) {
			transferables.push(result.buffer);
		}

		const response: CropAnimatedImageCompleteMessage = {
			type: CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_COMPLETE,
			result,
		};

		self.postMessage(response, transferables);
	} catch (err) {
		logger.error('Error:', err);
		const response: CropAnimatedImageErrorMessage = {
			type: CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_ERROR,
			error: err instanceof Error ? err.message : String(err),
		};
		self.postMessage(response);
	}
}

async function handleProcessBatch(msg: ProcessBatchMessage): Promise<void> {
	const {jobId, batch, cropParams} = msg;
	const {x, y, width, height, imageRotation = 0, resizeWidth = null, resizeHeight = null} = cropParams;

	try {
		await ensureLibfluxcoreReady();

		const processedFrames: Array<Uint8Array> = [];

		for (const frame of batch.frames) {
			const croppedFrame = cropAndRotateImage(
				frame.data,
				'png',
				x,
				y,
				width,
				height,
				imageRotation,
				resizeWidth,
				resizeHeight,
			);
			processedFrames.push(croppedFrame);
		}

		const transferables: Array<Transferable> = processedFrames
			.filter((frame) => frame.buffer)
			.map((frame) => frame.buffer);

		const response: ProcessBatchCompleteMessage = {
			type: CropAnimatedImageMessageType.BATCH_COMPLETE,
			jobId,
			processedFrames,
		};

		self.postMessage(response, transferables);
	} catch (err) {
		logger.error('Batch processing error:', err);
		const response: CropAnimatedImageErrorMessage = {
			type: CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_ERROR,
			error: err instanceof Error ? err.message : String(err),
		};
		self.postMessage(response);
	}
}
