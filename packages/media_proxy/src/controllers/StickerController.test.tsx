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
import {createStickerRouteHandler} from '@fluxer/media_proxy/src/controllers/StickerController';
import {InMemoryCoalescer} from '@fluxer/media_proxy/src/lib/InMemoryCoalescer';
import type {S3Utils} from '@fluxer/media_proxy/src/lib/S3Utils';
import type {HonoEnv} from '@fluxer/media_proxy/src/types/HonoEnv';
import {Hono} from 'hono';
import sharp from 'sharp';
import {describe, expect, test, vi} from 'vitest';

async function createStickerBuffer(): Promise<Buffer<ArrayBuffer>> {
	const sourceBuffer = await sharp({
		create: {
			width: 8,
			height: 8,
			channels: 4,
			background: {r: 255, g: 0, b: 0, alpha: 1},
		},
	})
		.webp()
		.toBuffer();

	return Buffer.from(sourceBuffer);
}

function createMockS3Utils(stickerBuffer: Buffer<ArrayBuffer>, readS3Object: S3Utils['readS3Object']): S3Utils {
	return {
		headS3Object: async () => ({
			contentLength: stickerBuffer.length,
			contentType: 'image/webp',
			lastModified: undefined,
		}),
		readS3Object,
		streamS3Object: async () => {
			const stream = new PassThrough();
			stream.end(stickerBuffer);
			return {
				stream,
				size: stickerBuffer.length,
				contentType: 'image/webp',
				lastModified: undefined,
			};
		},
	};
}

function createStickerApp(params: {
	readS3Object: S3Utils['readS3Object'];
	stickerBuffer: Buffer<ArrayBuffer>;
}): Hono<HonoEnv> {
	const {readS3Object, stickerBuffer} = params;
	const app = new Hono<HonoEnv>();
	app.get(
		'/stickers/:id',
		createStickerRouteHandler({
			coalescer: new InMemoryCoalescer(),
			s3Utils: createMockS3Utils(stickerBuffer, readS3Object),
			bucketCdn: 'cdn-bucket',
		}),
	);
	return app;
}

describe('sticker controller', () => {
	test('strips extension before S3 lookup', async () => {
		const stickerBuffer = await createStickerBuffer();
		const readS3Object = vi.fn<S3Utils['readS3Object']>(async (_bucket, key) => {
			expect(key).toBe('stickers/1471166588233970012');
			return {
				data: stickerBuffer,
				size: stickerBuffer.length,
				contentType: 'image/webp',
				lastModified: undefined,
			};
		});

		const app = createStickerApp({readS3Object, stickerBuffer});
		const response = await app.request('/stickers/1471166588233970012.webp?size=320&quality=lossless&animated=true');

		expect(response.status).toBe(200);
		expect(readS3Object).toHaveBeenCalledWith('cdn-bucket', 'stickers/1471166588233970012');
	});

	test('keeps legacy extensionless sticker lookup working', async () => {
		const stickerBuffer = await createStickerBuffer();
		const readS3Object = vi.fn<S3Utils['readS3Object']>(async (_bucket, key) => {
			expect(key).toBe('stickers/1471166588233970012');
			return {
				data: stickerBuffer,
				size: stickerBuffer.length,
				contentType: 'image/webp',
				lastModified: undefined,
			};
		});

		const app = createStickerApp({readS3Object, stickerBuffer});
		const response = await app.request('/stickers/1471166588233970012?size=320&quality=lossless&animated=false');

		expect(response.status).toBe(200);
		expect(readS3Object).toHaveBeenCalledWith('cdn-bucket', 'stickers/1471166588233970012');
	});
});
