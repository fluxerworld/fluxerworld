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

import {
	DEFAULT_MEDIA_PROXY_IMAGE_SIZE_QUERY_VALUE,
	MEDIA_PROXY_IMAGE_SIZE_QUERY_VALUES,
} from '@fluxer/constants/src/MediaProxyImageSizes';
import {z} from 'zod';

export const ImageSizeEnum = z.enum(MEDIA_PROXY_IMAGE_SIZE_QUERY_VALUES);
export type ImageSize = z.infer<typeof ImageSizeEnum>;

export const ImageFormatEnum = z.enum(['png', 'jpg', 'jpeg', 'webp', 'gif']);
export type ImageFormat = z.infer<typeof ImageFormatEnum>;

export const ImageQualityEnum = z.enum(['high', 'low', 'lossless']);
export type ImageQuality = z.infer<typeof ImageQualityEnum>;

export const ImageQueryParams = z.object({
	size: ImageSizeEnum.optional().default(DEFAULT_MEDIA_PROXY_IMAGE_SIZE_QUERY_VALUE),
	format: ImageFormatEnum.optional().default('webp'),
	quality: ImageQualityEnum.optional().default('high'),
	animated: z.enum(['true', 'false']).optional().default('false'),
});
export type ImageQueryParams = z.infer<typeof ImageQueryParams>;

export const ExternalMediaQueryParams = z.object({
	width: z.coerce.number().int().min(1).max(4096).optional(),
	height: z.coerce.number().int().min(1).max(4096).optional(),
	format: ImageFormatEnum.optional(),
	quality: ImageQualityEnum.optional().default('lossless'),
	animated: z.enum(['true', 'false']).optional().default('false'),
});
export type ExternalMediaQueryParams = z.infer<typeof ExternalMediaQueryParams>;

export const MetadataRequestExternal = z.object({
	type: z.literal('external'),
	url: z.url(),
	with_base64: z.boolean().optional(),
	isNSFWAllowed: z.boolean(),
});
export type MetadataRequestExternal = z.infer<typeof MetadataRequestExternal>;

export const MetadataRequestUpload = z.object({
	type: z.literal('upload'),
	upload_filename: z.string(),
	isNSFWAllowed: z.boolean(),
});
export type MetadataRequestUpload = z.infer<typeof MetadataRequestUpload>;

export const MetadataRequestBase64 = z.object({
	type: z.literal('base64'),
	base64: z.string(),
	isNSFWAllowed: z.boolean(),
});
export type MetadataRequestBase64 = z.infer<typeof MetadataRequestBase64>;

export const MetadataRequestS3 = z.object({
	type: z.literal('s3'),
	bucket: z.string(),
	key: z.string(),
	with_base64: z.boolean().optional(),
	isNSFWAllowed: z.boolean(),
});
export type MetadataRequestS3 = z.infer<typeof MetadataRequestS3>;

export const MetadataRequest = z.discriminatedUnion('type', [
	MetadataRequestExternal,
	MetadataRequestUpload,
	MetadataRequestBase64,
	MetadataRequestS3,
]);
export type MetadataRequest = z.infer<typeof MetadataRequest>;

export const MetadataResponse = z.object({
	format: z.string(),
	content_type: z.string(),
	content_hash: z.string(),
	size: z.number(),
	width: z.number().optional(),
	height: z.number().optional(),
	duration: z.number().optional(),
	placeholder: z.string().optional(),
	base64: z.string().optional(),
	animated: z.boolean().optional(),
	nsfw: z.boolean(),
	nsfw_probability: z.number().optional(),
	nsfw_predictions: z.record(z.string(), z.number()).optional(),
});
export type MetadataResponse = z.infer<typeof MetadataResponse>;

export const ThumbnailRequestBody = z.object({
	upload_filename: z.string(),
});
export type ThumbnailRequestBody = z.infer<typeof ThumbnailRequestBody>;

export const ThumbnailResponse = z.object({
	thumbnail: z.string(),
	mime_type: z.string(),
});
export type ThumbnailResponse = z.infer<typeof ThumbnailResponse>;

export const FrameRequestUpload = z.object({
	type: z.literal('upload'),
	upload_filename: z.string(),
});
export type FrameRequestUpload = z.infer<typeof FrameRequestUpload>;

export const FrameRequestS3 = z.object({
	type: z.literal('s3'),
	bucket: z.string(),
	key: z.string(),
});
export type FrameRequestS3 = z.infer<typeof FrameRequestS3>;

export const FrameRequest = z.discriminatedUnion('type', [FrameRequestUpload, FrameRequestS3]);
export type FrameRequest = z.infer<typeof FrameRequest>;

export const ExtractedFrame = z.object({
	timestamp: z.number(),
	mime_type: z.string(),
	base64: z.string(),
});
export type ExtractedFrame = z.infer<typeof ExtractedFrame>;

export const FrameResponse = z.object({
	frames: z.array(ExtractedFrame),
});
export type FrameResponse = z.infer<typeof FrameResponse>;
