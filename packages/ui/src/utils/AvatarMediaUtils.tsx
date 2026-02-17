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

import type {MediaProxyImageSize} from '@fluxer/constants/src/MediaProxyImageSizes';

const DEFAULT_AVATAR_PRIMARY_COLORS = [0x4641d9, 0xf0b100, 0x00bba7, 0x2b7fff, 0xad46ff, 0x6a7282];
export const DEFAULT_AVATAR_COUNT = BigInt(DEFAULT_AVATAR_PRIMARY_COLORS.length);

export const normalizeEndpoint = (endpoint: string): string => endpoint.replace(/\/$/, '');

export const parseAvatarHash = (value: string) => {
	const animated = value.startsWith('a_');
	const hash = animated ? value.slice(2) : value;
	return {animated, hash};
};

export const buildMediaUrl = ({
	endpoint,
	path,
	id,
	hash,
	size,
	animated,
}: {
	endpoint: string;
	path: string;
	id: string;
	hash: string;
	size: MediaProxyImageSize;
	animated?: boolean;
}) => {
	const normalizedEndpoint = normalizeEndpoint(endpoint);
	const params = new URLSearchParams();
	params.set('size', size.toString());
	if (animated) {
		params.set('animated', 'true');
	}
	const query = params.toString();
	return `${normalizedEndpoint}/${path}/${id}/${hash}.webp${query ? `?${query}` : ''}`;
};

export const getDefaultAvatarIndex = (id: string): number => Number(BigInt(id) % DEFAULT_AVATAR_COUNT);

export const getDefaultAvatarPrimaryColor = (id: string): number =>
	DEFAULT_AVATAR_PRIMARY_COLORS[getDefaultAvatarIndex(id)];
