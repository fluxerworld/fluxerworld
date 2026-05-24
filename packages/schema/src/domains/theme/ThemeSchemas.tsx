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

import {HexString16Type} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const ThemeCreateRequest = z.object({
	css: z.string().min(1).describe('CSS text to store and share'),
});

export type ThemeCreateRequest = z.infer<typeof ThemeCreateRequest>;

export const ThemeCreateResponse = z.object({
	id: HexString16Type.describe('The unique identifier for the created theme'),
});

export type ThemeCreateResponse = z.infer<typeof ThemeCreateResponse>;

export const ThemeGallerySubmitRequest = z.object({
	name: z.string().min(1).max(48),
	author: z.string().min(1).max(48),
	description: z.string().min(1).max(280),
	tags: z.array(z.string().max(24)).max(8).optional(),
	preview: z.array(z.string().regex(/^#[0-9a-fA-F]{3,8}$/)).max(8).optional(),
	css: z.string().min(1).max(64 * 1024),
});

export type ThemeGallerySubmitRequest = z.infer<typeof ThemeGallerySubmitRequest>;

export const ThemeGallerySubmitResponse = z.object({
	id: z.string().describe('Submission id for tracking review status'),
	status: z.literal('pending').describe('Always pending immediately after submission'),
});

export type ThemeGallerySubmitResponse = z.infer<typeof ThemeGallerySubmitResponse>;
