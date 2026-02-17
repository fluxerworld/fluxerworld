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
import {setHeaders} from '@fluxer/media_proxy/src/lib/HttpUtils';
import type {S3Utils} from '@fluxer/media_proxy/src/lib/S3Utils';
import type {HonoEnv} from '@fluxer/media_proxy/src/types/HonoEnv';
import type {Context} from 'hono';
import {HTTPException} from 'hono/http-exception';

interface StaticProxyControllerDeps {
	s3Utils: S3Utils;
	bucketStatic?: string | undefined;
}

export function createStaticProxyHandler(deps: StaticProxyControllerDeps) {
	const {s3Utils, bucketStatic} = deps;
	const {readS3Object} = s3Utils;

	return async (ctx: Context<HonoEnv>): Promise<Response> => {
		const bucket = bucketStatic;
		const path = ctx.req.path;
		if (!bucket || path === '/') {
			return ctx.text('Not Found', 404);
		}
		const key = path.replace(/^\/+/, '');
		try {
			const {data, size, contentType, lastModified} = await readS3Object(bucket, key);
			assert(Buffer.isBuffer(data));
			setHeaders(ctx, size, contentType, null, lastModified);
			return ctx.body(toBodyData(data));
		} catch (error) {
			if (error instanceof HTTPException) {
				throw error;
			}
			return ctx.text('Not Found', 404);
		}
	};
}
