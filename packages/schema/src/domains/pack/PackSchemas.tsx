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
	createNamedStringLiteralUnion,
	createStringType,
	Int32Type,
	SnowflakeStringType,
	withOpenApiType,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const PackType = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['emoji', 'EMOJI', 'A pack containing custom emoji'],
			['sticker', 'STICKER', 'A pack containing custom stickers'],
		],
		'The type of expression pack',
	),
	'PackType',
);

export const PackTypeParam = z.object({
	pack_type: PackType.describe('The type of expression pack (emoji or sticker)'),
});

export type PackTypeParam = z.infer<typeof PackTypeParam>;

export const PackCreateRequest = z.object({
	name: createStringType(1, 64).describe('The name of the pack'),
	description: createStringType(1, 256).nullish().describe('The description of the pack'),
});

export type PackCreateRequest = z.infer<typeof PackCreateRequest>;

export const PackUpdateRequest = z.object({
	name: createStringType(1, 64).optional().describe('The new name of the pack'),
	description: createStringType(1, 256).nullish().optional().describe('The new description of the pack'),
});

export type PackUpdateRequest = z.infer<typeof PackUpdateRequest>;

export type PackType = z.infer<typeof PackType>;

export const PackSummaryResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier (snowflake) for the pack'),
	name: z.string().describe('The display name of the pack'),
	description: z.string().nullable().describe('The description of the pack'),
	type: PackType.describe('The type of expression pack (emoji or sticker)'),
	creator_id: SnowflakeStringType.describe('The ID of the user who created the pack'),
	created_at: z.iso.datetime().describe('ISO8601 timestamp of when the pack was created'),
	updated_at: z.iso.datetime().describe('ISO8601 timestamp of when the pack was last updated'),
	installed_at: z.iso.datetime().optional().describe('ISO8601 timestamp of when the pack was installed by the user'),
});

export type PackSummaryResponse = z.infer<typeof PackSummaryResponse>;

export const PackDashboardSectionResponse = z.object({
	installed_limit: Int32Type.describe('Maximum number of packs the user can install'),
	created_limit: Int32Type.describe('Maximum number of packs the user can create'),
	installed: z.array(PackSummaryResponse).max(100).describe('List of packs the user has installed'),
	created: z.array(PackSummaryResponse).max(100).describe('List of packs the user has created'),
});

export type PackDashboardSectionResponse = z.infer<typeof PackDashboardSectionResponse>;

export const PackDashboardResponse = z.object({
	emoji: PackDashboardSectionResponse.describe('Dashboard section for emoji packs'),
	sticker: PackDashboardSectionResponse.describe('Dashboard section for sticker packs'),
});

export type PackDashboardResponse = z.infer<typeof PackDashboardResponse>;
