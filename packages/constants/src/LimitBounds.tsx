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

import type {LimitKey} from '@fluxer/constants/src/LimitConfigMetadata';
import {MAX_GUILD_MEMBERS_VERY_LARGE_GUILD} from '@fluxer/constants/src/LimitConstants';

export const LIMIT_KEY_BOUNDS: Record<LimitKey, {min: number; max: number}> = {
	avatar_max_size: {min: 1024, max: 10_485_760},
	emoji_max_size: {min: 1024, max: 393_216},
	feature_animated_avatar: {min: 0, max: 1},
	feature_animated_banner: {min: 0, max: 1},
	feature_custom_discriminator: {min: 0, max: 1},
	feature_custom_notification_sounds: {min: 0, max: 1},
	feature_early_access: {min: 0, max: 1},
	feature_global_expressions: {min: 0, max: 1},
	feature_higher_video_quality: {min: 0, max: 1},
	feature_per_guild_profiles: {min: 0, max: 1},
	feature_voice_entrance_sounds: {min: 0, max: 1},
	max_attachment_file_size: {min: 0, max: 500 * 1024 * 1024},
	max_attachments_per_message: {min: 1, max: 10},
	max_bio_length: {min: 1, max: 320},
	max_bookmarks: {min: 0, max: 300},
	max_channels_per_category: {min: 1, max: 50},
	max_created_packs: {min: 0, max: 50},
	max_custom_backgrounds: {min: 0, max: 15},
	max_embeds_per_message: {min: 0, max: 10},
	max_favorite_meme_tags: {min: 1, max: 10},
	max_favorite_memes: {min: 0, max: 500},
	max_group_dm_recipients: {min: 2, max: 25},
	max_group_dms_per_user: {min: 0, max: 150},
	max_guild_channels: {min: 1, max: 500},
	max_guild_emojis_animated_more: {min: 0, max: 250},
	max_guild_emojis_animated: {min: 0, max: 50},
	max_guild_emojis_static_more: {min: 0, max: 250},
	max_guild_emojis_static: {min: 0, max: 50},
	max_guild_invites: {min: 0, max: 1000},
	max_guild_members: {min: 1, max: MAX_GUILD_MEMBERS_VERY_LARGE_GUILD},
	max_guild_roles: {min: 1, max: 250},
	max_guild_stickers_more: {min: 0, max: 250},
	max_guild_stickers: {min: 0, max: 50},
	max_guilds: {min: 1, max: 200},
	max_installed_packs: {min: 0, max: 50},
	max_message_length: {min: 1, max: 4000},
	max_pack_expressions: {min: 1, max: 200},
	max_private_channels_per_user: {min: 1, max: 250},
	max_reactions_per_message: {min: 0, max: 30},
	max_relationships: {min: 0, max: 1000},
	max_users_per_message_reaction: {min: 1, max: 5000},
	max_voice_message_duration: {min: 1, max: 1200},
	max_webhooks_per_channel: {min: 0, max: 15},
	max_webhooks_per_guild: {min: 0, max: 1000},
	sticker_max_size: {min: 1024, max: 524_288},
};
