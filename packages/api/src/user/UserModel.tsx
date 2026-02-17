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

import {MAX_GUILDS_PREMIUM} from '@fluxer/constants/src/LimitConstants';
import {Locales} from '@fluxer/constants/src/Locales';
import {StatusTypes} from '@fluxer/constants/src/StatusConstants';
import {
	DEFAULT_GUILD_FOLDER_ICON,
	GuildFolderIcons,
	ThemeTypes,
	UserNotificationSettings,
} from '@fluxer/constants/src/UserConstants';
import type {ValueOf} from '@fluxer/constants/src/ValueOf';
import {CustomStatusPayload} from '@fluxer/schema/src/domains/user/UserRequestSchemas';
import {DateTimeType} from '@fluxer/schema/src/primitives/QueryValidators';
import {ColorType, createStringType, Int32Type, SnowflakeType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

const SettableStatusTypes = {
	ONLINE: StatusTypes.ONLINE,
	DND: StatusTypes.DND,
	IDLE: StatusTypes.IDLE,
	INVISIBLE: StatusTypes.INVISIBLE,
} as const;
const StatusTypeValues = Object.values(SettableStatusTypes) as Array<ValueOf<typeof SettableStatusTypes>>;
const ThemeTypeValues = Object.values(ThemeTypes) as Array<ValueOf<typeof ThemeTypes>>;
const LocaleValues = Object.values(Locales) as Array<ValueOf<typeof Locales>>;
const GuildFolderIconValues = Object.values(GuildFolderIcons) as Array<ValueOf<typeof GuildFolderIcons>>;

const StatusTypeSchema = z.enum(
	StatusTypeValues as [ValueOf<typeof SettableStatusTypes>, ...Array<ValueOf<typeof SettableStatusTypes>>],
);
const ThemeTypeSchema = z.enum(ThemeTypeValues as [ValueOf<typeof ThemeTypes>, ...Array<ValueOf<typeof ThemeTypes>>]);
const LocaleSchema = z.enum(LocaleValues as [ValueOf<typeof Locales>, ...Array<ValueOf<typeof Locales>>]);
const GuildFolderIconSchema = z.enum(
	GuildFolderIconValues as [ValueOf<typeof GuildFolderIcons>, ...Array<ValueOf<typeof GuildFolderIcons>>],
);
const MessageNotificationsType = z.union([
	z.literal(UserNotificationSettings.ALL_MESSAGES),
	z.literal(UserNotificationSettings.ONLY_MENTIONS),
	z.literal(UserNotificationSettings.NO_MESSAGES),
	z.literal(UserNotificationSettings.INHERIT),
]);
const MuteConfigType = z
	.object({
		end_time: DateTimeType.nullish().describe('When the mute expires'),
		selected_time_window: z.number().int().describe('Duration of mute in seconds'),
	})
	.nullish();
const ChannelOverrideType = z.object({
	collapsed: z.boolean().describe('Whether the channel is collapsed in the sidebar'),
	message_notifications: MessageNotificationsType.describe('Notification setting for this channel'),
	muted: z.boolean().describe('Whether notifications are muted for this channel'),
	mute_config: MuteConfigType.describe('Configuration for temporary mute'),
});

export const UserSettingsUpdateRequest = z
	.object({
		flags: z.number().int().describe('Bitfield of user settings flags'),
		status: StatusTypeSchema.describe('Current online status (online, idle, dnd, invisible)'),
		status_resets_at: DateTimeType.nullish().describe('When the status should reset'),
		status_resets_to: StatusTypeSchema.nullish().describe('Status to reset to after timer'),
		theme: ThemeTypeSchema.describe('UI theme preference (dark or light)'),
		guild_positions: z
			.array(SnowflakeType)
			.transform((ids) => [...new Set(ids)])
			.refine((ids) => ids.length <= MAX_GUILDS_PREMIUM, `Maximum ${MAX_GUILDS_PREMIUM} guilds allowed`)
			.describe('Ordered array of guild IDs for sidebar positioning'),
		locale: LocaleSchema.describe('User language/locale preference'),
		restricted_guilds: z
			.array(SnowflakeType)
			.transform((ids) => [...new Set(ids)])
			.refine((ids) => ids.length <= MAX_GUILDS_PREMIUM, `Maximum ${MAX_GUILDS_PREMIUM} guilds allowed`)
			.describe('Guild IDs where DMs from members are restricted'),
		bot_restricted_guilds: z
			.array(SnowflakeType)
			.transform((ids) => [...new Set(ids)])
			.refine((ids) => ids.length <= MAX_GUILDS_PREMIUM, `Maximum ${MAX_GUILDS_PREMIUM} guilds allowed`)
			.describe('Guild IDs where DMs from bots are restricted'),
		default_guilds_restricted: z.boolean().describe('Default DM restriction for new guilds'),
		bot_default_guilds_restricted: z.boolean().describe('Default bot DM restriction for new guilds'),
		inline_attachment_media: z.boolean().describe('Auto-display images and videos inline'),
		inline_embed_media: z.boolean().describe('Auto-display embedded media inline'),
		gif_auto_play: z.boolean().describe('Auto-play GIFs when visible'),
		render_embeds: z.boolean().describe('Show link embeds in messages'),
		render_reactions: z.boolean().describe('Show reactions on messages'),
		animate_emoji: z.boolean().describe('Animate custom emoji'),
		animate_stickers: z
			.number()
			.int()
			.min(0)
			.max(2)
			.describe('Sticker animation setting (0=never, 1=on hover, 2=always)'),
		render_spoilers: z
			.number()
			.int()
			.min(0)
			.max(2)
			.describe('Spoiler display setting (0=hidden, 1=on hover, 2=always)'),
		message_display_compact: z.boolean().describe('Use compact message display mode'),
		friend_source_flags: Int32Type.describe('Bitfield for friend request source permissions'),
		incoming_call_flags: Int32Type.describe('Bitfield for incoming call permissions'),
		group_dm_add_permission_flags: Int32Type.describe('Bitfield for group DM add permissions'),
		guild_folders: z
			.array(
				z.object({
					id: z.number().int().min(-1).describe('Unique folder identifier (-1 for uncategorized)'),
					name: createStringType(0, 32).nullish().describe('Folder display name'),
					color: ColorType.nullish().default(0x000000).describe('Folder color as integer'),
					flags: Int32Type.default(0).describe('Bitfield for guild folder display behaviour'),
					icon: GuildFolderIconSchema.default(DEFAULT_GUILD_FOLDER_ICON).describe('Selected icon for the guild folder'),
					guild_ids: z
						.array(SnowflakeType)
						.transform((ids) => [...new Set(ids)])
						.refine((ids) => ids.length <= MAX_GUILDS_PREMIUM, `Maximum ${MAX_GUILDS_PREMIUM} guilds allowed`)
						.describe('Guild IDs contained in this folder'),
				}),
			)
			.max(100)
			.describe('Array of guild folder configurations'),
		custom_status: CustomStatusPayload.nullish().describe('Custom status with text and emoji'),
		afk_timeout: z.number().int().min(60).max(600).describe('AFK timeout in seconds (60-600)'),
		time_format: z.number().int().min(0).max(2).describe('Time format preference (0=12h, 1=24h, 2=relative)'),
		developer_mode: z.boolean().describe('Enable developer mode features'),
	})
	.partial();

export const UserGuildSettingsUpdateRequest = z
	.object({
		message_notifications: MessageNotificationsType.describe('Default notification level for the guild'),
		muted: z.boolean().describe('Whether the guild is muted'),
		mute_config: MuteConfigType.describe('Configuration for temporary mute'),
		mobile_push: z.boolean().describe('Whether to send mobile push notifications'),
		suppress_everyone: z.boolean().describe('Suppress @everyone and @here mentions'),
		suppress_roles: z.boolean().describe('Suppress role mentions'),
		hide_muted_channels: z.boolean().describe('Hide muted channels from sidebar'),
		channel_overrides: z
			.record(
				SnowflakeType.transform((value) => value.toString()),
				ChannelOverrideType,
			)
			.nullish()
			.describe('Per-channel notification settings overrides'),
	})
	.partial();
