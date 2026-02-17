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
import {toBodyData} from '@fluxer/media_proxy/src/lib/BinaryUtils';
import {parseRange, setHeaders} from '@fluxer/media_proxy/src/lib/HttpUtils';
import type {InMemoryCoalescer} from '@fluxer/media_proxy/src/lib/InMemoryCoalescer';
import type {S3Utils} from '@fluxer/media_proxy/src/lib/S3Utils';
import {ImageQuerySchema} from '@fluxer/media_proxy/src/schemas/ValidationSchemas';
import type {HonoEnv} from '@fluxer/media_proxy/src/types/HonoEnv';
import type {Context} from 'hono';
import {HTTPException} from 'hono/http-exception';
import sharp from 'sharp';
import * as v from 'valibot';

interface StickerControllerDeps {
	coalescer: InMemoryCoalescer;
	s3Utils: S3Utils;
	bucketCdn: string;
}

function normalizeStickerObjectId(id: string): string {
	const firstDot = id.indexOf('.');
	return firstDot === -1 ? id : id.slice(0, firstDot);
}

async function processStickerRequest(params: {
	coalescer: InMemoryCoalescer;
	s3Utils: S3Utils;
	bucketCdn: string;
	ctx: Context<HonoEnv>;
	cacheKey: string;
	s3Key: string;
	size: string;
	quality: string;
	animated: boolean;
}): Promise<Response> {
	const {coalescer, s3Utils, bucketCdn, ctx, cacheKey, s3Key, size, quality, animated} = params;

	const result = await coalescer.coalesce(cacheKey, async () => {
		const {data} = await s3Utils.readS3Object(bucketCdn, s3Key);
		assert(data instanceof Buffer);

		const metadata = await sharp(data).metadata();
		const requestedSize = Number(size);

		const width = Math.min(requestedSize, metadata.width || 0);
		const height = Math.min(requestedSize, metadata.height || 0);

		const isAnimatedSource = (metadata.pages ?? 0) > 1;

		const shouldOutputAnimation = isAnimatedSource && animated;

		const image = await sharp(data, {animated: shouldOutputAnimation})
			.resize(width, height, {
				fit: 'contain',
				background: {r: 255, g: 255, b: 255, alpha: 0},
				withoutEnlargement: true,
			})
			.toFormat('webp', {
				quality: quality === 'high' ? 80 : quality === 'low' ? 20 : 100,
			})
			.toBuffer();

		return {data: image, contentType: 'image/webp'};
	});

	const range = parseRange(ctx.req.header('Range') ?? '', result.data.length);
	setHeaders(ctx, result.data.length, result.contentType, range);

	const fileData = range ? result.data.subarray(range.start, range.end + 1) : result.data;
	return ctx.body(toBodyData(fileData));
}

export function createStickerRouteHandler(deps: StickerControllerDeps) {
	return async (ctx: Context<HonoEnv>): Promise<Response> => {
		const {id} = ctx.req.param();
		const stickerObjectId = normalizeStickerObjectId(id);
		if (!stickerObjectId) {
			throw new HTTPException(400);
		}
		const {size, quality, animated} = v.parse(ImageQuerySchema, ctx.req.query());

		const cacheKey = `stickers_${stickerObjectId}_${size}_${quality}_${animated}`;
		const s3Key = `stickers/${stickerObjectId}`;

		return processStickerRequest({
			...deps,
			ctx,
			cacheKey,
			s3Key,
			size,
			quality,
			animated,
		});
	};
}
