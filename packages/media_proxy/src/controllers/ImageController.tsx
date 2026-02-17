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
import type {ImageProcessor} from '@fluxer/media_proxy/src/lib/ImageProcessing';
import type {InMemoryCoalescer} from '@fluxer/media_proxy/src/lib/InMemoryCoalescer';
import {MEDIA_TYPES} from '@fluxer/media_proxy/src/lib/MediaTypes';
import type {MimeTypeUtils} from '@fluxer/media_proxy/src/lib/MimeTypeUtils';
import type {S3Utils} from '@fluxer/media_proxy/src/lib/S3Utils';
import {ImageParamSchema, ImageQuerySchema} from '@fluxer/media_proxy/src/schemas/ValidationSchemas';
import type {HonoEnv} from '@fluxer/media_proxy/src/types/HonoEnv';
import type {Context} from 'hono';
import {HTTPException} from 'hono/http-exception';
import sharp from 'sharp';
import * as v from 'valibot';

function stripAnimationPrefix(hash: string) {
	return hash.startsWith('a_') ? hash.substring(2) : hash;
}

interface ImageControllerDeps {
	coalescer: InMemoryCoalescer;
	s3Utils: S3Utils;
	mimeTypeUtils: MimeTypeUtils;
	imageProcessor: ImageProcessor;
	bucketCdn: string;
}

async function readImageSource(params: {
	s3Utils: S3Utils;
	bucketCdn: string;
	s3Key: string;
	fallbackS3Key?: string | undefined;
}): Promise<Buffer> {
	const {s3Utils, bucketCdn, s3Key, fallbackS3Key} = params;
	try {
		const {data} = await s3Utils.readS3Object(bucketCdn, s3Key);
		assert(data instanceof Buffer);
		return data;
	} catch (error) {
		const isNotFound = error instanceof HTTPException && error.status === 404;
		if (!isNotFound || !fallbackS3Key) {
			throw error;
		}
		const {data} = await s3Utils.readS3Object(bucketCdn, fallbackS3Key);
		assert(data instanceof Buffer);
		return data;
	}
}

async function processImageRequest(params: {
	coalescer: InMemoryCoalescer;
	s3Utils: S3Utils;
	mimeTypeUtils: MimeTypeUtils;
	imageProcessor: ImageProcessor;
	bucketCdn: string;
	ctx: Context<HonoEnv>;
	cacheKey: string;
	s3Key: string;
	fallbackS3Key?: string | undefined;
	ext: string;
	aspectRatio: number;
	size: string;
	quality: string;
	animated: boolean;
}): Promise<Response> {
	const {
		coalescer,
		s3Utils,
		mimeTypeUtils,
		imageProcessor,
		bucketCdn,
		ctx,
		cacheKey,
		s3Key,
		fallbackS3Key,
		ext,
		aspectRatio,
		size,
		quality,
		animated,
	} = params;

	const result = await coalescer.coalesce(cacheKey, async () => {
		const data = await readImageSource({
			s3Utils,
			bucketCdn,
			s3Key,
			fallbackS3Key,
		});

		const metadata = await sharp(data).metadata();
		const requestedWidth = Number(size);
		const originalAspectRatio = (metadata.width || 1) / (metadata.height || 1);
		const effectiveAspectRatio = aspectRatio === 0 ? originalAspectRatio : aspectRatio;
		const requestedHeight = Math.floor(requestedWidth / effectiveAspectRatio);

		const width = Math.min(requestedWidth, metadata.width || 0);
		const height = Math.min(requestedHeight, metadata.height || 0);

		const normalizedExt = ext.toLowerCase();
		const image = await imageProcessor.processImage({
			buffer: data,
			width,
			height,
			format: normalizedExt,
			quality,
			animated,
		});

		const mimeType = mimeTypeUtils.getMimeType(Buffer.from(''), `image.${normalizedExt}`) || 'application/octet-stream';
		return {data: image, contentType: mimeType};
	});

	const range = parseRange(ctx.req.header('Range') ?? '', result.data.length);
	setHeaders(ctx, result.data.length, result.contentType, range);

	const fileData = range ? result.data.subarray(range.start, range.end + 1) : result.data;
	return ctx.body(toBodyData(fileData));
}

