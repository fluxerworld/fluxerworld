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

import {MODE} from '@app/lib/Env';
import {Platform} from '@app/lib/Platform';
import {convertToCodePoints} from '@app/utils/EmojiCodepointUtils';
import type {FC, SVGProps} from 'react';

const TWEMOJI_CDN = 'https://fluxerstatic.com/emoji';

type TwemojiComponent = FC<SVGProps<SVGSVGElement>>;

export const shouldUseNativeEmoji = Platform.isAppleDevice;

export function fromHexCodePoint(hex: string): string {
	return String.fromCodePoint(Number.parseInt(hex, 16));
}

export function getTwemojiURL(codePoints: string): string | null {
	if (shouldUseNativeEmoji || MODE === 'test' || !codePoints) {
		return null;
	}

	return `${TWEMOJI_CDN}/${codePoints}.svg`;
}

export function getEmojiURL(unicode: string): string | null {
	return getTwemojiURL(convertToCodePoints(unicode));
}

export function getTwemojiSvg(_codePoints: string): TwemojiComponent | null {
	return null;
}
export function getEmojiSvg(_unicode: string): TwemojiComponent | null {
	return null;
}
