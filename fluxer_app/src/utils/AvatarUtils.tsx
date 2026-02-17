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

import type {UserRecord} from '@app/records/UserRecord';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import {buildMediaProxyURL} from '@app/utils/MediaProxyUtils';
import {cdnUrl, mediaUrl, setPathQueryParams} from '@app/utils/UrlUtils';
import {
	MEDIA_PROXY_AVATAR_SIZE_DEFAULT,
	MEDIA_PROXY_ICON_SIZE_DEFAULT,
} from '@fluxer/constants/src/MediaProxyAssetSizes';
import type {MediaProxyImageSize} from '@fluxer/constants/src/MediaProxyImageSizes';
import {
	getDefaultAvatarIndex,
	getDefaultAvatarPrimaryColor as getSharedDefaultAvatarPrimaryColor,
	normalizeEndpoint,
	parseAvatarHash,
} from '@fluxer/ui/src/utils/AvatarMediaUtils';

const getDefaultAvatar = (index: number): string => cdnUrl(`avatars/${index}.png`);

export function getDefaultAvatarPrimaryColor(id: string) {
	return getSharedDefaultAvatarPrimaryColor(id);
}

type AvatarOptions = Pick<UserRecord, 'id' | 'avatar'>;
type BannerOptions = Pick<UserRecord, 'id' | 'banner'>;

interface IconOptions {
	id: string;
	icon: string | null;
}

type MediaURLParams = {
	path: string;
	id: string;
	hash: string;
	size?: MediaProxyImageSize;
	format: string;
	animated?: boolean;
	endpoint?: string;
};

const getMediaURL = ({path, id, hash, size, format, animated, endpoint}: MediaURLParams) => {
	if (DeveloperOptionsStore.forceRenderPlaceholders) {
		return '';
	}

	const baseEndpoint = endpoint ?? RuntimeConfigStore.mediaEndpoint;
	if (!baseEndpoint) {
		return '';
	}

	const basePath = `${path}/${id}/${hash}.${format}`;
	const url = size ? setPathQueryParams(basePath, {size}) : basePath;
	const proxyOptions = animated ? {animated} : undefined;
	return buildMediaProxyURL(`${normalizeEndpoint(baseEndpoint)}/${url}`, proxyOptions);
};

type GuildMemberMediaURLParams = {
	path: string;
	guildId: string;
	userId: string;
	hash: string;
	size?: MediaProxyImageSize;
	format: string;
	animated?: boolean;
};

const getGuildMemberMediaURL = ({path, guildId, userId, hash, size, format, animated}: GuildMemberMediaURLParams) => {
	if (DeveloperOptionsStore.forceRenderPlaceholders) {
		return '';
	}

	const baseEndpoint = RuntimeConfigStore.mediaEndpoint;
	if (!baseEndpoint) {
		return '';
	}

	const basePath = `guilds/${guildId}/users/${userId}/${path}/${hash}.${format}`;
	const url = size ? setPathQueryParams(basePath, {size}) : basePath;
	const proxyOptions = animated ? {animated} : undefined;
	return buildMediaProxyURL(`${normalizeEndpoint(baseEndpoint)}/${url}`, proxyOptions);
};

const buildWebpMediaUrl = (params: Omit<MediaURLParams, 'format'>) => getMediaURL({...params, format: 'webp'});
const buildGuildMemberWebpUrl = (params: Omit<GuildMemberMediaURLParams, 'format'>) =>
	getGuildMemberMediaURL({...params, format: 'webp'});

export function getUserAvatarURL(
	{id, avatar}: AvatarOptions,
	animated = false,
	size: MediaProxyImageSize = MEDIA_PROXY_AVATAR_SIZE_DEFAULT,
) {
	if (!avatar) {
		return getDefaultAvatar(getDefaultAvatarIndex(id));
	}

	const {hash} = parseAvatarHash(avatar);
	return buildWebpMediaUrl({
		path: 'avatars',
		id,
		hash,
		size,
		animated,
	});
}

export function getUserBannerURL({id, banner}: BannerOptions, animated = false, size: MediaProxyImageSize = 1024) {
	if (!banner) {
		return '';
	}

	const {hash} = parseAvatarHash(banner);
	return buildWebpMediaUrl({
		path: 'banners',
		id,
		hash,
		size,
		animated,
	});
}

export function getGuildIconURL({id, icon}: IconOptions, animated = false) {
	if (!icon) {
		return '';
	}

	const {hash, animated: isAnimated} = parseAvatarHash(icon);
	return buildWebpMediaUrl({
		path: 'icons',
		id,
		hash,
		size: MEDIA_PROXY_ICON_SIZE_DEFAULT,
		animated: isAnimated && animated,
	});
}

export function getGuildSplashURL({id, splash}: {id: string; splash: string | null}, size: MediaProxyImageSize = 1024) {
	if (!splash) {
		return '';
	}

	return buildWebpMediaUrl({
		path: 'splashes',
		id,
		hash: splash,
		size,
	});
}

