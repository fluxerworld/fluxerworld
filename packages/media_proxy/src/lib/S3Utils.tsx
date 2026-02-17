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
import {PassThrough, Stream} from 'node:stream';
import {GetObjectCommand, HeadObjectCommand, S3Client, S3ServiceException} from '@aws-sdk/client-s3';
import type {S3Config} from '@fluxer/media_proxy/src/types/MediaProxyConfig';
import type {MetricsInterface} from '@fluxer/media_proxy/src/types/Metrics';
import {HTTPException} from 'hono/http-exception';

const MAX_STREAM_BYTES = 500 * 1024 * 1024;

export function createS3Client(config: S3Config): S3Client {
	return new S3Client({
		endpoint: config.endpoint,
		region: config.region,
		forcePathStyle: true,
		credentials: {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
		},
		requestChecksumCalculation: 'WHEN_REQUIRED',
		responseChecksumValidation: 'WHEN_REQUIRED',
	});
}

export interface S3HeadResult {
	contentLength: number;
	contentType: string;
	lastModified?: Date | undefined;
}

export function createS3Utils(client: S3Client, metrics?: MetricsInterface) {
	const headS3Object = async (bucket: string, key: string): Promise<S3HeadResult> => {
		const start = Date.now();
		try {
			const command = new HeadObjectCommand({
				Bucket: bucket,
				Key: key,
			});

			const {ContentLength, ContentType, LastModified} = await client.send(command);

			metrics?.histogram({
				name: 'media_proxy.upstream.latency',
				dimensions: {operation: 'head'},
				valueMs: Date.now() - start,
			});

			return {
				contentLength: ContentLength ?? 0,
				contentType: ContentType ?? 'application/octet-stream',
				lastModified: LastModified,
			};
		} catch (error) {
			metrics?.histogram({
				name: 'media_proxy.upstream.latency',
				dimensions: {operation: 'head'},
				valueMs: Date.now() - start,
			});
			if (error instanceof S3ServiceException) {
				metrics?.counter({
					name: 'media_proxy.s3.error',
					dimensions: {operation: 'head', error_type: error.name},
				});
				if (error.name === 'NotFound') {
					throw new HTTPException(404);
				}
			}
			throw error;
		}
	};

	const readS3Object = async (bucket: string, key: string, range?: {start: number; end: number}) => {
		const start = Date.now();
		try {
			const command = new GetObjectCommand({
				Bucket: bucket,
				Key: key,
				Range: range ? `bytes=${range.start}-${range.end}` : undefined,
			});

			const {Body, ContentLength, LastModified, ContentType} = await client.send(command);
			assert(Body != null && ContentType != null);

			if (range) {
				assert(Body instanceof Stream);
				const stream = Body instanceof PassThrough ? Body : Body.pipe(new PassThrough());
				metrics?.histogram({
					name: 'media_proxy.upstream.latency',
					dimensions: {operation: 'read'},
					valueMs: Date.now() - start,
				});
				return {data: stream, size: ContentLength || 0, contentType: ContentType, lastModified: LastModified};
			}

			const chunks: Array<Buffer> = [];
			let totalSize = 0;

			assert(Body instanceof Stream);
			const stream = Body instanceof PassThrough ? Body : Body.pipe(new PassThrough());

			for await (const chunk of stream) {
				totalSize += chunk.length;
				if (totalSize > MAX_STREAM_BYTES) throw new HTTPException(413);
				chunks.push(chunk);
			}

			metrics?.histogram({
				name: 'media_proxy.upstream.latency',
				dimensions: {operation: 'read'},
				valueMs: Date.now() - start,
			});
			return {data: Buffer.concat(chunks), size: totalSize, contentType: ContentType, lastModified: LastModified};
		} catch (error) {
			metrics?.histogram({
				name: 'media_proxy.upstream.latency',
				dimensions: {operation: 'read'},
				valueMs: Date.now() - start,
			});
			if (error instanceof S3ServiceException) {
				metrics?.counter({
					name: 'media_proxy.s3.error',
					dimensions: {operation: 'read', error_type: error.name},
				});
				if (error.name === 'NoSuchKey') {
					throw new HTTPException(404);
				}
			}
			throw error;
		}
	};

	const streamS3Object = async (bucket: string, key: string) => {
		const start = Date.now();
		try {
			const command = new GetObjectCommand({
				Bucket: bucket,
				Key: key,
			});

			const {Body, ContentLength, LastModified, ContentType} = await client.send(command);
			assert(Body != null && ContentType != null);

			assert(Body instanceof Stream, 'Expected S3 response body to be a stream');
			const stream = Body instanceof PassThrough ? Body : Body.pipe(new PassThrough());

			metrics?.histogram({
				name: 'media_proxy.upstream.latency',
				dimensions: {operation: 'stream'},
				valueMs: Date.now() - start,
			});
			return {stream, size: ContentLength || 0, contentType: ContentType, lastModified: LastModified};
		} catch (error) {
			metrics?.histogram({
				name: 'media_proxy.upstream.latency',
				dimensions: {operation: 'stream'},
				valueMs: Date.now() - start,
			});
			if (error instanceof S3ServiceException) {
				metrics?.counter({
					name: 'media_proxy.s3.error',
					dimensions: {operation: 'stream', error_type: error.name},
				});
				if (error.name === 'NoSuchKey') {
					throw new HTTPException(404);
				}
			}
			throw error;
		}
	};

	return {headS3Object, readS3Object, streamS3Object};
}

export type S3Utils = ReturnType<typeof createS3Utils>;

export async function streamToBuffer(stream: ReadableStream<Uint8Array> | null): Promise<Buffer> {
	if (!stream) {
		return Buffer.alloc(0);
	}

	const chunks: Array<Uint8Array> = [];
	let totalSize = 0;
	const reader = stream.getReader();

	try {
		while (true) {
			const {done, value} = await reader.read();
			if (done) break;
			if (value) {
				totalSize += value.length;
				if (totalSize > MAX_STREAM_BYTES) throw new HTTPException(413);
				chunks.push(value);
			}
		}
	} finally {
		reader.releaseLock();
	}

	const result = new Uint8Array(totalSize);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.length;
	}
	return Buffer.from(result);
}
