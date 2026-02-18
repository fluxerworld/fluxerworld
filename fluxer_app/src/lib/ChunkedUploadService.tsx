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

import {Endpoints} from '@app/Endpoints';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import {CHUNKED_UPLOAD_CHUNK_SIZE} from '@fluxer/constants/src/LimitConstants';

const logger = new Logger('ChunkedUploadService');

const MAX_CONCURRENT_CHUNKS = 4;
const MAX_CHUNK_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

interface ChunkedUploadResult {
	upload_filename: string;
	file_size: number;
	content_type: string;
}

interface InitiateUploadResponse {
	upload_id: string;
	upload_filename: string;
	chunk_size: number;
	chunk_count: number;
}

interface UploadChunkResponse {
	etag: string;
}

interface CompleteUploadResponse {
	upload_filename: string;
	file_size: number;
	content_type: string;
}

export async function uploadFileChunked(
	channelId: string,
	file: File,
	onProgress?: (loaded: number, total: number) => void,
	signal?: AbortSignal,
): Promise<ChunkedUploadResult> {
	const initiateResponse = await http.post<InitiateUploadResponse>({
		url: Endpoints.CHANNEL_CHUNKED_UPLOADS(channelId),
		body: {
			filename: file.name,
			file_size: file.size,
		},
		signal,
		rejectWithError: true,
	});

	const {upload_id, chunk_size, chunk_count} = initiateResponse.body;

	logger.debug(`Initiated chunked upload: ${upload_id}, ${chunk_count} chunks of ${chunk_size} bytes`);

	const chunkProgress = new Array<number>(chunk_count).fill(0);
	const etags = new Array<{chunk_index: number; etag: string}>(chunk_count);

	function reportProgress() {
		if (!onProgress) return;
		const loaded = chunkProgress.reduce((sum, bytes) => sum + bytes, 0);
		onProgress(loaded, file.size);
	}

	const chunkIndices = Array.from({length: chunk_count}, (_, i) => i);
	let cursor = 0;
	const activeTasks: Array<Promise<void>> = [];

	async function uploadOneChunk(chunkIndex: number): Promise<void> {
		const start = chunkIndex * chunk_size;
		const end = Math.min(start + chunk_size, file.size);
		const chunkBlob = file.slice(start, end);
		const chunkData = new Uint8Array(await chunkBlob.arrayBuffer());
		const chunkLength = chunkData.byteLength;

		let lastError: unknown;
		for (let attempt = 0; attempt <= MAX_CHUNK_RETRIES; attempt++) {
			if (signal?.aborted) {
				throw new DOMException('Upload cancelled', 'AbortError');
			}

			try {
				const response = await http.put<UploadChunkResponse>({
					url: Endpoints.CHANNEL_CHUNKED_UPLOAD_CHUNK(channelId, upload_id, chunkIndex),
					body: chunkData,
					headers: {'Content-Type': 'application/octet-stream'},
					signal,
					rejectWithError: true,
				});

				etags[chunkIndex] = {chunk_index: chunkIndex, etag: response.body.etag};
				chunkProgress[chunkIndex] = chunkLength;
				reportProgress();
				return;
			} catch (error) {
				lastError = error;

				if (signal?.aborted) {
					throw error;
				}

				const isRetryable =
					error instanceof Error &&
					'status' in error &&
					((error as {status: number}).status >= 500 || (error as {status: number}).status === 429);

				if (!isRetryable || attempt === MAX_CHUNK_RETRIES) {
					throw error;
				}

				const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
				logger.debug(
					`Chunk ${chunkIndex} failed (attempt ${attempt + 1}/${MAX_CHUNK_RETRIES + 1}), retrying in ${delay}ms`,
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		throw lastError;
	}

	await new Promise<void>((resolve, reject) => {
		let settled = false;

		function settle(error?: unknown) {
			if (settled) return;
			settled = true;
			if (error) {
				reject(error);
			} else {
				resolve();
			}
		}

		function scheduleNext() {
			while (activeTasks.length < MAX_CONCURRENT_CHUNKS && cursor < chunkIndices.length) {
				const chunkIndex = chunkIndices[cursor++];
				const task = uploadOneChunk(chunkIndex).then(
					() => {
						const idx = activeTasks.indexOf(task);
						if (idx !== -1) activeTasks.splice(idx, 1);
						if (cursor >= chunkIndices.length && activeTasks.length === 0) {
							settle();
						} else {
							scheduleNext();
						}
					},
					(error) => {
						settle(error);
					},
				);
				activeTasks.push(task);
			}
		}

		scheduleNext();
	});

	logger.debug(`All ${chunk_count} chunks uploaded, completing upload`);

	const completeResponse = await http.post<CompleteUploadResponse>({
		url: Endpoints.CHANNEL_CHUNKED_UPLOAD_COMPLETE(channelId, upload_id),
		body: {etags},
		signal,
		rejectWithError: true,
	});

	return {
		upload_filename: completeResponse.body.upload_filename,
		file_size: completeResponse.body.file_size,
		content_type: completeResponse.body.content_type,
	};
}

export function shouldUseChunkedUpload(file: File): boolean {
	return file.size > CHUNKED_UPLOAD_CHUNK_SIZE;
}
