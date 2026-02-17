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
	GuildMemberProfileFlags,
	GuildMemberProfileFlagsDescriptions,
	SystemChannelFlags,
	SystemChannelFlagsDescriptions,
} from '@fluxer/constants/src/GuildConstants';
import {
	AVATAR_MAX_SIZE,
	EMOJI_MAX_SIZE,
	STICKER_MAX_SIZE,
	VALID_TEMP_BAN_DURATIONS,
} from '@fluxer/constants/src/LimitConstants';
import {SudoVerificationSchema} from '@fluxer/schema/src/domains/auth/AuthSchemas';
import {VanityURLCodeType} from '@fluxer/schema/src/primitives/ChannelValidators';
import {createBase64StringType} from '@fluxer/schema/src/primitives/FileValidators';
import {
	DefaultMessageNotificationsSchema,
	GuildExplicitContentFilterSchema,
	GuildMFALevelSchema,
	GuildVerificationLevelSchema,
	NSFWLevelSchema,
	SplashCardAlignmentSchema,
} from '@fluxer/schema/src/primitives/GuildValidators';
import {QueryBooleanType} from '@fluxer/schema/src/primitives/QueryValidators';
import {
	ColorType,
	createBitflagInt32Type,
	createStringType,
	SnowflakeType,
	UnsignedInt64Type,
	withFieldDescription,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {PasswordType} from '@fluxer/schema/src/primitives/UserValidators';
import {z} from 'zod';

export const GuildCreateRequest = z.object({
	name: createStringType(1, 100).describe('The name of the guild (1-100 characters)'),
	icon: createBase64StringType(1, Math.ceil(AVATAR_MAX_SIZE * (4 / 3)))
		.nullish()
		.describe('Base64-encoded image data for the guild icon'),
	empty_features: z.boolean().optional().describe('Whether to create the guild without default features'),
});

export type GuildCreateRequest = z.infer<typeof GuildCreateRequest>;

export const GuildUpdateRequest = z
	.object({
		name: createStringType(1, 100).describe('The name of the guild (1-100 characters)'),
		icon: createBase64StringType(1, Math.ceil(AVATAR_MAX_SIZE * (4 / 3)))
			.nullish()
			.describe('Base64-encoded image data for the guild icon'),
		system_channel_id: SnowflakeType.nullish().describe('The ID of the channel where system messages are sent'),
		system_channel_flags: createBitflagInt32Type(
			SystemChannelFlags,
			SystemChannelFlagsDescriptions,
			'Bitfield of system channel flags controlling which messages are suppressed',
			'SystemChannelFlags',
		),
		afk_channel_id: SnowflakeType.nullish().describe('The ID of the AFK voice channel'),
		afk_timeout: z
			.number()
			.int()
			.min(60)
			.max(3600)
			.describe('AFK timeout in seconds (60-3600) before moving users to the AFK channel'),
		default_message_notifications: withFieldDescription(
			DefaultMessageNotificationsSchema,
			'Default notification level for new members',
		),
		verification_level: withFieldDescription(
			GuildVerificationLevelSchema,
			'Required verification level for members to participate',
		),
		mfa_level: withFieldDescription(GuildMFALevelSchema, 'Required MFA level for moderation actions'),
		nsfw_level: withFieldDescription(NSFWLevelSchema, 'The NSFW level of the guild'),
		explicit_content_filter: withFieldDescription(
			GuildExplicitContentFilterSchema,
			'Level of content filtering for explicit media',
		),
		banner: createBase64StringType(1, Math.ceil(AVATAR_MAX_SIZE * (4 / 3)))
			.nullish()
			.describe('Base64-encoded image data for the guild banner'),
		splash: createBase64StringType(1, Math.ceil(AVATAR_MAX_SIZE * (4 / 3)))
			.nullish()
			.describe('Base64-encoded image data for the guild splash screen'),
		embed_splash: createBase64StringType(1, Math.ceil(AVATAR_MAX_SIZE * (4 / 3)))
			.nullish()
			.describe('Base64-encoded image data for the embedded invite splash'),
		splash_card_alignment: SplashCardAlignmentSchema.optional().describe(
			'Alignment of the splash card (center, left, or right)',
		),
		features: z.array(z.string()).describe('Array of guild feature strings'),
		message_history_cutoff: z.iso
			.datetime()
			.nullish()
			.describe(
				'ISO8601 timestamp controlling how far back members without Read Message History can access messages. Set to null to disable historical access.',
			),
	})
	.partial()
	.merge(SudoVerificationSchema);

export type GuildUpdateRequest = z.infer<typeof GuildUpdateRequest>;

export const GuildMemberUpdateRequest = z.object({
	nick: createStringType(1, 32).nullish().describe('The nickname to set for the member (1-32 characters)'),
	roles: z
		.array(SnowflakeType)
		.max(100, 'Maximum 100 roles allowed')
		.optional()
		.transform((ids) => (ids ? new Set(ids) : undefined))
		.describe('Array of role IDs to assign to the member (max 100)'),
	avatar: createBase64StringType(1, Math.ceil(AVATAR_MAX_SIZE * (4 / 3)))
		.nullish()
		.describe('Base64-encoded image data for the member guild avatar'),
	banner: createBase64StringType(1, Math.ceil(AVATAR_MAX_SIZE * (4 / 3)))
		.nullish()
		.describe('Base64-encoded image data for the member guild banner'),
	bio: createStringType(1, 320).nullish().describe('The member guild profile bio (1-320 characters)'),
	pronouns: createStringType(1, 40).nullish().describe('The member guild profile pronouns (1-40 characters)'),
	accent_color: ColorType.nullish().describe('The accent color for the member guild profile as an integer'),
	profile_flags: createBitflagInt32Type(
		GuildMemberProfileFlags,
		GuildMemberProfileFlagsDescriptions,
		'Bitfield of profile flags for the member',
		'GuildMemberProfileFlags',
	).nullish(),
	mute: z.boolean().optional().describe('Whether the member is muted in voice channels'),
	deaf: z.boolean().optional().describe('Whether the member is deafened in voice channels'),
	communication_disabled_until: z.iso
		.datetime()
		.nullish()
		.describe('ISO8601 timestamp until which the member is timed out'),
	timeout_reason: createStringType(1, 512)
		.nullish()
		.describe('The reason for timing out the member (1-512 characters)'),
	channel_id: SnowflakeType.nullish().describe('The voice channel ID to move the member to'),
	connection_id: createStringType(1, 32).nullish().describe('The voice connection ID for the member'),
});

export type GuildMemberUpdateRequest = z.infer<typeof GuildMemberUpdateRequest>;

export const MyGuildMemberUpdateRequest = GuildMemberUpdateRequest.omit({roles: true}).partial();

export type MyGuildMemberUpdateRequest = z.infer<typeof MyGuildMemberUpdateRequest>;

export const GuildRoleCreateRequest = z.object({
	name: createStringType(1, 100).describe('The name of the role (1-100 characters)'),
	color: ColorType.default(0x000000).describe('The color of the role as an integer (default: 0)'),
	permissions: UnsignedInt64Type.optional().describe('fluxer:UnsignedInt64Type The permissions bitfield for the role'),
});

export type GuildRoleCreateRequest = z.infer<typeof GuildRoleCreateRequest>;

export const GuildRoleUpdateRequest = z.object({
	name: createStringType(1, 100).optional().describe('The name of the role (1-100 characters)'),
	color: ColorType.optional().describe('The color of the role as an integer'),
	permissions: UnsignedInt64Type.optional().describe('fluxer:UnsignedInt64Type The permissions bitfield for the role'),
	hoist: z.boolean().optional().describe('Whether the role should be displayed separately in the member list'),
	hoist_position: z.number().int().nullish().describe('The position of the role in the hoisted member list'),
	mentionable: z.boolean().optional().describe('Whether the role can be mentioned by anyone'),
});

export type GuildRoleUpdateRequest = z.infer<typeof GuildRoleUpdateRequest>;

export const GuildEmojiCreateRequest = z.object({
	name: createStringType(2, 32)
		.refine((value) => /^[a-zA-Z0-9_]+$/.test(value), 'Emoji name can only contain letters, numbers, and underscores')
		.describe('The name of the emoji (2-32 characters, alphanumeric and underscores only)'),
	image: createBase64StringType(1, Math.ceil(EMOJI_MAX_SIZE * (4 / 3))).describe(
		'Base64-encoded image data for the emoji',
	),
});

export type GuildEmojiCreateRequest = z.infer<typeof GuildEmojiCreateRequest>;

export const GuildEmojiUpdateRequest = GuildEmojiCreateRequest.pick({name: true});

export type GuildEmojiUpdateRequest = z.infer<typeof GuildEmojiUpdateRequest>;

export const GuildEmojiBulkCreateRequest = z.object({
	emojis: z
		.array(GuildEmojiCreateRequest)
		.min(1, 'At least one emoji is required')
		.max(50, 'Maximum 50 emojis per batch')
		.describe('Array of emoji objects to create (1-50 emojis per batch)'),
});

export type GuildEmojiBulkCreateRequest = z.infer<typeof GuildEmojiBulkCreateRequest>;

export const GuildStickerCreateRequest = z.object({
	name: createStringType(2, 30).describe('The name of the sticker (2-30 characters)'),
	description: createStringType(1, 500).nullish().describe('Description of the sticker (1-500 characters)'),
	tags: z
		.array(createStringType(1, 30))
		.min(0)
		.max(10)
		.optional()
		.default([])
		.describe('Array of autocomplete/suggestion tags (max 10 tags, each 1-30 characters)'),
	image: createBase64StringType(1, Math.ceil(STICKER_MAX_SIZE * (4 / 3))).describe(
		'Base64-encoded image data for the sticker',
	),
});

export type GuildStickerCreateRequest = z.infer<typeof GuildStickerCreateRequest>;

export const GuildStickerUpdateRequest = GuildStickerCreateRequest.pick({
	name: true,
	description: true,
	tags: true,
});

export type GuildStickerUpdateRequest = z.infer<typeof GuildStickerUpdateRequest>;

export const GuildStickerBulkCreateRequest = z.object({
	stickers: z
		.array(GuildStickerCreateRequest)
		.min(1, 'At least one sticker is required')
		.max(50, 'Maximum 50 stickers per batch')
		.describe('Array of sticker objects to create (1-50 stickers per batch)'),
});

export type GuildStickerBulkCreateRequest = z.infer<typeof GuildStickerBulkCreateRequest>;

export const GuildTransferOwnershipRequest = z.object({
	new_owner_id: SnowflakeType.describe('The ID of the user to transfer ownership to'),
	password: PasswordType.optional().describe('The current owner password for verification'),
});

export type GuildTransferOwnershipRequest = z.infer<typeof GuildTransferOwnershipRequest>;

export const GuildBanCreateRequest = z.object({
	delete_message_days: z
		.number()
		.int()
		.min(0)
		.max(7)
		.default(0)
		.describe('Number of days of messages to delete from the banned user (0-7)'),
	reason: createStringType(0, 512).nullish().describe('The reason for the ban (max 512 characters)'),
	ban_duration_seconds: z
		.number()
		.int()
		.refine((val) => val === 0 || VALID_TEMP_BAN_DURATIONS.has(val), {
			message: `Ban duration must be 0 (permanent) or one of the valid durations: ${Array.from(VALID_TEMP_BAN_DURATIONS).join(', ')} seconds`,
		})
		.optional()
		.describe('Duration of the ban in seconds (0 for permanent, or a valid temporary duration)'),
});

export type GuildBanCreateRequest = z.infer<typeof GuildBanCreateRequest>;

export const GuildListQuery = z.object({
	before: SnowflakeType.optional().describe('Get guilds before this guild ID'),
	after: SnowflakeType.optional().describe('Get guilds after this guild ID'),
	limit: z.coerce.number().int().min(1).max(200).default(200).describe('Maximum number of guilds to return (1-200)'),
	with_counts: QueryBooleanType.describe('Include approximate member and presence counts'),
});

export type GuildListQuery = z.infer<typeof GuildListQuery>;

export const GuildDeleteRequest = z
	.object({
		password: PasswordType.optional().describe('The owner password for verification'),
	})
	.merge(SudoVerificationSchema);

export type GuildDeleteRequest = z.infer<typeof GuildDeleteRequest>;

export const GuildVanityURLUpdateRequest = z.object({
	code: VanityURLCodeType.nullish().describe('The new vanity URL code (2-32 characters, alphanumeric and hyphens)'),
});

export type GuildVanityURLUpdateRequest = z.infer<typeof GuildVanityURLUpdateRequest>;

export const GuildVanityURLUpdateResponse = z.object({
	code: createStringType(2, 32).describe('The new vanity URL code'),
});

export type GuildVanityURLUpdateResponse = z.infer<typeof GuildVanityURLUpdateResponse>;

export const GuildRoleHoistPositionItem = z.object({
	id: SnowflakeType.describe('The ID of the role'),
	hoist_position: z.number().int().describe('The new hoist position for the role'),
});

export type GuildRoleHoistPositionItem = z.infer<typeof GuildRoleHoistPositionItem>;

export const GuildRoleHoistPositionsRequest = z.array(GuildRoleHoistPositionItem);

export type GuildRoleHoistPositionsRequest = z.infer<typeof GuildRoleHoistPositionsRequest>;

export const GuildRolePositionItem = z.object({
	id: SnowflakeType.describe('The ID of the role'),
	position: z.number().int().optional().describe('The new position for the role'),
});

export type GuildRolePositionItem = z.infer<typeof GuildRolePositionItem>;

export const GuildRolePositionsRequest = z.array(GuildRolePositionItem);

export type GuildRolePositionsRequest = z.infer<typeof GuildRolePositionsRequest>;

export const GuildMemberListQuery = z.object({
	limit: z.coerce
		.number()
		.int()
		.min(1)
		.max(1000)
		.default(1)
		.describe('Maximum number of members to return (1-1000, default 1)'),
	after: SnowflakeType.optional().describe('Get members after this user ID for pagination'),
});

export type GuildMemberListQuery = z.infer<typeof GuildMemberListQuery>;