export function getGuildDiscoverySplashURL({id, splash}: {id: string; splash: string | null}) {
	if (!splash) {
		return '';
	}

	return buildWebpMediaUrl({
		path: 'discovery-splashes',
		id,
		hash: splash,
		size: 1024,
	});
}

export function getGuildBannerURL({id, banner}: {id: string; banner: string | null}, animated = false) {
	if (!banner) {
		return '';
	}

	const {hash, animated: isAnimated} = parseAvatarHash(banner);
	return buildWebpMediaUrl({
		path: 'banners',
		id,
		hash,
		size: 1024,
		animated: isAnimated && animated,
	});
}

export function getGuildMemberAvatarURL({
	guildId,
	userId,
	avatar,
	memberAvatar,
	animated = false,
	size = MEDIA_PROXY_AVATAR_SIZE_DEFAULT,
}: {
	guildId: string;
	userId: string;
	avatar: string | null;
	memberAvatar?: string | null;
	animated?: boolean;
	size?: MediaProxyImageSize;
}) {
	if (memberAvatar) {
		const {hash, animated: isAnimated} = parseAvatarHash(memberAvatar);
		return buildGuildMemberWebpUrl({
			path: 'avatars',
			guildId,
			userId,
			hash,
			size,
			animated: isAnimated && animated,
		});
	}

	if (avatar) {
		const {hash} = parseAvatarHash(avatar);
		return buildWebpMediaUrl({
			path: 'avatars',
			id: userId,
			hash,
			size,
		});
	}

	return getDefaultAvatar(getDefaultAvatarIndex(userId));
}

export function getGuildMemberBannerURL({
	guildId,
	userId,
	banner,
	memberBanner,
	animated = false,
	size = 1024,
}: {
	guildId: string;
	userId: string;
	banner: string | null;
	memberBanner?: string | null;
	animated?: boolean;
	size?: MediaProxyImageSize;
}) {
	if (memberBanner) {
		const {hash, animated: isAnimated} = parseAvatarHash(memberBanner);
		return buildGuildMemberWebpUrl({
			path: 'banners',
			guildId,
			userId,
			hash,
			size,
			animated: isAnimated && animated,
		});
	}

	if (banner) {
		const {hash, animated: isAnimated} = parseAvatarHash(banner);
		return buildWebpMediaUrl({
			path: 'banners',
			id: userId,
			hash,
			size,
			animated: isAnimated && animated,
		});
	}

	return '';
}

export function getUserAvatarURLWithProxy(
	options: AvatarOptions,
	endpoint: string,
	animated = false,
	size: MediaProxyImageSize = MEDIA_PROXY_AVATAR_SIZE_DEFAULT,
) {
	if (!endpoint) {
		return getUserAvatarURL(options, animated, size);
	}

	const {id, avatar} = options;
	if (!avatar) {
		return getDefaultAvatar(getDefaultAvatarIndex(id));
	}

	const {hash} = parseAvatarHash(avatar);
	return buildWebpMediaUrl({
		path: 'avatars',
		id,
		hash,
		size,
		animated,
		endpoint,
	});
}

export function getGuildEmbedSplashURL(
	{id, embedSplash}: {id: string; embedSplash: string | null},
	size: MediaProxyImageSize = 1024,
) {
	if (!embedSplash) {
		return '';
	}

	return buildWebpMediaUrl({
		path: 'embed-splashes',
		id,
		hash: embedSplash,
		size,
	});
}

export function getChannelIconURL(
	{id, icon}: IconOptions,
	size: MediaProxyImageSize = MEDIA_PROXY_ICON_SIZE_DEFAULT,
	animated = false,
) {
	if (!icon) {
		return '';
	}

	const {hash, animated: isAnimated} = parseAvatarHash(icon);
	return buildWebpMediaUrl({
		path: 'icons',
		id,
		hash,
		size,
		animated: isAnimated && animated,
	});
}

export function getWebhookAvatarURL({id, avatar}: AvatarOptions, animated = false) {
	if (!avatar) {
		return getDefaultAvatar(getDefaultAvatarIndex(id));
	}

	const {hash, animated: isAnimated} = parseAvatarHash(avatar);
	return buildWebpMediaUrl({
		path: 'avatars',
		id,
		hash,
		size: MEDIA_PROXY_AVATAR_SIZE_DEFAULT,
		animated: isAnimated && animated,
	});
}

export function getEmojiURL({id, animated}: {id: string; animated?: boolean}) {
	if (DeveloperOptionsStore.forceRenderPlaceholders) {
		return '';
	}
	return mediaUrl(`emojis/${id}.webp`, {animated: Boolean(animated)});
}

type StickerSize = 160 | 320;

export function getStickerURL({id, animated, size = 320}: {id: string; animated?: boolean; size?: StickerSize}) {
	if (DeveloperOptionsStore.forceRenderPlaceholders) {
		return '';
	}

	const safeSize: StickerSize = size === 320 ? 320 : 160;
	return mediaUrl(setPathQueryParams(`stickers/${id}.webp`, {size: safeSize}), {animated: Boolean(animated)});
}

export function fileToBase64(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
