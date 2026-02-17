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

import {GuildOperations, GuildOperationsDescriptions} from '@fluxer/constants/src/GuildConstants';
import {GuildBanCreateRequest} from '@fluxer/schema/src/domains/guild/GuildRequestSchemas';
import {GuildFeatureSchema} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import {VanityURLCodeType} from '@fluxer/schema/src/primitives/ChannelValidators';
import {
	DefaultMessageNotificationsSchema,
	GuildExplicitContentFilterSchema,
	GuildMFALevelSchema,
	GuildVerificationLevelSchema,
	NSFWLevelSchema,
} from '@fluxer/schema/src/primitives/GuildValidators';
import {
	createBitflagInt32Type,
	createNamedStringLiteralUnion,
	createStringType,
	Int32Type,
	SnowflakeStringType,
	SnowflakeType,
	withFieldDescription,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const GuildAdminResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier for this guild'),
	name: z.string().describe('The name of the guild'),
	features: z.array(GuildFeatureSchema).max(100).describe('Array of guild feature flags'),
	owner_id: SnowflakeStringType.describe('The ID of the guild owner'),
	icon: z.string().nullable().describe('The hash of the guild icon'),
	banner: z.string().nullable().describe('The hash of the guild banner'),
	member_count: Int32Type.describe('The number of members in the guild'),
});

export type GuildAdminResponse = z.infer<typeof GuildAdminResponse>;

export const ListUserGuildsResponse = z.object({
	guilds: z.array(GuildAdminResponse).max(200),
});

export type ListUserGuildsResponse = z.infer<typeof ListUserGuildsResponse>;

export const ListUserGuildsRequest = z.object({
	user_id: SnowflakeType,
	before: SnowflakeType.optional(),
	after: SnowflakeType.optional(),
	limit: z.number().int().min(1).max(200).default(200),
	with_counts: z.boolean().default(false),
});

export type ListUserGuildsRequest = z.infer<typeof ListUserGuildsRequest>;

export const LookupGuildRequest = z.object({
	guild_id: SnowflakeType,
});

export type LookupGuildRequest = z.infer<typeof LookupGuildRequest>;

export const ListGuildMembersRequest = z.object({
	guild_id: SnowflakeType,
	limit: z.number().int().min(1).max(200).default(50),
	offset: z.number().int().min(0).default(0),
});

export type ListGuildMembersRequest = z.infer<typeof ListGuildMembersRequest>;

export const BanGuildMemberRequest = GuildBanCreateRequest.extend({
	guild_id: SnowflakeType,
	user_id: SnowflakeType,
});

export type BanGuildMemberRequest = z.infer<typeof BanGuildMemberRequest>;

export const KickGuildMemberRequest = z.object({
	guild_id: SnowflakeType,
	user_id: SnowflakeType,
});

export type KickGuildMemberRequest = z.infer<typeof KickGuildMemberRequest>;

export const SearchGuildsRequest = z.object({
	query: createStringType(1, 1024).optional(),
	limit: z.number().int().min(1).max(200).default(50),
	offset: z.number().int().min(0).default(0),
});

export type SearchGuildsRequest = z.infer<typeof SearchGuildsRequest>;

export const ReloadGuildRequest = z.object({
	guild_id: SnowflakeType,
});

export type ReloadGuildRequest = z.infer<typeof ReloadGuildRequest>;

export const ShutdownGuildRequest = z.object({
	guild_id: SnowflakeType,
});

export type ShutdownGuildRequest = z.infer<typeof ShutdownGuildRequest>;

export const GetProcessMemoryStatsRequest = z.object({
	limit: z.number().int().min(1).max(100).default(25),
});

export type GetProcessMemoryStatsRequest = z.infer<typeof GetProcessMemoryStatsRequest>;

export const UpdateGuildFeaturesRequest = z.object({
	guild_id: SnowflakeType.describe('ID of the guild to update'),
	add_features: z.array(GuildFeatureSchema).max(100).default([]).describe('Guild features to add'),
	remove_features: z.array(GuildFeatureSchema).max(100).default([]).describe('Guild features to remove'),
});

export type UpdateGuildFeaturesRequest = z.infer<typeof UpdateGuildFeaturesRequest>;

