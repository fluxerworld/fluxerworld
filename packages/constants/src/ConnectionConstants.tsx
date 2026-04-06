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

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const ConnectionTypes = {
	BLUESKY: 'bsky',
	DOMAIN: 'domain',
	BATTLENET: 'battlenet',
	EPIC_GAMES: 'epicgames',
	FACEBOOK: 'facebook',
	GITHUB: 'github',
	PAYPAL: 'paypal',
	PLAYSTATION: 'playstation',
	REDDIT: 'reddit',
	SPOTIFY: 'spotify',
	STEAM: 'steam',
	TIKTOK: 'tiktok',
	TWITCH: 'twitch',
	X: 'x',
	XBOX: 'xbox',
	YOUTUBE: 'youtube',
} as const;

export type ConnectionType = ValueOf<typeof ConnectionTypes>;

/** Connection types that require verification (DNS, OAuth, etc.) */
export const VERIFIED_CONNECTION_TYPES = new Set<ConnectionType>([
	ConnectionTypes.BLUESKY,
	ConnectionTypes.DOMAIN,
]);

/** Connection types that are simple social profile links (no verification). */
export const SOCIAL_CONNECTION_TYPES = new Set<ConnectionType>([
	ConnectionTypes.BATTLENET,
	ConnectionTypes.EPIC_GAMES,
	ConnectionTypes.FACEBOOK,
	ConnectionTypes.GITHUB,
	ConnectionTypes.PAYPAL,
	ConnectionTypes.PLAYSTATION,
	ConnectionTypes.REDDIT,
	ConnectionTypes.SPOTIFY,
	ConnectionTypes.STEAM,
	ConnectionTypes.TIKTOK,
	ConnectionTypes.TWITCH,
	ConnectionTypes.X,
	ConnectionTypes.XBOX,
	ConnectionTypes.YOUTUBE,
]);

export const ConnectionVisibilityFlags = {
	EVERYONE: 1 << 0,
	FRIENDS: 1 << 1,
	MUTUAL_GUILDS: 1 << 2,
} as const;

export type ConnectionVisibilityFlag = ValueOf<typeof ConnectionVisibilityFlags>;

export const ConnectionVisibilityFlagsDescriptions: Record<keyof typeof ConnectionVisibilityFlags, string> = {
	EVERYONE: 'Allow anyone to see this connection',
	FRIENDS: 'Allow friends to see this connection',
	MUTUAL_GUILDS: 'Allow members from mutual guilds to see this connection',
};

export const MAX_CONNECTIONS_PER_USER = 20;

export const CONNECTION_VERIFICATION_TOKEN_LENGTH = 32;

export const CONNECTION_REVALIDATION_INTERVAL_HOURS = 24;

export const CONNECTION_INITIATION_TOKEN_EXPIRY_MS = 30 * 60 * 1000;
