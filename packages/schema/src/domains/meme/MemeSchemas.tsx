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

import {createStringType, SnowflakeStringType, SnowflakeType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

const FavoriteMemeBase = z.object({
	name: createStringType(1, 100).describe('Display name for the meme'),
	alt_text: createStringType(0, 500).nullish().describe('Alternative text description for accessibility'),
	tags: z
		.array(createStringType(1, 30))
		.nullish()
		.default([])
		.transform((tags) => (tags || []).filter((t) => t.trim().length > 0))
		.describe('Tags for categorizing and searching the meme'),
});

export const CreateFavoriteMemeBodySchema = FavoriteMemeBase.extend({
	attachment_id: SnowflakeType.nullish().describe('ID of the message attachment to save as a meme'),
	embed_index: z.number().int().min(0).nullish().describe('Index of the message embed to save as a meme'),
}).refine((data) => data.attachment_id !== undefined || data.embed_index !== undefined, {
	message: 'Either attachment_id or embed_index must be provided',
});
export type CreateFavoriteMemeBodySchema = z.infer<typeof CreateFavoriteMemeBodySchema>;

export const CreateFavoriteMemeFromUrlBodySchema = FavoriteMemeBase.extend({
	url: z.url().describe('URL of the image or video to save as a favorite meme'),
	klipy_slug: createStringType(1, 100).nullish().describe('Klipy clip slug if the URL is from Klipy'),
	tenor_slug_id: createStringType(1, 300)
		.nullish()
		.describe('Tenor view/<slug>-<id> identifier if the URL is from Tenor'),
})
	.omit({name: true})
	.extend({
		name: createStringType(1, 100).nullish().describe('Display name for the meme'),
	});
export type CreateFavoriteMemeFromUrlBodySchema = z.infer<typeof CreateFavoriteMemeFromUrlBodySchema>;

export const UpdateFavoriteMemeBodySchema = FavoriteMemeBase.partial()
	.omit({tags: true})
	.extend({
		tags: z
			.array(createStringType(1, 30))
			.nullish()
			.transform((tags) => (tags ? tags.filter((t) => t.trim().length > 0) : undefined))
			.describe('New tags for categorizing and searching the meme'),
	});
export type UpdateFavoriteMemeBodySchema = z.infer<typeof UpdateFavoriteMemeBodySchema>;

export const FavoriteMemeResponse = z.object({
	id: SnowflakeStringType.describe('Unique identifier for the favorite meme'),
	user_id: SnowflakeStringType.describe('ID of the user who owns this favorite meme'),
	name: z.string().describe('Display name of the meme'),
	alt_text: z.string().nullish().describe('Alternative text description for accessibility'),
	tags: z.array(z.string()).describe('Tags for categorizing and searching the meme'),
	attachment_id: SnowflakeStringType.describe('ID of the attachment storing the meme'),
	filename: z.string().describe('Original filename of the meme'),
	content_type: z.string().describe('MIME type of the meme file'),
	content_hash: z.string().nullish().describe('Hash of the file content for deduplication'),
	size: z.number().describe('File size in bytes'),
	width: z.number().int().nullish().describe('Width of the image or video in pixels'),
	height: z.number().int().nullish().describe('Height of the image or video in pixels'),
	duration: z.number().nullish().describe('Duration of the video in seconds'),
	url: z.string().describe('CDN URL to access the meme'),
	is_gifv: z.boolean().default(false).describe('Whether the meme is a video converted from GIF'),
	klipy_slug: z.string().nullish().describe('Klipy clip slug if the meme was sourced from Klipy'),
	tenor_slug_id: z.string().nullish().describe('Tenor view/<slug>-<id> identifier if the meme was sourced from Tenor'),
});

export type FavoriteMemeResponse = z.infer<typeof FavoriteMemeResponse>;

export const FavoriteMemeListResponse = z.array(FavoriteMemeResponse);
export type FavoriteMemeListResponse = z.infer<typeof FavoriteMemeListResponse>;
