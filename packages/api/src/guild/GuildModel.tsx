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

import {mapGuildFeatures} from '@fluxer/api/src/guild/GuildFeatureUtils';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Guild} from '@fluxer/api/src/models/Guild';
import type {GuildBan} from '@fluxer/api/src/models/GuildBan';
import type {GuildEmoji} from '@fluxer/api/src/models/GuildEmoji';
import type {GuildMember} from '@fluxer/api/src/models/GuildMember';
import type {GuildRole} from '@fluxer/api/src/models/GuildRole';
import type {GuildSticker} from '@fluxer/api/src/models/GuildSticker';
import {getCachedUserPartialResponse, getCachedUserPartialResponses} from '@fluxer/api/src/user/UserCacheHelpers';
import type {
	GuildEmojiResponse,
	GuildEmojiWithUserResponse,
	GuildStickerResponse,
	GuildStickerWithUserResponse,
} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import type {GuildBanResponse, GuildMemberResponse} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import type {GuildPartialResponse, GuildResponse} from '@fluxer/schema/src/domains/guild/GuildResponseSchemas';
import type {GuildRoleResponse} from '@fluxer/schema/src/domains/guild/GuildRoleSchemas';
import type {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import type {z} from 'zod';

export function mapGuildToPartialResponse(guild: Guild): z.infer<typeof GuildPartialResponse> {
	return {
		id: guild.id.toString(),
		name: guild.name,
		icon: guild.iconHash,
		banner: guild.bannerHash,
		banner_width: guild.bannerWidth,
		banner_height: guild.bannerHeight,
		splash: guild.splashHash,
		splash_width: guild.splashWidth,
		splash_height: guild.splashHeight,
		embed_splash: guild.embedSplashHash,
		embed_splash_width: guild.embedSplashWidth,
		embed_splash_height: guild.embedSplashHeight,
		splash_card_alignment: guild.splashCardAlignment,
		features: mapGuildFeatures(guild.features),
	};
}

export function mapGuildToGuildResponse(
	guild: Guild,
	options?: {permissions?: bigint | null},
): z.infer<typeof GuildResponse> {
	return {
		id: guild.id.toString(),
		name: guild.name,
		icon: guild.iconHash,
		banner: guild.bannerHash,
		banner_width: guild.bannerWidth,
		banner_height: guild.bannerHeight,
		splash: guild.splashHash,
		splash_width: guild.splashWidth,
		splash_height: guild.splashHeight,
		embed_splash: guild.embedSplashHash,
		embed_splash_width: guild.embedSplashWidth,
		embed_splash_height: guild.embedSplashHeight,
		splash_card_alignment: guild.splashCardAlignment,
		vanity_url_code: guild.vanityUrlCode,
		owner_id: guild.ownerId.toString(),
		system_channel_id: guild.systemChannelId ? guild.systemChannelId.toString() : null,
		system_channel_flags: guild.systemChannelFlags,
		rules_channel_id: guild.rulesChannelId ? guild.rulesChannelId.toString() : null,
		afk_channel_id: guild.afkChannelId ? guild.afkChannelId.toString() : null,
		afk_timeout: guild.afkTimeout,
		features: mapGuildFeatures(guild.features),
		verification_level: guild.verificationLevel,
		mfa_level: guild.mfaLevel,
		nsfw_level: guild.nsfwLevel,
		explicit_content_filter: guild.explicitContentFilter,
		default_message_notifications: guild.defaultMessageNotifications,
		disabled_operations: guild.disabledOperations,
		message_history_cutoff: guild.messageHistoryCutoff ? guild.messageHistoryCutoff.toISOString() : null,
		permissions: options?.permissions != null ? options.permissions.toString() : undefined,
	};
}

export function mapGuildRoleToResponse(role: GuildRole): z.infer<typeof GuildRoleResponse> {
	return {
		id: role.id.toString(),
		name: role.name,
		color: role.color,
		position: role.position,
		hoist_position: role.hoistPosition,
		permissions: role.permissions.toString(),
		hoist: role.isHoisted,
		mentionable: role.isMentionable,
	};
}

export function mapGuildEmojiToResponse(emoji: GuildEmoji): z.infer<typeof GuildEmojiResponse> {
	return {
		id: emoji.id.toString(),
		name: emoji.name,
		animated: emoji.isAnimated,
	};
}

export function mapGuildStickerToResponse(sticker: GuildSticker): z.infer<typeof GuildStickerResponse> {
	return {
		id: sticker.id.toString(),
		name: sticker.name,
		description: sticker.description ?? '',
		tags: sticker.tags,
		animated: sticker.animated,
	};
}

function mapMemberWithUser(
	member: GuildMember,
	userPartial: z.infer<typeof UserPartialResponse>,
): z.infer<typeof GuildMemberResponse> {
	const now = Date.now();
	const isTimedOut = member.communicationDisabledUntil != null && member.communicationDisabledUntil.getTime() > now;
	return {
		user: userPartial,
		nick: member.nickname,
		avatar: member.isPremiumSanitized ? null : member.avatarHash,
		banner: member.isPremiumSanitized ? null : member.bannerHash,
		accent_color: member.accentColor,
		roles: Array.from(member.roleIds).map((id) => id.toString()),
		joined_at: member.joinedAt.toISOString(),
		mute: isTimedOut ? true : member.isMute,
		deaf: member.isDeaf,
		communication_disabled_until: member.communicationDisabledUntil?.toISOString() ?? null,
		profile_flags: member.profileFlags || undefined,
	};
}

export function isGuildMemberTimedOut(member?: z.infer<typeof GuildMemberResponse> | null): boolean {
	if (!member?.communication_disabled_until) {
		return false;
	}
	const timestamp = Date.parse(member.communication_disabled_until);
	return !Number.isNaN(timestamp) && timestamp > Date.now();
}

export async function mapGuildMemberToResponse(
	member: GuildMember,
	userCacheService: UserCacheService,
	requestCache: RequestCache,
): Promise<z.infer<typeof GuildMemberResponse>> {
	const userPartial = await getCachedUserPartialResponse({userId: member.userId, userCacheService, requestCache});
	return mapMemberWithUser(member, userPartial);
}

function mapEmojiWithUser(
	emoji: GuildEmoji,
	userPartial: z.infer<typeof UserPartialResponse>,
): z.infer<typeof GuildEmojiWithUserResponse> {
	return {
		id: emoji.id.toString(),
		name: emoji.name,
		animated: emoji.isAnimated,
		user: userPartial,
	};
}

export async function mapGuildEmojisWithUsersToResponse(
	emojis: Array<GuildEmoji>,
	userCacheService: UserCacheService,
	requestCache: RequestCache,
): Promise<Array<z.infer<typeof GuildEmojiWithUserResponse>>> {
	const userIds = [...new Set(emojis.map((emoji) => emoji.creatorId))];
	const userPartials = await getCachedUserPartialResponses({userIds, userCacheService, requestCache});
	return emojis
		.filter((emoji) => userPartials.has(emoji.creatorId))
		.map((emoji) => mapEmojiWithUser(emoji, userPartials.get(emoji.creatorId)!));
}

function mapStickerWithUser(
	sticker: GuildSticker,
	userPartial: z.infer<typeof UserPartialResponse>,
): z.infer<typeof GuildStickerWithUserResponse> {
	return {
		id: sticker.id.toString(),
		name: sticker.name,
		description: sticker.description ?? '',
		tags: sticker.tags,
		animated: sticker.animated,
		user: userPartial,
	};
}

export async function mapGuildStickersWithUsersToResponse(
	stickers: Array<GuildSticker>,
	userCacheService: UserCacheService,
	requestCache: RequestCache,
): Promise<Array<z.infer<typeof GuildStickerWithUserResponse>>> {
	const userIds = [...new Set(stickers.map((sticker) => sticker.creatorId))];
	const userPartials = await getCachedUserPartialResponses({userIds, userCacheService, requestCache});
	return stickers
		.filter((sticker) => userPartials.has(sticker.creatorId))
		.map((sticker) => mapStickerWithUser(sticker, userPartials.get(sticker.creatorId)!));
}

function mapBanWithUser(
	ban: GuildBan,
	userPartial: z.infer<typeof UserPartialResponse>,
): z.infer<typeof GuildBanResponse> {
	return {
		user: userPartial,
		reason: ban.reason,
		moderator_id: ban.moderatorId.toString(),
		banned_at: ban.bannedAt.toISOString(),
		expires_at: ban.expiresAt ? ban.expiresAt.toISOString() : null,
	};
}

export async function mapGuildBansToResponse(
	bans: Array<GuildBan>,
	userCacheService: UserCacheService,
	requestCache: RequestCache,
): Promise<Array<z.infer<typeof GuildBanResponse>>> {
	const userIds = [...new Set(bans.map((ban) => ban.userId))];
	const userPartials = await getCachedUserPartialResponses({userIds, userCacheService, requestCache});
	return bans
		.filter((ban) => userPartials.has(ban.userId))
		.map((ban) => mapBanWithUser(ban, userPartials.get(ban.userId)!));
}
