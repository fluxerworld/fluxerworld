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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import {
	MEDIA_PROXY_AVATAR_SIZE_DEFAULT,
	MEDIA_PROXY_GUILD_BANNER_SIZE_DEFAULT,
	MEDIA_PROXY_GUILD_EMBED_SPLASH_SIZE_DEFAULT,
	MEDIA_PROXY_GUILD_SPLASH_SIZE_DEFAULT,
	MEDIA_PROXY_ICON_SIZE_DEFAULT,
	MEDIA_PROXY_PROFILE_BANNER_SIZE_MODAL,
} from '@fluxer/constants/src/MediaProxyAssetSizes';
import {extractTimestampFromSnowflakeAsDate} from '@fluxer/snowflake/src/SnowflakeUtils';
import {
	buildMediaUrl,
	getDefaultAvatarIndex,
	normalizeEndpoint,
	parseAvatarHash,
} from '@fluxer/ui/src/utils/AvatarMediaUtils';

export function formatDiscriminator(discriminator: number | string): string {
	const discStr = String(discriminator).padStart(4, '0');
	return discStr;
}

export function formatUserTag(username: string, discriminator: string | number): string {
	const discStr = typeof discriminator === 'number' ? formatDiscriminator(discriminator) : discriminator;
	return `${username}#${discStr}`;
}

export function getInitials(name: string): string {
	if (!name || name.trim() === '') {
		return '?';
	}
	const words = name.trim().split(/\s+/);
	const firstWord = words[0];
	const lastWord = words[words.length - 1];

	if (!firstWord) {
		return '?';
	}

	if (words.length === 1 || !lastWord) {
		return firstWord.charAt(0).toUpperCase();
	}

	return (firstWord.charAt(0) + lastWord.charAt(0)).toUpperCase();
}

export function extractTimestampFromSnowflake(snowflake: string, epoch = '1420070400000'): string {
	try {
		const date = extractTimestampFromSnowflakeAsDate(snowflake, epoch);
		if (Number.isNaN(date.getTime())) {
			return 'Unknown';
		}

		const year = date.getUTCFullYear().toString();
		const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
		const day = date.getUTCDate().toString().padStart(2, '0');
		const hour = date.getUTCHours().toString().padStart(2, '0');
		const minute = date.getUTCMinutes().toString().padStart(2, '0');

		const monthNames: Record<string, string> = {
			'01': 'Jan',
			'02': 'Feb',
			'03': 'Mar',
			'04': 'Apr',
			'05': 'May',
			'06': 'Jun',
			'07': 'Jul',
			'08': 'Aug',
			'09': 'Sep',
			'10': 'Oct',
			'11': 'Nov',
			'12': 'Dec',
		};

		const monthName = monthNames[month] ?? month;
		return `${monthName} ${day}, ${year} at ${hour}:${minute}`;
	} catch {
		return 'Unknown';
	}
}

export function getUserAvatarUrl(
	mediaEndpoint: string,
	staticCdnEndpoint: string,
	userId: string,
	avatar: string | null,
	forceStatic: boolean,
	_assetVersion: string,
): string {
	if (avatar) {
		const {hash, animated} = parseAvatarHash(avatar);
		const shouldAnimate = animated && !forceStatic;
		return buildMediaUrl({
			endpoint: mediaEndpoint,
			path: 'avatars',
			id: userId,
			hash,
			size: MEDIA_PROXY_AVATAR_SIZE_DEFAULT,
			animated: shouldAnimate,
		});
	}
	const defaultIndex = getDefaultAvatarIndex(userId);
	return `${normalizeEndpoint(staticCdnEndpoint)}/avatars/${defaultIndex}.png`;
}

export function getGuildIconUrl(
	mediaEndpoint: string,
	guildId: string,
	icon: string | null,
	forceStatic: boolean,
): string | null {
	if (!icon) {
		return null;
	}
	const {hash, animated} = parseAvatarHash(icon);
	const shouldAnimate = animated && !forceStatic;
	return buildMediaUrl({
		endpoint: mediaEndpoint,
		path: 'icons',
		id: guildId,
		hash,
		size: MEDIA_PROXY_ICON_SIZE_DEFAULT,
		animated: shouldAnimate,
	});
}

export function getUserBannerUrl(
	mediaEndpoint: string,
	userId: string,
	banner: string | null,
	forceStatic: boolean,
): string | null {
	if (!banner) {
		return null;
	}
	const {hash, animated} = parseAvatarHash(banner);
	const shouldAnimate = animated && !forceStatic;
	return buildMediaUrl({
		endpoint: mediaEndpoint,
		path: 'banners',
		id: userId,
		hash,
		size: MEDIA_PROXY_PROFILE_BANNER_SIZE_MODAL,
		animated: shouldAnimate,
	});
}

export function getGuildBannerUrl(
	mediaEndpoint: string,
	guildId: string,
	banner: string | null,
	forceStatic: boolean,
): string | null {
	if (!banner) {
		return null;
	}
	const {hash, animated} = parseAvatarHash(banner);
	const shouldAnimate = animated && !forceStatic;
	return buildMediaUrl({
		endpoint: mediaEndpoint,
		path: 'banners',
		id: guildId,
		hash,
		size: MEDIA_PROXY_GUILD_BANNER_SIZE_DEFAULT,
		animated: shouldAnimate,
	});
}

export function getGuildSplashUrl(mediaEndpoint: string, guildId: string, splash: string | null): string | null {
	if (!splash) {
		return null;
	}
	return buildMediaUrl({
		endpoint: mediaEndpoint,
		path: 'splashes',
		id: guildId,
		hash: splash,
		size: MEDIA_PROXY_GUILD_SPLASH_SIZE_DEFAULT,
	});
}

export function getGuildEmbedSplashUrl(mediaEndpoint: string, guildId: string, splash: string | null): string | null {
	if (!splash) {
		return null;
	}
	return buildMediaUrl({
		endpoint: mediaEndpoint,
		path: 'embed-splashes',
		id: guildId,
		hash: splash,
		size: MEDIA_PROXY_GUILD_EMBED_SPLASH_SIZE_DEFAULT,
	});
}
