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

import {CropAnimatedImageMessageType, type CropAnimatedImageStartMessage} from '@app/workers/AnimatedImageCrop.Worker';

type AnimatedImageFormat = 'gif' | 'webp' | 'avif' | 'apng';

interface CropOptions {
	x: number;
	y: number;
	width: number;
	height: number;
	imageRotation?: number;
	resizeWidth?: number | null;
	resizeHeight?: number | null;
}

interface WorkerRequest {
	resolve: (result: Uint8Array) => void;
	reject: (error: Error) => void;
	timeout: ReturnType<typeof setTimeout>;
}

interface WorkerState {
	worker: Worker;
	busy: boolean;
	currentRequest: WorkerRequest | null;
}

export class AnimatedImageCropWorkerManager {
	private static instance: AnimatedImageCropWorkerManager | null = null;
	private workers: Array<WorkerState> = [];
	private readonly maxWorkers: number;
	private terminated = false;
	private readonly workerTimeout: number = 30000;

	private constructor() {
		this.maxWorkers = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
	}

	static getInstance(): AnimatedImageCropWorkerManager {
		if (!AnimatedImageCropWorkerManager.instance) {
			AnimatedImageCropWorkerManager.instance = new AnimatedImageCropWorkerManager();
		}
		return AnimatedImageCropWorkerManager.instance;
	}

	private ensureWorkersInitialized(): void {
		if (this.workers.length < this.maxWorkers && !this.terminated) {
			const workersToCreate = this.maxWorkers - this.workers.length;
			for (let i = 0; i < workersToCreate; i++) {
				const worker = new Worker(new URL('./AnimatedImageCrop.Worker.tsx', import.meta.url), {
					type: 'module',
				});

				const workerState: WorkerState = {
					worker,
					busy: false,
					currentRequest: null,
				};

				worker.addEventListener('message', (event: MessageEvent) => {
					this.handleWorkerMessage(workerState, event);
				});

				worker.addEventListener('error', (error) => {
					this.handleWorkerError(workerState, error);
				});

				this.workers.push(workerState);
			}
		}
	}

	private handleWorkerMessage(workerState: WorkerState, event: MessageEvent): void {
		const msg = event.data;
		const request = workerState.currentRequest;

		if (!request) {
			return;
		}

		if (msg.type === CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_COMPLETE) {
			clearTimeout(request.timeout);
			workerState.busy = false;
			workerState.currentRequest = null;

			if (msg.result) {
				request.resolve(msg.result);
			} else {
				request.reject(new Error('Empty result from worker'));
			}
		} else if (msg.type === CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_ERROR) {
			clearTimeout(request.timeout);
			workerState.busy = false;
			workerState.currentRequest = null;
			request.reject(new Error(msg.error || 'Unknown error from worker'));
		}
	}

	private handleWorkerError(workerState: WorkerState, error: ErrorEvent): void {
		const request = workerState.currentRequest;

		if (request) {
			clearTimeout(request.timeout);
			workerState.busy = false;
			workerState.currentRequest = null;
			request.reject(new Error(`Worker error: ${error.message}`));
		}
	}

	async cropImage(imageBytes: Uint8Array, format: AnimatedImageFormat, options: CropOptions): Promise<Uint8Array> {
		if (this.terminated) {
			throw new Error('Worker manager has been terminated');
		}

		this.ensureWorkersInitialized();

		const workerState = this.findAvailableWorker();

		if (!workerState) {
			await new Promise((resolve) => setTimeout(resolve, 50));
			return this.cropImage(imageBytes, format, options);
		}

		return new Promise<Uint8Array>((resolve, reject) => {
			const timeout = setTimeout(() => {
				workerState.busy = false;
				workerState.currentRequest = null;
				reject(new Error(`Crop operation timed out after ${this.workerTimeout}ms`));
			}, this.workerTimeout);

			workerState.busy = true;
			workerState.currentRequest = {resolve, reject, timeout};

			const message: CropAnimatedImageStartMessage = {
				type: CropAnimatedImageMessageType.CROP_ANIMATED_IMAGE_START,
				imageBytes,
				format,
				...options,
			};

			const transferables: Array<Transferable> = [];
			if (imageBytes.buffer) {
				transferables.push(imageBytes.buffer);
			}

			workerState.worker.postMessage(message, transferables);
		});
	}

	private findAvailableWorker(): WorkerState | null {
		for (const workerState of this.workers) {
			if (!workerState.busy) {
				return workerState;
			}
		}
		return null;
	}

	getActiveWorkerCount(): number {
		return this.workers.filter((w) => w.busy).length;
	}

	getTotalWorkerCount(): number {
		return this.workers.length;
	}

	terminate(): void {
		if (this.terminated) {
			return;
		}

		this.terminated = true;

		for (const workerState of this.workers) {
			if (workerState.currentRequest) {
				clearTimeout(workerState.currentRequest.timeout);
				workerState.currentRequest.reject(new Error('Worker manager terminated'));
			}
			workerState.worker.terminate();
		}

		this.workers = [];
		AnimatedImageCropWorkerManager.instance = null;
	}

	restart(): void {
		if (!this.terminated) {
			return;
		}

		this.terminated = false;
		this.ensureWorkersInitialized();
	}
}

export async function cropAnimatedImageWithWorkerPool(
	imageBytes: Uint8Array,
	format: AnimatedImageFormat,
	options: CropOptions,
): Promise<Uint8Array> {
	const manager = AnimatedImageCropWorkerManager.getInstance();
	return manager.cropImage(imageBytes, format, options);
}

export function getWorkerManager(): AnimatedImageCropWorkerManager {
	return AnimatedImageCropWorkerManager.getInstance();
}
