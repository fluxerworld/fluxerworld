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

import {LocaleSchema} from '@fluxer/schema/src/primitives/LocaleSchema';
import {createStringType, Int32Type} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

const LocaleType = LocaleSchema.default('en-US').transform((v) => v.replace('-', '_'));

export const TenorSearchQuery = z.object({
	q: createStringType(1, 256).describe('The search query'),
	locale: LocaleType,
});

export type TenorSearchQuery = z.infer<typeof TenorSearchQuery>;

export const TenorLocaleQuery = z.object({
	locale: LocaleType,
});

export type TenorLocaleQuery = z.infer<typeof TenorLocaleQuery>;

export const TenorRegisterShareRequest = z.object({
	id: createStringType(1, 64).describe('The Tenor result id'),
	q: createStringType(0, 256).nullish().describe('The search query used to find the GIF'),
	locale: LocaleType,
});

export type TenorRegisterShareRequest = z.infer<typeof TenorRegisterShareRequest>;

export const TenorGifResponse = z.object({
	id: z.string().describe('The unique Tenor result id'),
	title: z.string().describe('The title/description of the GIF'),
	url: z.string().describe('The Tenor page URL for the GIF'),
	src: z.string().describe('Direct URL to the GIF media file'),
	proxy_src: z.string().describe('Proxied URL to the GIF media file'),
	width: Int32Type.describe('Width of the GIF in pixels'),
	height: Int32Type.describe('Height of the GIF in pixels'),
});

export type TenorGifResponse = z.infer<typeof TenorGifResponse>;

export const TenorCategoryTagResponse = z.object({
	name: z.string().describe('The category search term'),
	src: z.string().describe('URL to the category preview image'),
	proxy_src: z.string().describe('Proxied URL to the category preview image'),
});

export type TenorCategoryTagResponse = z.infer<typeof TenorCategoryTagResponse>;

export const TenorFeaturedResponse = z.object({
	gifs: z.array(TenorGifResponse).max(50).describe('Array of featured GIFs'),
	categories: z.array(TenorCategoryTagResponse).max(100).describe('Array of GIF categories'),
});

export type TenorFeaturedResponse = z.infer<typeof TenorFeaturedResponse>;
