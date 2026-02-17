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

export const KlipySearchQuery = z.object({
	q: createStringType(1, 256).describe('The search query'),
	locale: LocaleType,
});

export type KlipySearchQuery = z.infer<typeof KlipySearchQuery>;

export const KlipyLocaleQuery = z.object({
	locale: LocaleType,
});

export type KlipyLocaleQuery = z.infer<typeof KlipyLocaleQuery>;

export const KlipyRegisterShareRequest = z.object({
	id: createStringType(1, 64).describe('The Klipy clip slug'),
	q: createStringType(0, 256).nullish().describe('The search query used to find the clip'),
	locale: LocaleType,
});

export type KlipyRegisterShareRequest = z.infer<typeof KlipyRegisterShareRequest>;

export const KlipyGifResponse = z.object({
	id: z.string().describe('The unique Klipy clip slug'),
	title: z.string().describe('The title/description of the clip'),
	url: z.string().describe('The Klipy page URL for the clip'),
	src: z.string().describe('Direct URL to the clip media file'),
	proxy_src: z.string().describe('Proxied URL to the clip media file'),
	width: Int32Type.describe('Width of the clip in pixels'),
	height: Int32Type.describe('Height of the clip in pixels'),
});

export type KlipyGifResponse = z.infer<typeof KlipyGifResponse>;

export const KlipyCategoryTagResponse = z.object({
	name: z.string().describe('The category/tag name'),
	src: z.string().describe('URL to the category preview image'),
	proxy_src: z.string().describe('Proxied URL to the category preview image'),
});

export type KlipyCategoryTagResponse = z.infer<typeof KlipyCategoryTagResponse>;

export const KlipyFeaturedResponse = z.object({
	gifs: z.array(KlipyGifResponse).max(50).describe('Array of featured/trending clips'),
	categories: z.array(KlipyCategoryTagResponse).max(100).describe('Array of clip categories'),
});

export type KlipyFeaturedResponse = z.infer<typeof KlipyFeaturedResponse>;
