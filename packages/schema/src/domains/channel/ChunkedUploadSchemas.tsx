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

import {FilenameType} from '@fluxer/schema/src/primitives/FileValidators';
import {
	coerceNumberFromString,
	createStringType,
	Int32Type,
	SnowflakeType,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const CreateChunkedUploadRequest = z.object({
	filename: FilenameType.describe('The name of the file being uploaded'),
	file_size: z.number().int().positive().describe('The total size of the file in bytes'),
});
export type CreateChunkedUploadRequest = z.infer<typeof CreateChunkedUploadRequest>;

export const CreateChunkedUploadResponse = z.object({
	upload_id: z.string().describe('The unique identifier for the upload session'),
	upload_filename: z.string().describe('The temporary filename used to reference this upload'),
	chunk_size: z.number().int().describe('The size of each chunk in bytes'),
	chunk_count: z.number().int().describe('The total number of chunks to upload'),
});
export type CreateChunkedUploadResponse = z.infer<typeof CreateChunkedUploadResponse>;

export const UploadChunkResponse = z.object({
	etag: z.string().describe('The ETag of the uploaded chunk'),
});
export type UploadChunkResponse = z.infer<typeof UploadChunkResponse>;

export const CompleteChunkedUploadRequest = z.object({
	etags: z
		.array(
			z.object({
				chunk_index: z.number().int().min(0).describe('The zero-based index of the chunk'),
				etag: z.string().describe('The ETag returned when the chunk was uploaded'),
			}),
		)
		.min(1)
		.describe('Array of chunk ETags in order'),
});
export type CompleteChunkedUploadRequest = z.infer<typeof CompleteChunkedUploadRequest>;

export const CompleteChunkedUploadResponse = z.object({
	upload_filename: z.string().describe('The temporary filename used to reference this upload'),
	file_size: z.number().int().describe('The total size of the uploaded file in bytes'),
	content_type: z.string().describe('The MIME type of the uploaded file'),
});
export type CompleteChunkedUploadResponse = z.infer<typeof CompleteChunkedUploadResponse>;

export const ChunkedUploadParam = z.object({
	channel_id: SnowflakeType.describe('The ID of the channel'),
	upload_id: createStringType(1, 128).describe('The ID of the chunked upload session'),
});
export type ChunkedUploadParam = z.infer<typeof ChunkedUploadParam>;

export const ChunkedUploadChunkParam = z.object({
	channel_id: SnowflakeType.describe('The ID of the channel'),
	upload_id: createStringType(1, 128).describe('The ID of the chunked upload session'),
	chunk_index: coerceNumberFromString(Int32Type.min(0)).describe('The zero-based index of the chunk'),
});
export type ChunkedUploadChunkParam = z.infer<typeof ChunkedUploadChunkParam>;
