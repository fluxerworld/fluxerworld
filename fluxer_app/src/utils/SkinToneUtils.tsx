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

import UnicodeEmojis from '@app/lib/UnicodeEmojis';
import EmojiStore from '@app/stores/EmojiStore';
import type {FlatEmoji, UnicodeEmoji} from '@app/types/EmojiTypes';

export interface EmojiDisplayData {
	surrogates: string;
	url: string | undefined;
}

export function getSkinTonedEmoji(emoji: FlatEmoji, skinTone: string): UnicodeEmoji | null {
	if (!emoji.hasDiversity || !skinTone || !emoji.uniqueName) {
		return null;
	}
	return UnicodeEmojis.findEmojiWithSkinTone(emoji.uniqueName, skinTone);
}

export function getEmojiDisplayData(emoji: FlatEmoji): EmojiDisplayData {
	const skinTone = EmojiStore.skinTone;
	const skinTonedEmoji = getSkinTonedEmoji(emoji, skinTone);

	return {
		surrogates: skinTonedEmoji?.surrogates ?? emoji.surrogates ?? '',
		url: skinTonedEmoji?.url ?? emoji.url,
	};
}

export function getEmojiDisplayDataWithSkinTone(emoji: FlatEmoji, skinTone: string): EmojiDisplayData {
	const skinTonedEmoji = getSkinTonedEmoji(emoji, skinTone);

	return {
		surrogates: skinTonedEmoji?.surrogates ?? emoji.surrogates ?? '',
		url: skinTonedEmoji?.url ?? emoji.url,
	};
}

export function getSkinTonedSurrogate(emoji: FlatEmoji): string {
	const skinTone = EmojiStore.skinTone;
	if (!emoji.hasDiversity || !skinTone || !emoji.uniqueName) {
		return emoji.surrogates ?? '';
	}

	const skinTonedEmoji = UnicodeEmojis.findEmojiWithSkinTone(emoji.uniqueName, skinTone);
	return skinTonedEmoji?.surrogates ?? emoji.surrogates ?? '';
}
