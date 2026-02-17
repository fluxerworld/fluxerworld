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

import emojiRegex from 'emoji-regex';

const EMOJI_REGEX = emojiRegex();

const REGIONAL_INDICATOR_START = 0x1f1e6;
const REGIONAL_INDICATOR_END = 0x1f1ff;

function isSingleRegionalIndicator(value: string): boolean {
	const codePoints = [...value];
	if (codePoints.length !== 1) {
		return false;
	}
	const codePoint = codePoints[0].codePointAt(0);
	return codePoint !== undefined && codePoint >= REGIONAL_INDICATOR_START && codePoint <= REGIONAL_INDICATOR_END;
}

export function isValidSingleUnicodeEmoji(value: string): boolean {
	if (!value || value.length === 0) {
		return false;
	}

	EMOJI_REGEX.lastIndex = 0;
	const match = EMOJI_REGEX.exec(value);

	if (match && match.index === 0 && match[0] === value) {
		return true;
	}

	return isSingleRegionalIndicator(value);
}
