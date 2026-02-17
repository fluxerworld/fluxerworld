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

import {PassThrough} from 'node:stream';
import {
	createGuildMemberImageRouteHandler,
	createImageRouteHandler,
} from '@fluxer/media_proxy/src/controllers/ImageController';
import type {ImageProcessor} from '@fluxer/media_proxy/src/lib/ImageProcessing';
import {InMemoryCoalescer} from '@fluxer/media_proxy/src/lib/InMemoryCoalescer';
import type {MimeTypeUtils} from '@fluxer/media_proxy/src/lib/MimeTypeUtils';
import type {S3Utils} from '@fluxer/media_proxy/src/lib/S3Utils';
import type {HonoEnv} from '@fluxer/media_proxy/src/types/HonoEnv';
import {Hono} from 'hono';
import {HTTPException} from 'hono/http-exception';
import sharp from 'sharp';
import {describe, expect, test, vi} from 'vitest';

async function createImageBuffer(): Promise<Buffer<ArrayBuffer>> {
	const sourceBuffer = await sharp({
		create: {
			width: 16,
			height: 16,
			channels: 4,
			background: {r: 0, g: 128, b: 255, alpha: 1},
		},
	})
		.png()
		.toBuffer();

	return Buffer.from(sourceBuffer);
}

function createMockS3Utils(imageBuffer: Buffer<ArrayBuffer>, readS3Object: S3Utils['readS3Object']): S3Utils {
	return {
		headS3Object: async () => ({
			contentLength: imageBuffer.length,
			contentType: 'image/png',
			lastModified: undefined,
		}),
		readS3Object,
		streamS3Object: async () => {
			const stream = new PassThrough();
			stream.end(imageBuffer);
			return {
				stream,
				size: imageBuffer.length,
				contentType: 'image/png',
				lastModified: undefined,
			};
		},
	};
}

function createMockImageProcessor(imageBuffer: Buffer<ArrayBuffer>): ImageProcessor {
	return {
		processImage: vi.fn(async () => imageBuffer),
	};
}

function createMockMimeTypeUtils(): MimeTypeUtils {
	return {
		getMimeType: vi.fn(() => 'image/webp'),
		generateFilename: vi.fn(() => 'image.webp'),
		getMediaCategory: vi.fn(() => 'image'),
		getContentType: vi.fn(() => 'image/webp'),
	};
}

function createImageApp(params: {
	readS3Object: S3Utils['readS3Object'];
	imageBuffer: Buffer<ArrayBuffer>;
}): Hono<HonoEnv> {
	const {readS3Object, imageBuffer} = params;
	const app = new Hono<HonoEnv>();
	const deps = {
		coalescer: new InMemoryCoalescer(),
		s3Utils: createMockS3Utils(imageBuffer, readS3Object),
		mimeTypeUtils: createMockMimeTypeUtils(),
		imageProcessor: createMockImageProcessor(imageBuffer),
		bucketCdn: 'cdn-bucket',
	};
	app.get('/avatars/:id/:filename', async (ctx) => createImageRouteHandler(deps)(ctx, 'avatars'));
	app.get('/guilds/:guild_id/users/:user_id/avatars/:filename', async (ctx) =>
		createGuildMemberImageRouteHandler(deps)(ctx, 'avatars'),
	);
	return app;
}

describe('image controller', () => {
	test('falls back to extension-suffixed avatar key', async () => {
		const imageBuffer = await createImageBuffer();
		const readS3Object = vi.fn<S3Utils['readS3Object']>(async (_bucket, key) => {
			if (key === 'avatars/42/abc123') {
				throw new HTTPException(404);
			}
			if (key === 'avatars/42/abc123.webp') {
				return {
					data: imageBuffer,
					size: imageBuffer.length,
					contentType: 'image/png',
					lastModified: undefined,
				};
			}
			throw new Error(`Unexpected key: ${key}`);
		});

		const app = createImageApp({readS3Object, imageBuffer});
		const response = await app.request('/avatars/42/abc123.webp?size=240');

		expect(response.status).toBe(200);
		expect(readS3Object).toHaveBeenNthCalledWith(1, 'cdn-bucket', 'avatars/42/abc123');
		expect(readS3Object).toHaveBeenNthCalledWith(2, 'cdn-bucket', 'avatars/42/abc123.webp');
	});

	test('keeps extensionless avatar key lookup as primary', async () => {
		const imageBuffer = await createImageBuffer();
		const readS3Object = vi.fn<S3Utils['readS3Object']>(async (_bucket, key) => {
			expect(key).toBe('avatars/42/abc123');
			return {
				data: imageBuffer,
				size: imageBuffer.length,
				contentType: 'image/png',
				lastModified: undefined,
			};
		});

		const app = createImageApp({readS3Object, imageBuffer});
		const response = await app.request('/avatars/42/abc123.webp?size=240');

		expect(response.status).toBe(200);
		expect(readS3Object).toHaveBeenCalledTimes(1);
		expect(readS3Object).toHaveBeenCalledWith('cdn-bucket', 'avatars/42/abc123');
	});

	test('falls back to extension-suffixed guild member avatar key', async () => {
		const imageBuffer = await createImageBuffer();
		const readS3Object = vi.fn<S3Utils['readS3Object']>(async (_bucket, key) => {
			if (key === 'guilds/100/users/200/avatars/abc123') {
				throw new HTTPException(404);
			}
			if (key === 'guilds/100/users/200/avatars/abc123.webp') {
				return {
					data: imageBuffer,
					size: imageBuffer.length,
					contentType: 'image/png',
					lastModified: undefined,
				};
			}
			throw new Error(`Unexpected key: ${key}`);
		});

		const app = createImageApp({readS3Object, imageBuffer});
		const response = await app.request('/guilds/100/users/200/avatars/abc123.webp?size=240');

		expect(response.status).toBe(200);
		expect(readS3Object).toHaveBeenNthCalledWith(1, 'cdn-bucket', 'guilds/100/users/200/avatars/abc123');
		expect(readS3Object).toHaveBeenNthCalledWith(2, 'cdn-bucket', 'guilds/100/users/200/avatars/abc123.webp');
	});
});
