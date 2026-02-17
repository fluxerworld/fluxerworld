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

export const MEDIA_PROXY_IMAGE_SIZE_QUERY_VALUES = [
	'16',
	'20',
	'22',
	'24',
	'28',
	'32',
	'40',
	'44',
	'48',
	'56',
	'60',
	'64',
	'80',
	'96',
	'100',
	'128',
	'160',
	'240',
	'256',
	'300',
	'320',
	'480',
	'512',
	'600',
	'640',
	'1024',
	'1280',
	'1536',
	'2048',
	'3072',
	'4096',
] as const;

export const DEFAULT_MEDIA_PROXY_IMAGE_SIZE_QUERY_VALUE = '128' as const;

export type MediaProxyImageSizeQueryValue = (typeof MEDIA_PROXY_IMAGE_SIZE_QUERY_VALUES)[number];

type ParseNumericLiteral<T extends string> = T extends `${infer N extends number}` ? N : never;
export type MediaProxyImageSize = ParseNumericLiteral<MediaProxyImageSizeQueryValue>;

export const MEDIA_PROXY_IMAGE_SIZE_VALUES: ReadonlyArray<MediaProxyImageSize> =
	MEDIA_PROXY_IMAGE_SIZE_QUERY_VALUES.map((value) => Number(value) as MediaProxyImageSize);

export const DEFAULT_MEDIA_PROXY_IMAGE_SIZE = 128 as MediaProxyImageSize;
