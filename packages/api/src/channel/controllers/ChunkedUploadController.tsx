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
	ChunkedUploadChunkParam,
	ChunkedUploadParam,
	CompleteChunkedUploadRequest,
	CompleteChunkedUploadResponse,
	CreateChunkedUploadRequest,
	CreateChunkedUploadResponse,
	UploadChunkResponse,
} from '@fluxer/schema/src/domains/channel/ChunkedUploadSchemas';
import {ChannelIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';

export function ChunkedUploadController(app: HonoApp) {
	app.post(
		'/channels/:channel_id/chunked-uploads',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_CHUNKED_UPLOAD_CREATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChannelIdParam),
		Validator('json', CreateChunkedUploadRequest),
		OpenAPI({
			operationId: 'create_chunked_upload',
			summary: 'Initiate a chunked upload session',
			description:
				'Creates a new chunked upload session for uploading large files. Returns the upload ID, expected chunk size, and total chunk count. The client should then upload each chunk individually and complete the upload when all chunks are uploaded.',
			responseSchema: CreateChunkedUploadResponse,
			statusCode: 201,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Channels', 'Attachments'],
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const channelId = createChannelID(ctx.req.valid('param').channel_id);
			const body = ctx.req.valid('json');
			const chunkedUploadService = ctx.get('chunkedUploadService');
			const result = await chunkedUploadService.initiateUpload(user.id, channelId, body);
			return ctx.json(result, 201);
		},
	);

	app.put(
		'/channels/:channel_id/chunked-uploads/:upload_id/chunks/:chunk_index',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_CHUNKED_UPLOAD_CHUNK),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChunkedUploadChunkParam),
		OpenAPI({
			operationId: 'upload_chunk',
			summary: 'Upload a file chunk',
			description:
				'Uploads a single chunk of a file as part of a chunked upload session. The chunk index is zero-based. Returns an ETag that must be provided when completing the upload.',
			responseSchema: UploadChunkResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Channels', 'Attachments'],
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const {upload_id, chunk_index} = ctx.req.valid('param');
			const arrayBuffer = await ctx.req.arrayBuffer();
			const body = new Uint8Array(arrayBuffer);
			const chunkedUploadService = ctx.get('chunkedUploadService');
			const result = await chunkedUploadService.uploadChunk(user.id, upload_id, chunk_index, body);
			return ctx.json(result);
		},
	);

	app.post(
		'/channels/:channel_id/chunked-uploads/:upload_id/complete',
		RateLimitMiddleware(RateLimitConfigs.CHANNEL_CHUNKED_UPLOAD_COMPLETE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', ChunkedUploadParam),
		Validator('json', CompleteChunkedUploadRequest),
		OpenAPI({
			operationId: 'complete_chunked_upload',
			summary: 'Complete a chunked upload',
			description:
				'Completes a chunked upload session by assembling all uploaded chunks. Requires ETags for all chunks. Returns the upload filename that can be referenced when sending a message with the uploaded file.',
			responseSchema: CompleteChunkedUploadResponse,
			statusCode: 200,
			security: ['bearerToken', 'sessionToken'],
			tags: ['Channels', 'Attachments'],
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const {upload_id} = ctx.req.valid('param');
			const body = ctx.req.valid('json');
			const chunkedUploadService = ctx.get('chunkedUploadService');
			const result = await chunkedUploadService.completeUpload(user.id, upload_id, body);
			return ctx.json(result);
		},
	);
}
