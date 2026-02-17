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
import {SKIN_TONE_SURROGATES} from '@fluxer/constants/src/EmojiConstants';
import {type EmojiProvider, setEmojiParserConfig} from '@fluxer/markdown_parser/src/parsers/EmojiParsers';

const emojiProvider: EmojiProvider = {
	getSurrogateName: UnicodeEmojis.getSurrogateName,
	findEmojiByName: UnicodeEmojis.findEmojiByName,
	findEmojiWithSkinTone: UnicodeEmojis.findEmojiWithSkinTone,
};

export function initializeEmojiParser(): void {
	setEmojiParserConfig({
		emojiProvider,
		emojiRegex: UnicodeEmojis.EMOJI_SURROGATE_RE,
		skinToneSurrogates: SKIN_TONE_SURROGATES,
	});
}
