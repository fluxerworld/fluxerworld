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
import {toBodyData, toWebReadableStream} from '@fluxer/media_proxy/src/lib/BinaryUtils';
import type {S3Utils} from '@fluxer/media_proxy/src/lib/S3Utils';
import type {HonoEnv} from '@fluxer/media_proxy/src/types/HonoEnv';
import type {Context} from 'hono';

const THEME_ID_PATTERN = /^[a-f0-9]{16}$/;

interface ThemeControllerDeps {
	s3Utils: S3Utils;
	bucketCdn: string;
}

export function createThemeHeadHandler(deps: ThemeControllerDeps) {
	const {s3Utils, bucketCdn} = deps;

	return async (ctx: Context<HonoEnv>): Promise<Response> => {
		const filename = ctx.req.param('id.css');
		const themeId = filename?.replace(/\.css$/, '');

		if (!themeId || !THEME_ID_PATTERN.test(themeId)) {
			return ctx.text('Not found', {status: 404});
		}

		const {contentLength, lastModified} = await s3Utils.headS3Object(bucketCdn, `themes/${themeId}.css`);

		ctx.header('Content-Type', 'text/css; charset=utf-8');
		ctx.header('Cache-Control', 'public, max-age=31536000, immutable');
		ctx.header('Access-Control-Allow-Origin', '*');
		ctx.header('Content-Length', contentLength.toString());

		if (lastModified) {
			ctx.header('Last-Modified', lastModified.toUTCString());
		}

		return ctx.body(null);
	};
}

export function createThemeHandler(deps: ThemeControllerDeps) {
	const {s3Utils, bucketCdn} = deps;

	return async (ctx: Context<HonoEnv>): Promise<Response> => {
		const filename = ctx.req.param('id.css');
		const themeId = filename?.replace(/\.css$/, '');

		if (!themeId || !THEME_ID_PATTERN.test(themeId)) {
			return ctx.text('Not found', {status: 404});
		}

		const {data, lastModified} = await s3Utils.readS3Object(bucketCdn, `themes/${themeId}.css`);

		ctx.header('Content-Type', 'text/css; charset=utf-8');
		ctx.header('Cache-Control', 'public, max-age=31536000, immutable');
		ctx.header('Access-Control-Allow-Origin', '*');

		if (lastModified) {
			ctx.header('Last-Modified', new Date(lastModified).toUTCString());
		}

		if (data instanceof PassThrough) {
			return ctx.body(toWebReadableStream(data));
		} else {
			ctx.header('Content-Length', data.length.toString());
			return ctx.body(toBodyData(data));
		}
	};
}
