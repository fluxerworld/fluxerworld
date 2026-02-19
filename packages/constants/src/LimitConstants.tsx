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

export const MAX_GUILDS_PREMIUM = 200;
export const MAX_GUILDS_NON_PREMIUM = 100;
export const MAX_GUILD_CHANNELS = 500;
export const MAX_CHANNELS_PER_CATEGORY = 50;
export const VOICE_CHANNEL_BITRATE_MIN = 8000;
export const VOICE_CHANNEL_BITRATE_MAX = 320000;
export const VOICE_CHANNEL_USER_LIMIT_MIN = 0;
export const VOICE_CHANNEL_USER_LIMIT_MAX = 99;
export const VOICE_CHANNEL_CAMERA_USER_LIMIT = 25;
export const CHANNEL_RATE_LIMIT_PER_USER_MIN = 0;
export const CHANNEL_RATE_LIMIT_PER_USER_MAX = 21600;
export const CHANNEL_TOPIC_MIN_LENGTH = 1;
export const CHANNEL_TOPIC_MAX_LENGTH = 1024;
export const RTC_REGION_ID_MIN_LENGTH = 1;
export const RTC_REGION_ID_MAX_LENGTH = 64;
export const MAX_CHANNEL_PERMISSION_OVERWRITES = 500;
export const MAX_DM_RECIPIENTS = 10;
export const MAX_GUILD_EMOJIS_ANIMATED = 50;
export const MAX_GUILD_EMOJIS_STATIC = 50;
export const MAX_GUILD_EMOJIS_ANIMATED_MORE_EMOJI = 250;
export const MAX_GUILD_EMOJIS_STATIC_MORE_EMOJI = 250;
export const MAX_GUILD_STICKERS = 50;
export const MAX_GUILD_STICKERS_MORE_STICKERS = 250;
export const MAX_GUILD_EXPRESSION_SLOTS_UNLIMITED = 999_999;
export const MAX_GUILD_INVITES = 1000;
export const MAX_GUILD_MEMBERS = 1_000_000;
export const MAX_GUILD_MEMBERS_VERY_LARGE_GUILD = 10_000_000;
export const MAX_INVITE_USES = 100;
export const MAX_INVITE_AGE_SECONDS = 604800;
export const MAX_GUILD_ROLES = 250;
export const MAX_WEBHOOKS_PER_CHANNEL = 15;
export const MAX_WEBHOOKS_PER_GUILD = 1000;

export const MAX_MESSAGE_LENGTH_PREMIUM = 4000;
export const MAX_MESSAGE_LENGTH_NON_PREMIUM = 2000;
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;
export const MAX_EMBEDS_PER_MESSAGE = 10;
export const MAX_REACTIONS_PER_MESSAGE = 30;
export const MAX_USERS_PER_MESSAGE_REACTION = 5000;
export const MAX_READ_STATES_BULK_ACK = 100;
export const MIN_READ_STATES_BULK_ACK = 1;
export const MAX_ATTACHMENT_ALT_TEXT_LENGTH = 4096;

export const MAX_BIO_LENGTH = 320;
export const AVATAR_MAX_SIZE = 10 * 1024 * 1024;
export const AVATAR_EXTENSIONS = new Set(['jpeg', 'png', 'apng', 'webp', 'gif', 'avif']);

export const MAX_RELATIONSHIPS = 1000;
export const MAX_GROUP_DM_RECIPIENTS = 25;
export const MAX_PRIVATE_CHANNELS_PER_USER = 250;
export const MAX_PRIVATE_CHANNELS_PER_USER_ALTERNATE = 200;
export const MAX_GROUP_DMS_PER_USER = 150;

export const MAX_BOOKMARKS_PREMIUM = 300;
export const MAX_BOOKMARKS_NON_PREMIUM = 50;
export const MAX_FAVORITE_MEMES_PREMIUM = 500;
export const MAX_FAVORITE_MEMES_NON_PREMIUM = 50;
export const MAX_FAVORITE_MEME_TAGS = 10;

export const MAX_PACK_EXPRESSIONS = 200;
export const MAX_CREATED_PACKS_NON_PREMIUM = 0;
export const MAX_CREATED_PACKS_PREMIUM = 50;
export const MAX_INSTALLED_PACKS_NON_PREMIUM = 0;
export const MAX_INSTALLED_PACKS_PREMIUM = 50;
export const MAX_VOICE_MESSAGE_DURATION = 1200;

export const EMOJI_MAX_SIZE = 384 * 1024;
export const EMOJI_EXTENSIONS = new Set(['jpeg', 'png', 'apng', 'webp', 'gif', 'avif']);
export const STICKER_MAX_SIZE = 512 * 1024;
export const STICKER_EXTENSIONS = new Set(['png', 'gif', 'apng', 'webp', 'avif']);
export const ATTACHMENT_MAX_SIZE_PREMIUM = 500 * 1024 * 1024;
export const ATTACHMENT_MAX_SIZE_NON_PREMIUM = 25 * 1024 * 1024;

export const MAX_MESSAGES_PER_CHANNEL = 30;
export const MAX_LOADED_MESSAGES = MAX_MESSAGES_PER_CHANNEL * 4;
export const TRUNCATED_MESSAGE_VIEW_SIZE = MAX_LOADED_MESSAGES * 0.5;
export const MAX_MESSAGE_CACHE_SIZE = MAX_MESSAGES_PER_CHANNEL * 5;

export const NEW_MESSAGES_BAR_BUFFER = 32;

export const VALID_TEMP_BAN_DURATIONS: ReadonlySet<number> = new Set([
	1 * 3600,
	12 * 3600,
	24 * 3600,
	72 * 3600,
	120 * 3600,
	168 * 3600,
	336 * 3600,
	720 * 3600,
]);
