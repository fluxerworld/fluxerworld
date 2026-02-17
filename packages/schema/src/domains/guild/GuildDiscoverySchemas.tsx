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
	DISCOVERY_DESCRIPTION_MAX_LENGTH,
	DISCOVERY_DESCRIPTION_MIN_LENGTH,
} from '@fluxer/constants/src/DiscoveryConstants';
import {SnowflakeStringType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const DiscoveryApplicationRequest = z.object({
	description: z
		.string()
		.min(DISCOVERY_DESCRIPTION_MIN_LENGTH)
		.max(DISCOVERY_DESCRIPTION_MAX_LENGTH)
		.describe('Description for discovery listing'),
	category_type: z.number().int().min(0).max(8).describe('Discovery category type'),
});

export type DiscoveryApplicationRequest = z.infer<typeof DiscoveryApplicationRequest>;

export const DiscoveryApplicationPatchRequest = z.object({
	description: z
		.string()
		.min(DISCOVERY_DESCRIPTION_MIN_LENGTH)
		.max(DISCOVERY_DESCRIPTION_MAX_LENGTH)
		.optional()
		.describe('Updated description for discovery listing'),
	category_type: z.number().int().min(0).max(8).optional().describe('Updated discovery category type'),
});

export type DiscoveryApplicationPatchRequest = z.infer<typeof DiscoveryApplicationPatchRequest>;

export const DiscoverySearchQuery = z.object({
	query: z.string().max(100).optional().describe('Search query'),
	category: z.coerce.number().int().min(0).max(8).optional().describe('Filter by category'),
	sort_by: z.enum(['member_count', 'online_count', 'relevance']).optional().describe('Sort order'),
	limit: z.coerce.number().int().min(1).max(48).optional().default(24).describe('Number of results to return'),
	offset: z.coerce.number().int().min(0).optional().default(0).describe('Pagination offset'),
});

export type DiscoverySearchQuery = z.infer<typeof DiscoverySearchQuery>;

export const DiscoveryGuildResponse = z.object({
	id: SnowflakeStringType.describe('Guild ID'),
	name: z.string().describe('Guild name'),
	icon: z.string().nullish().describe('Guild icon hash'),
	description: z.string().nullish().describe('Discovery description'),
	category_type: z.number().describe('Discovery category type'),
	member_count: z.number().describe('Approximate member count'),
	online_count: z.number().describe('Approximate online member count'),
	features: z.array(z.string()).describe('Guild feature flags'),
	verification_level: z.number().describe('Verification level'),
});

export type DiscoveryGuildResponse = z.infer<typeof DiscoveryGuildResponse>;

export const DiscoveryGuildListResponse = z.object({
	guilds: z.array(DiscoveryGuildResponse).describe('Discovery guild results'),
	total: z.number().describe('Total number of matching guilds'),
});

export type DiscoveryGuildListResponse = z.infer<typeof DiscoveryGuildListResponse>;

export const DiscoveryApplicationResponse = z.object({
	guild_id: SnowflakeStringType.describe('Guild ID'),
	status: z.string().describe('Application status'),
	description: z.string().describe('Discovery description'),
	category_type: z.number().describe('Discovery category type'),
	applied_at: z.string().describe('Application timestamp'),
	reviewed_at: z.string().nullish().describe('Review timestamp'),
	review_reason: z.string().nullish().describe('Review reason'),
});

export type DiscoveryApplicationResponse = z.infer<typeof DiscoveryApplicationResponse>;

export const DiscoveryStatusResponse = z.object({
	application: DiscoveryApplicationResponse.nullish().describe('Current discovery application, if any'),
	eligible: z.boolean().describe('Whether the guild meets the requirements to apply for discovery'),
	min_member_count: z.number().describe('Minimum member count required for discovery eligibility'),
});

export type DiscoveryStatusResponse = z.infer<typeof DiscoveryStatusResponse>;

export const DiscoveryCategoryResponse = z.object({
	id: z.number().describe('Category ID'),
	name: z.string().describe('Category display name'),
});

export type DiscoveryCategoryResponse = z.infer<typeof DiscoveryCategoryResponse>;

export const DiscoveryCategoryListResponse = z.array(DiscoveryCategoryResponse);

export type DiscoveryCategoryListResponse = z.infer<typeof DiscoveryCategoryListResponse>;

export const DiscoveryAdminReviewRequest = z.object({
	reason: z.string().max(500).optional().describe('Review reason'),
});

export type DiscoveryAdminReviewRequest = z.infer<typeof DiscoveryAdminReviewRequest>;

export const DiscoveryAdminRejectRequest = z.object({
	reason: z.string().min(1).max(500).describe('Rejection reason'),
});

export type DiscoveryAdminRejectRequest = z.infer<typeof DiscoveryAdminRejectRequest>;

export const DiscoveryAdminRemoveRequest = z.object({
	reason: z.string().min(1).max(500).describe('Removal reason'),
});

export type DiscoveryAdminRemoveRequest = z.infer<typeof DiscoveryAdminRemoveRequest>;

export const DiscoveryAdminListQuery = z.object({
	status: z.enum(['pending', 'approved', 'rejected', 'removed']).optional().default('pending'),
	limit: z.coerce.number().int().min(1).max(100).optional().default(25),
	cursor: z.string().optional(),
});

export type DiscoveryAdminListQuery = z.infer<typeof DiscoveryAdminListQuery>;