export const ForceAddUserToGuildRequest = z.object({
	user_id: SnowflakeType.describe('ID of the user to add to the guild'),
	guild_id: SnowflakeType.describe('ID of the guild to add the user to'),
});
export type ForceAddUserToGuildRequest = z.infer<typeof ForceAddUserToGuildRequest>;

const GuildImageFieldEnum = createNamedStringLiteralUnion(
	[
		['icon', 'icon', 'Guild icon image'],
		['banner', 'banner', 'Guild banner image'],
		['splash', 'splash', 'Guild invite splash image'],
		['embed_splash', 'embed_splash', 'Guild embedded invite splash image'],
	],
	'Guild image field that can be cleared',
);

export const ClearGuildFieldsRequest = z.object({
	guild_id: SnowflakeType.describe('ID of the guild to clear fields for'),
	fields: z.array(GuildImageFieldEnum).max(10).describe('List of guild image fields to clear'),
});

export type ClearGuildFieldsRequest = z.infer<typeof ClearGuildFieldsRequest>;

export const DeleteGuildRequest = z.object({
	guild_id: SnowflakeType.describe('ID of the guild to delete'),
});

export type DeleteGuildRequest = z.infer<typeof DeleteGuildRequest>;

export const UpdateGuildVanityRequest = z.object({
	guild_id: SnowflakeType.describe('ID of the guild to update'),
	vanity_url_code: VanityURLCodeType.nullable().describe('New vanity URL code, or null to remove'),
});

export type UpdateGuildVanityRequest = z.infer<typeof UpdateGuildVanityRequest>;

export const UpdateGuildNameRequest = z.object({
	guild_id: SnowflakeType.describe('ID of the guild to update'),
	name: createStringType(1, 100).describe('New name for the guild'),
});

export type UpdateGuildNameRequest = z.infer<typeof UpdateGuildNameRequest>;

export const UpdateGuildSettingsRequest = z.object({
	guild_id: SnowflakeType.describe('ID of the guild to update'),
	verification_level: withFieldDescription(
		GuildVerificationLevelSchema,
		'Required verification level for guild members',
	).optional(),
	mfa_level: withFieldDescription(GuildMFALevelSchema, 'Required MFA level for moderators').optional(),
	nsfw_level: withFieldDescription(NSFWLevelSchema, 'NSFW content level for the guild').optional(),
	explicit_content_filter: withFieldDescription(
		GuildExplicitContentFilterSchema,
		'Explicit content filter level',
	).optional(),
	default_message_notifications: withFieldDescription(
		DefaultMessageNotificationsSchema,
		'Default notification setting for new members',
	).optional(),
	disabled_operations: createBitflagInt32Type(
		GuildOperations,
		GuildOperationsDescriptions,
		'Bitmask of disabled guild operations',
		'GuildOperations',
	).optional(),
});

export type UpdateGuildSettingsRequest = z.infer<typeof UpdateGuildSettingsRequest>;

export const TransferGuildOwnershipRequest = z.object({
	guild_id: SnowflakeType.describe('ID of the guild to transfer'),
	new_owner_id: SnowflakeType.describe('ID of the user to transfer ownership to'),
});

export type TransferGuildOwnershipRequest = z.infer<typeof TransferGuildOwnershipRequest>;

export const BulkUpdateGuildFeaturesRequest = z.object({
	guild_ids: z.array(SnowflakeType).max(1000).describe('List of guild IDs to update'),
	add_features: z
		.array(GuildFeatureSchema)
		.max(100)
		.default([])
		.describe('Guild features to add to all specified guilds'),
	remove_features: z
		.array(GuildFeatureSchema)
		.max(100)
		.default([])
		.describe('Guild features to remove from all specified guilds'),
});

export type BulkUpdateGuildFeaturesRequest = z.infer<typeof BulkUpdateGuildFeaturesRequest>;

export const BulkAddGuildMembersRequest = z.object({
	guild_id: SnowflakeType.describe('ID of the guild to add members to'),
	user_ids: z.array(SnowflakeType).max(1000).describe('List of user IDs to add as members'),
});

export type BulkAddGuildMembersRequest = z.infer<typeof BulkAddGuildMembersRequest>;
