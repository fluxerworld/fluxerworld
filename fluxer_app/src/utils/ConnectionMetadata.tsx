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

import type {ConnectionType} from '@fluxer/constants/src/ConnectionConstants';
import {ConnectionTypes} from '@fluxer/constants/src/ConnectionConstants';

export interface ConnectionMeta {
	name: string;
	color: string;
	placeholder: string;
	urlTemplate: string | null;
}

const META: Record<ConnectionType, ConnectionMeta> = {
	[ConnectionTypes.BLUESKY]: {
		name: 'Bluesky',
		color: '#1185fe',
		placeholder: 'handle.bsky.social',
		urlTemplate: 'https://bsky.app/profile/{id}',
	},
	[ConnectionTypes.DOMAIN]: {
		name: 'Domain',
		color: '#9ca3af',
		placeholder: 'example.com',
		urlTemplate: 'https://{id}',
	},
	[ConnectionTypes.BATTLENET]: {
		name: 'Battle.net',
		color: '#148eff',
		placeholder: 'Player#1234',
		urlTemplate: null,
	},
	[ConnectionTypes.EPIC_GAMES]: {
		name: 'Epic Games',
		color: '#ccc',
		placeholder: 'Username',
		urlTemplate: null,
	},
	[ConnectionTypes.FACEBOOK]: {
		name: 'Facebook',
		color: '#1877f2',
		placeholder: 'Username',
		urlTemplate: 'https://facebook.com/{id}',
	},
	[ConnectionTypes.GITHUB]: {
		name: 'GitHub',
		color: '#e4e4e7',
		placeholder: 'username',
		urlTemplate: 'https://github.com/{id}',
	},
	[ConnectionTypes.PAYPAL]: {
		name: 'PayPal',
		color: '#003087',
		placeholder: 'Username',
		urlTemplate: 'https://paypal.me/{id}',
	},
	[ConnectionTypes.PLAYSTATION]: {
		name: 'PlayStation',
		color: '#003791',
		placeholder: 'PSN ID',
		urlTemplate: null,
	},
	[ConnectionTypes.REDDIT]: {
		name: 'Reddit',
		color: '#ff4500',
		placeholder: 'username',
		urlTemplate: 'https://reddit.com/u/{id}',
	},
	[ConnectionTypes.SPOTIFY]: {
		name: 'Spotify',
		color: '#1db954',
		placeholder: 'Username or profile URL',
		urlTemplate: 'https://open.spotify.com/user/{id}',
	},
	[ConnectionTypes.STEAM]: {
		name: 'Steam',
		color: '#66c0f4',
		placeholder: 'Username or profile URL',
		urlTemplate: 'https://steamcommunity.com/id/{id}',
	},
	[ConnectionTypes.TIKTOK]: {
		name: 'TikTok',
		color: '#fe2c55',
		placeholder: '@username',
		urlTemplate: 'https://tiktok.com/@{id}',
	},
	[ConnectionTypes.TWITCH]: {
		name: 'Twitch',
		color: '#9146ff',
		placeholder: 'username',
		urlTemplate: 'https://twitch.tv/{id}',
	},
	[ConnectionTypes.X]: {
		name: 'X',
		color: '#e4e4e7',
		placeholder: '@username',
		urlTemplate: 'https://x.com/{id}',
	},
	[ConnectionTypes.XBOX]: {
		name: 'Xbox',
		color: '#107c10',
		placeholder: 'Gamertag',
		urlTemplate: null,
	},
	[ConnectionTypes.YOUTUBE]: {
		name: 'YouTube',
		color: '#ff0000',
		placeholder: '@channel or channel URL',
		urlTemplate: 'https://youtube.com/@{id}',
	},
};

export function getConnectionMeta(type: ConnectionType): ConnectionMeta {
	return META[type] ?? META[ConnectionTypes.DOMAIN];
}

export function getConnectionUrl(type: ConnectionType, identifier: string): string | null {
	const meta = getConnectionMeta(type);
	if (!meta.urlTemplate) return null;
	const cleanId = identifier.replace(/^@/, '');
	return meta.urlTemplate.replace('{id}', encodeURIComponent(cleanId));
}
