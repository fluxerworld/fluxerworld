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

import type {
	CropAnimatedImageCompleteMessage,
	CropAnimatedImageErrorMessage,
	CropAnimatedImageStartMessage,
} from '@app/workers/AnimatedImageCrop.Worker';
import {CropAnimatedImageMessageType} from '@app/workers/AnimatedImageCrop.Worker';

export interface CropParams {
	x: number;
	y: number;
	width: number;
	height: number;
	imageRotation?: number;
	resizeWidth?: number | null;
	resizeHeight?: number | null;
}

export interface FrameBatch {
	startIndex: number;
	frames: Array<{
		data: Uint8Array;
		delay: number;
		disposeOp: number;
	}>;
}

type AnimatedImageFormat = 'gif' | 'webp' | 'avif' | 'apng';

interface WorkerJob {
	indices: Array<number>;
	frames: Array<Uint8Array>;
	resolve: (value: Uint8Array) => void;
	reject: (reason?: unknown) => void;
	timeout: NodeJS.Timeout;
}

interface WorkerState {
	worker: Worker;
	busy: boolean;
	currentJob: WorkerJob | null;
}

const DEFAULT_TIMEOUT = 30000;

export class AnimatedImageCropWorkerPool {
	private workers: Array<WorkerState>;
	private readonly timeout: number;
	private terminated: boolean = false;

	constructor(workerCount?: number, timeout: number = DEFAULT_TIMEOUT) {
		const concurrency = workerCount ?? Math.max(1, (navigator.hardwareConcurrency || 4) - 1);
		this.timeout = timeout;
		this.workers = [];

		for (let i = 0; i < concurrency; i++) {
			const worker = new Worker(new URL('./AnimatedImageCrop.Worker.tsx', import.meta.url), {
				type: 'module',
			});

			this.workers.push({
				worker,
				busy: false,
				currentJob: null,
			});
		}
	}

	async processFramesParallel(
		frames: Array<Uint8Array>,
		cropParams: CropParams,
		format: AnimatedImageFormat = 'gif',
	): Promise<Array<Uint8Array>> {
		if (this.terminated) {
			throw new Error('Worker pool has been terminated');
		}

		if (frames.length === 0) {
			return [];
		}

		if (frames.length === 1) {
			return [await this.processSingleFrame(frames[0], cropParams, format)];
		}

		const batches = this.createBatches(frames);
		const workerCount = this.workers.length;

		const results: Array<{index: number; data: Uint8Array}> = [];

		const batchPromises = batches.map((batch, batchIndex) => {
			const workerIndex = batchIndex % workerCount;
			return this.processBatchWithWorker(workerIndex, batch, cropParams, format);
		});

		const batchResults = await Promise.all(batchPromises);

		for (const batchResult of batchResults) {
			results.push(...batchResult);
		}

		results.sort((a, b) => a.index - b.index);
		return results.map((r) => r.data);
	}

	private createBatches(frames: Array<Uint8Array>): Array<FrameBatch> {
		const workerCount = this.workers.length;
		const batches: Array<FrameBatch> = [];
		const framesPerBatch = Math.ceil(frames.length / workerCount);

		for (let i = 0; i < workerCount && i * framesPerBatch < frames.length; i++) {
			const startIndex = i * framesPerBatch;
			const endIndex = Math.min(startIndex + framesPerBatch, frames.length);
			const batchFrames = frames.slice(startIndex, endIndex);

			batches.push({
				startIndex,
				frames: batchFrames.map((data) => ({
					data,
					delay: 0,
					disposeOp: 0,
				})),
			});
		}

		return batches;
	}

	private async processBatchWithWorker(
		workerIndex: number,
		batch: FrameBatch,
		cropParams: CropParams,
		format: AnimatedImageFormat,
	): Promise<Array<{index: number; data: Uint8Array}>> {
		const workerState = this.workers[workerIndex];

		if (!workerState) {
			throw new Error(`Worker at index ${workerIndex} not found`);
		}

		const results: Array<{index: number; data: Uint8Array}> = [];

		for (let i = 0; i < batch.frames.length; i++) {
			const frameData = batch.frames[i].data;
			const frameIndex = batch.startIndex + i;

			try {
				const croppedData = await this.processFrameWithWorker(workerIndex, frameData, cropParams, format);
				results.push({index: frameIndex, data: croppedData});
			} catch (error) {
				console.warn(`Worker ${workerIndex} failed for frame ${frameIndex}, attempting recovery:`, error);

				const recoveredWorkerIndex = (workerIndex + 1) % this.workers.length;
				try {
					const croppedData = await this.processFrameWithWorker(recoveredWorkerIndex, frameData, cropParams, format);
					results.push({index: frameIndex, data: croppedData});
				} catch (recoveryError) {
					const message = recoveryError instanceof Error ? recoveryError.message : String(recoveryError);
					throw new Error(`Failed to process frame ${frameIndex} after recovery attempt: ${message}`);
				}
			}
		}

		return results;
	}

