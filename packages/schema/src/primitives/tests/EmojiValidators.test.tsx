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

import {isValidSingleUnicodeEmoji} from '@fluxer/schema/src/primitives/EmojiValidators';
import {describe, expect, it} from 'vitest';

describe('isValidSingleUnicodeEmoji', () => {
	describe('valid single emojis', () => {
		it('accepts simple emoji', () => {
			expect(isValidSingleUnicodeEmoji('👍')).toBe(true);
		});

		it('accepts common face emojis', () => {
			expect(isValidSingleUnicodeEmoji('😀')).toBe(true);
			expect(isValidSingleUnicodeEmoji('😂')).toBe(true);
			expect(isValidSingleUnicodeEmoji('🥺')).toBe(true);
			expect(isValidSingleUnicodeEmoji('😡')).toBe(true);
			expect(isValidSingleUnicodeEmoji('🤔')).toBe(true);
		});

		it('accepts emoji with skin tone modifier', () => {
			expect(isValidSingleUnicodeEmoji('👍🏿')).toBe(true);
			expect(isValidSingleUnicodeEmoji('👍🏻')).toBe(true);
			expect(isValidSingleUnicodeEmoji('👍🏽')).toBe(true);
		});

		it('accepts ZWJ sequence emojis', () => {
			expect(isValidSingleUnicodeEmoji('👨‍👩‍👧‍👦')).toBe(true);
			expect(isValidSingleUnicodeEmoji('👩‍💻')).toBe(true);
			expect(isValidSingleUnicodeEmoji('🧑‍🎄')).toBe(true);
		});

		it('accepts ZWJ sequence with skin tone at correct position', () => {
			expect(isValidSingleUnicodeEmoji('🧑🏿‍🎄')).toBe(true);
			expect(isValidSingleUnicodeEmoji('👩🏻‍💻')).toBe(true);
		});

		it('accepts flag emojis', () => {
			expect(isValidSingleUnicodeEmoji('🇺🇸')).toBe(true);
			expect(isValidSingleUnicodeEmoji('🇬🇧')).toBe(true);
			expect(isValidSingleUnicodeEmoji('🏳️‍🌈')).toBe(true);
		});

		it('accepts single regional indicator symbols', () => {
			expect(isValidSingleUnicodeEmoji('🇦')).toBe(true);
			expect(isValidSingleUnicodeEmoji('🇧')).toBe(true);
			expect(isValidSingleUnicodeEmoji('🇵')).toBe(true);
			expect(isValidSingleUnicodeEmoji('🇿')).toBe(true);
		});

		it('accepts all 26 regional indicator symbols', () => {
			for (let cp = 0x1f1e6; cp <= 0x1f1ff; cp++) {
				expect(isValidSingleUnicodeEmoji(String.fromCodePoint(cp))).toBe(true);
			}
		});

		it('accepts keycap emojis', () => {
			expect(isValidSingleUnicodeEmoji('1️⃣')).toBe(true);
			expect(isValidSingleUnicodeEmoji('#️⃣')).toBe(true);
			expect(isValidSingleUnicodeEmoji('*️⃣')).toBe(true);
			expect(isValidSingleUnicodeEmoji('0️⃣')).toBe(true);
			expect(isValidSingleUnicodeEmoji('9️⃣')).toBe(true);
		});

		it('accepts variation selector emojis', () => {
			expect(isValidSingleUnicodeEmoji('❤️')).toBe(true);
			expect(isValidSingleUnicodeEmoji('☀️')).toBe(true);
		});

		it('accepts text-style emojis without variation selector', () => {
			expect(isValidSingleUnicodeEmoji('❤')).toBe(true);
			expect(isValidSingleUnicodeEmoji('☀')).toBe(true);
			expect(isValidSingleUnicodeEmoji('☺')).toBe(true);
		});

		it('accepts copyright, registered, and trademark symbols', () => {
			expect(isValidSingleUnicodeEmoji('©')).toBe(true);
			expect(isValidSingleUnicodeEmoji('©️')).toBe(true);
			expect(isValidSingleUnicodeEmoji('®')).toBe(true);
			expect(isValidSingleUnicodeEmoji('®️')).toBe(true);
			expect(isValidSingleUnicodeEmoji('™')).toBe(true);
			expect(isValidSingleUnicodeEmoji('™️')).toBe(true);
		});

		it('accepts animal and nature emojis', () => {
			expect(isValidSingleUnicodeEmoji('🐱')).toBe(true);
			expect(isValidSingleUnicodeEmoji('🌸')).toBe(true);
			expect(isValidSingleUnicodeEmoji('🌍')).toBe(true);
		});

		it('accepts food and object emojis', () => {
			expect(isValidSingleUnicodeEmoji('🍕')).toBe(true);
			expect(isValidSingleUnicodeEmoji('🎸')).toBe(true);
			expect(isValidSingleUnicodeEmoji('💎')).toBe(true);
		});

		it('accepts symbol emojis', () => {
			expect(isValidSingleUnicodeEmoji('✅')).toBe(true);
			expect(isValidSingleUnicodeEmoji('❌')).toBe(true);
			expect(isValidSingleUnicodeEmoji('⚠️')).toBe(true);
			expect(isValidSingleUnicodeEmoji('💯')).toBe(true);
		});
	});

	describe('invalid inputs', () => {
		it('rejects empty string', () => {
			expect(isValidSingleUnicodeEmoji('')).toBe(false);
		});

		it('rejects plain text', () => {
			expect(isValidSingleUnicodeEmoji('hello')).toBe(false);
			expect(isValidSingleUnicodeEmoji('abc')).toBe(false);
		});

		it('rejects single ascii characters', () => {
			expect(isValidSingleUnicodeEmoji('a')).toBe(false);
			expect(isValidSingleUnicodeEmoji('1')).toBe(false);
			expect(isValidSingleUnicodeEmoji('#')).toBe(false);
			expect(isValidSingleUnicodeEmoji(' ')).toBe(false);
		});

		it('rejects multiple emojis', () => {
			expect(isValidSingleUnicodeEmoji('👍👍')).toBe(false);
			expect(isValidSingleUnicodeEmoji('🎉🎊')).toBe(false);
			expect(isValidSingleUnicodeEmoji('👨‍👩‍👧‍👦👨‍👩‍👧')).toBe(false);
		});

		it('rejects multiple regional indicator symbols', () => {
			expect(isValidSingleUnicodeEmoji('\u{1F1E6}\u{1F1E7}')).toBe(false);
		});

		it('rejects emoji with trailing text', () => {
			expect(isValidSingleUnicodeEmoji('👍abc')).toBe(false);
			expect(isValidSingleUnicodeEmoji('🎉!')).toBe(false);
		});

		it('rejects emoji with leading text', () => {
			expect(isValidSingleUnicodeEmoji('abc👍')).toBe(false);
			expect(isValidSingleUnicodeEmoji('!🎉')).toBe(false);
		});

		it('rejects unicode characters that are not emoji', () => {
			expect(isValidSingleUnicodeEmoji('é')).toBe(false);
			expect(isValidSingleUnicodeEmoji('中')).toBe(false);
			expect(isValidSingleUnicodeEmoji('α')).toBe(false);
		});

		it('rejects regional indicator with trailing text', () => {
			expect(isValidSingleUnicodeEmoji('\u{1F1F5}abc')).toBe(false);
		});

		it('rejects regional indicator with leading text', () => {
			expect(isValidSingleUnicodeEmoji('abc\u{1F1F5}')).toBe(false);
		});
	});

	describe('malformed emoji sequences', () => {
		it('rejects skin tone at wrong position in ZWJ sequence', () => {
			expect(isValidSingleUnicodeEmoji('🧑‍🎄🏿')).toBe(false);
		});

		it('accepts standalone skin tone modifier as valid emoji', () => {
			expect(isValidSingleUnicodeEmoji('🏿')).toBe(true);
			expect(isValidSingleUnicodeEmoji('🏻')).toBe(true);
		});

		it('rejects standalone ZWJ character', () => {
			expect(isValidSingleUnicodeEmoji('\u200D')).toBe(false);
		});

		it('rejects emoji followed by standalone skin tone', () => {
			expect(isValidSingleUnicodeEmoji('🎄🏿')).toBe(false);
		});

		it('rejects double skin tone modifiers', () => {
			expect(isValidSingleUnicodeEmoji('👍🏿🏻')).toBe(false);
		});
	});
});
