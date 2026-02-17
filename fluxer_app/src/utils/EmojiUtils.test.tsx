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

import {convertToCodePoints} from '@app/utils/EmojiCodepointUtils';
import {fromHexCodePoint, getEmojiSvg, getEmojiURL, getTwemojiSvg, getTwemojiURL} from '@app/utils/EmojiUtils';
import {describe, expect, test} from 'vitest';

describe('EmojiUtils', () => {
	describe('convertToCodePoints', () => {
		test('converts simple emoji to code points', () => {
			const result = convertToCodePoints('\u{1F600}');
			expect(result).toBe('1f600');
		});

		test('converts flag emoji with ZWJ to code points', () => {
			const result = convertToCodePoints('\u{1F1FA}\u{1F1F8}');
			expect(result).toBe('1f1fa-1f1f8');
		});

		test('removes variation selector from non-ZWJ emoji', () => {
			const emoji = '\u2764\uFE0F';
			const result = convertToCodePoints(emoji);
			expect(result).not.toContain('fe0f');
		});

		test('preserves variation selector in ZWJ sequences', () => {
			const emoji = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
			const result = convertToCodePoints(emoji);
			expect(result.includes('200d')).toBe(true);
		});

		test('keeps variation selectors for ZWJ flag sequences', () => {
			const emoji = '\u{1F3F3}\uFE0F\u200D\u26A7\uFE0F';
			const result = convertToCodePoints(emoji);
			expect(result).toBe('1f3f3-fe0f-200d-26a7-fe0f');
		});

		test('handles empty string', () => {
			const result = convertToCodePoints('');
			expect(result).toBe('');
		});

		test('handles single character', () => {
			const result = convertToCodePoints('A');
			expect(result).toBe('41');
		});
	});

	describe('fromHexCodePoint', () => {
		test('converts hex code point to character', () => {
			const result = fromHexCodePoint('1f600');
			expect(result).toBe('\u{1F600}');
		});

		test('converts simple hex to character', () => {
			const result = fromHexCodePoint('41');
			expect(result).toBe('A');
		});

		test('handles lowercase hex', () => {
			const result = fromHexCodePoint('1f600');
			expect(result).toBe('\u{1F600}');
		});

		test('handles uppercase hex', () => {
			const result = fromHexCodePoint('1F600');
			expect(result).toBe('\u{1F600}');
		});
	});

	describe('getTwemojiURL', () => {
		test('returns null in test mode', () => {
			const result = getTwemojiURL('1f600');
			expect(result).toBeNull();
		});

		test('returns null for empty code points', () => {
			const result = getTwemojiURL('');
			expect(result).toBeNull();
		});
	});

	describe('getEmojiURL', () => {
		test('returns null in test mode', () => {
			const result = getEmojiURL('\u{1F600}');
			expect(result).toBeNull();
		});
	});

	describe('getTwemojiSvg', () => {
		test('returns null', () => {
			const result = getTwemojiSvg('1f600');
			expect(result).toBeNull();
		});
	});

	describe('getEmojiSvg', () => {
		test('returns null', () => {
			const result = getEmojiSvg('\u{1F600}');
			expect(result).toBeNull();
		});
	});
});
