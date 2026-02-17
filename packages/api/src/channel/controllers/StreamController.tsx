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

import {createChannelID} from '@fluxer/api/src/BrandedTypes';
import {DefaultUserOnly, LoginRequired} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {
	StreamPreviewUploadBodySchema,
	StreamUpdateBodySchema,
} from '@fluxer/schema/src/domains/channel/ChannelRequestSchemas';
import {StreamKeyParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';

export function StreamController(app: HonoApp) {
	app.patch(
		'/streams/:stream_key/stream',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_STREAM_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', StreamUpdateBodySchema),
		Validator('param', StreamKeyParam),
		OpenAPI({
			operationId: 'update_stream_region',
			summary: 'Update stream region',
			description:
				'Changes the media server region for an active stream. Used to optimise bandwidth and latency for streaming.',
			responseSchema: null,
			statusCode: 204,
			security: ['bearerToken', 'sessionToken'],
			tags: 'Channels',
		}),
		async (ctx) => {
			const {region} = ctx.req.valid('json');
			const streamKey = ctx.req.valid('param').stream_key;
			await ctx.get('streamService').updateStreamRegion({streamKey, region});
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/streams/:stream_key/preview',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_STREAM_PREVIEW_GET),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', StreamKeyParam),
		OpenAPI({
			operationId: 'get_stream_preview',
			summary: 'Get stream preview image',
			description:
				'Retrieves the current preview thumbnail for a stream. Returns the image with no-store cache headers to ensure freshness.',
			responseSchema: null,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: 'Channels',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const streamKey = ctx.req.valid('param').stream_key;
			const preview = await ctx.get('streamService').getPreview({streamKey, userId: user.id});
			if (!preview) {
				return ctx.body(null, 404);
			}
			const payload: ArrayBuffer = preview.buffer.slice().buffer;
			const headers = {
				'Content-Type': preview.contentType || 'image/jpeg',
				'Cache-Control': 'no-store, private',
				Pragma: 'no-cache',
			};
			return ctx.newResponse(payload, 200, headers);
		},
	);

	app.post(
		'/streams/:stream_key/preview',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_STREAM_PREVIEW_POST),
		LoginRequired,
		DefaultUserOnly,
		Validator('json', StreamPreviewUploadBodySchema),
		Validator('param', StreamKeyParam),
		OpenAPI({
			operationId: 'upload_stream_preview',
			summary: 'Upload stream preview image',
			description:
				'Uploads a custom thumbnail image for the stream. The image is scanned for content policy violations and stored securely.',
			responseSchema: null,
			statusCode: 204,
			security: ['bearerToken', 'sessionToken'],
			tags: 'Channels',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const {thumbnail, channel_id, content_type} = ctx.req.valid('json');
			const streamKey = ctx.req.valid('param').stream_key;
			await ctx.get('streamService').uploadPreview({
				streamKey,
				channelId: createChannelID(channel_id),
				userId: user.id,
				thumbnail,
				contentType: content_type,
			});
			return ctx.body(null, 204);
		},
	);
}