export function createImageRouteHandler(deps: ImageControllerDeps) {
	return async (ctx: Context<HonoEnv>, pathPrefix: string, aspectRatio = 0): Promise<Response> => {
		const {id, filename} = v.parse(ImageParamSchema, ctx.req.param());
		if (!filename || !id) throw new HTTPException(400);
		const {size, quality, animated} = v.parse(ImageQuerySchema, ctx.req.query());

		const parts = filename.split('.');
		const extPart = parts[1];
		if (parts.length !== 2 || !extPart || !MEDIA_TYPES.IMAGE.extensions.includes(extPart)) {
			throw new HTTPException(400);
		}

		const [hash, ext] = parts;
		if (!hash || !ext) throw new HTTPException(400);
		const normalizedExt = ext.toLowerCase();
		const strippedHash = stripAnimationPrefix(hash);
		const cacheKey = `${pathPrefix}_${id}_${hash}_${normalizedExt}_${size}_${quality}_${aspectRatio}_${animated}`;
		const s3Key = `${pathPrefix}/${id}/${strippedHash}`;
		const fallbackS3Key = `${pathPrefix}/${id}/${strippedHash}.${normalizedExt}`;

		return processImageRequest({
			...deps,
			ctx,
			cacheKey,
			s3Key,
			fallbackS3Key,
			ext: normalizedExt,
			aspectRatio,
			size,
			quality,
			animated,
		});
	};
}

export function createGuildMemberImageRouteHandler(deps: ImageControllerDeps) {
	return async (ctx: Context<HonoEnv>, pathPrefix: string, aspectRatio = 0): Promise<Response> => {
		const {guild_id, user_id, filename} = ctx.req.param();
		if (!filename || !guild_id || !user_id) throw new HTTPException(400);
		const {size, quality, animated} = v.parse(ImageQuerySchema, ctx.req.query());

		const parts = filename.split('.');
		const extPart = parts[1];
		if (parts.length !== 2 || !extPart || !MEDIA_TYPES.IMAGE.extensions.includes(extPart)) {
			throw new HTTPException(400);
		}

		const [hash, ext] = parts;
		if (!hash || !ext) throw new HTTPException(400);
		const normalizedExt = ext.toLowerCase();
		const strippedHash = stripAnimationPrefix(hash);
		const cacheKey = `${pathPrefix}_${guild_id}_${user_id}_${hash}_${normalizedExt}_${size}_${quality}_${aspectRatio}_${animated}`;
		const s3Key = `guilds/${guild_id}/users/${user_id}/${pathPrefix}/${strippedHash}`;
		const fallbackS3Key = `guilds/${guild_id}/users/${user_id}/${pathPrefix}/${strippedHash}.${normalizedExt}`;

		return processImageRequest({
			...deps,
			ctx,
			cacheKey,
			s3Key,
			fallbackS3Key,
			ext: normalizedExt,
			aspectRatio,
			size,
			quality,
			animated,
		});
	};
}

async function processSimpleImageRequest(params: {
	coalescer: InMemoryCoalescer;
	s3Utils: S3Utils;
	bucketCdn: string;
	ctx: Context<HonoEnv>;
	cacheKey: string;
	s3Key: string;
	aspectRatio: number;
	size: string;
	quality: string;
	animated: boolean;
}): Promise<Response> {
	const {coalescer, s3Utils, bucketCdn, ctx, cacheKey, s3Key, aspectRatio, size, quality, animated} = params;

	const result = await coalescer.coalesce(cacheKey, async () => {
		const {data} = await s3Utils.readS3Object(bucketCdn, s3Key);
		assert(data instanceof Buffer);

		const metadata = await sharp(data).metadata();
		const requestedWidth = Number(size);
		const originalAspectRatio = (metadata.width || 1) / (metadata.height || 1);
		const effectiveAspectRatio = aspectRatio === 0 ? originalAspectRatio : aspectRatio;
		const requestedHeight = Math.floor(requestedWidth / effectiveAspectRatio);

		const width = Math.min(requestedWidth, metadata.width || 0);
		const height = Math.min(requestedHeight, metadata.height || 0);

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

export function createSimpleImageRouteHandler(deps: ImageControllerDeps) {
	return async (ctx: Context<HonoEnv>, pathPrefix: string, aspectRatio = 0): Promise<Response> => {
		const {id} = ctx.req.param();
		if (!id) throw new HTTPException(400);
		const {size, quality, animated} = v.parse(ImageQuerySchema, ctx.req.query());

		const parts = id.split('.');
		const extPart = parts[1];
		if (parts.length !== 2 || !extPart || !MEDIA_TYPES.IMAGE.extensions.includes(extPart)) {
			throw new HTTPException(400);
		}

		const [filename, ext] = parts;
		if (!filename || !ext) throw new HTTPException(400);
		const normalizedExt = ext.toLowerCase();
		const cacheKey = `${pathPrefix}_${filename}_${normalizedExt}_${size}_${quality}_${aspectRatio}_${animated}`;
		const s3Key = `${pathPrefix}/${filename}`;

		return processSimpleImageRequest({
			coalescer: deps.coalescer,
			s3Utils: deps.s3Utils,
			bucketCdn: deps.bucketCdn,
			ctx,
			cacheKey,
			s3Key,
			aspectRatio,
			size,
			quality,
			animated,
		});
	};
}