	private processFrameWithWorker(
		workerIndex: number,
		frameData: Uint8Array,
		cropParams: CropParams,
		format: AnimatedImageFormat,
	): Promise<Uint8Array> {
		return new Promise((resolve, reject) => {
			const workerState = this.workers[workerIndex];

			if (!workerState) {
				reject(new Error(`Worker at index ${workerIndex} not found`));
				return;
			}

			const timeout = setTimeout(() => {
				workerState.busy = false;
				workerState.currentJob = null;
				reject(new Error(`Worker timeout after ${this.timeout}ms`));
			}, this.timeout);

			const message: CropAnimatedImageStartMessage = {
				type: CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_START,
				imageBytes: frameData,
				format,
				...cropParams,
			};

			const handleMessage = (event: MessageEvent) => {
				const msg = event.data;

				if (msg.type === CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_COMPLETE) {
					clearTimeout(timeout);
					workerState.busy = false;
					workerState.currentJob = null;
					workerState.worker.removeEventListener('message', handleMessage);
					workerState.worker.removeEventListener('error', handleError);

					const completeMsg = msg as CropAnimatedImageCompleteMessage;
					if (completeMsg.result) {
						resolve(completeMsg.result);
					} else {
						reject(new Error('Empty result from worker'));
					}
				} else if (msg.type === CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_ERROR) {
					clearTimeout(timeout);
					workerState.busy = false;
					workerState.currentJob = null;
					workerState.worker.removeEventListener('message', handleMessage);
					workerState.worker.removeEventListener('error', handleError);

					const errorMsg = msg as CropAnimatedImageErrorMessage;
					reject(new Error(errorMsg.error || 'Unknown error from worker'));
				}
			};

			const handleError = (error: ErrorEvent) => {
				clearTimeout(timeout);
				workerState.busy = false;
				workerState.currentJob = null;
				workerState.worker.removeEventListener('message', handleMessage);
				workerState.worker.removeEventListener('error', handleError);

				reject(new Error(`Worker error: ${error.message}`));
			};

			workerState.busy = true;
			workerState.currentJob = {
				indices: [0],
				frames: [frameData],
				resolve,
				reject,
				timeout,
			};

			workerState.worker.addEventListener('message', handleMessage);
			workerState.worker.addEventListener('error', handleError);

			const transferables: Array<Transferable> = [];
			if (frameData.buffer) {
				transferables.push(frameData.buffer);
			}
			workerState.worker.postMessage(message, transferables);
		});
	}

	private async processSingleFrame(
		frame: Uint8Array,
		cropParams: CropParams,
		format: AnimatedImageFormat,
	): Promise<Uint8Array> {
		const workerIndex = this.workers.findIndex((w) => !w.busy);
		const targetWorkerIndex = workerIndex >= 0 ? workerIndex : 0;

		return this.processFrameWithWorker(targetWorkerIndex, frame, cropParams, format);
	}

	getWorkerCount(): number {
		return this.workers.length;
	}

	getBusyWorkerCount(): number {
		return this.workers.filter((w) => w.busy).length;
	}

	isIdle(): boolean {
		return this.workers.every((w) => !w.busy);
	}

	terminate(): void {
		if (this.terminated) {
			return;
		}

		this.terminated = true;

		for (const workerState of this.workers) {
			if (workerState.currentJob?.timeout) {
				clearTimeout(workerState.currentJob.timeout);
			}

			try {
				workerState.worker.terminate();
			} catch (error) {
				console.warn('Error terminating worker:', error);
			}
		}

		this.workers = [];
	}

	restart(): void {
		if (!this.terminated) {
			this.terminate();
		}

		this.terminated = false;
		const concurrency = Math.max(1, (navigator.hardwareConcurrency || 4) - 1);
		this.workers = [];

		for (let i = 0; i < concurrency; i++) {
			const worker = new Worker(new URL('./AnimatedImageCrop.Worker.tsx', import.meta.url), {
				type: 'module',
			});

			this.workers.push({
				worker,
				busy: false,
				currentJob: null,
			});
		}
	}
}
