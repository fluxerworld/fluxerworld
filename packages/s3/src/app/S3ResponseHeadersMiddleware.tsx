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

import {Headers} from '@fluxer/constants/src/Headers';
import type {HonoEnv} from '@fluxer/s3/src/types/HonoEnv';
import type {Hono} from 'hono';

export function setupS3ResponseHeadersMiddleware(app: Hono<HonoEnv>): void {
	app.use('*', async (ctx, next) => {
		await next();

		ctx.header(Headers.X_AMZ_ID_2, ctx.get('requestId'));
		ctx.header('Server', 'FluxerS3');

		const origin = ctx.req.header('origin');
		if (origin) {
			ctx.header('Access-Control-Allow-Origin', origin);
			ctx.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, HEAD, OPTIONS');
			ctx.header(
				'Access-Control-Allow-Headers',
				'Authorization, Content-Type, X-Amz-Date, X-Amz-Content-Sha256, X-Amz-User-Agent, X-Amz-Security-Token, X-Amz-Meta-*',
			);
			ctx.header(
				'Access-Control-Expose-Headers',
				'ETag, x-amz-request-id, x-amz-id-2, x-amz-version-id, x-amz-delete-marker',
			);
			ctx.header('Access-Control-Max-Age', '3600');
		}
	});

	app.options('*', (ctx) => {
		return ctx.body(null, 200);
	});
}
