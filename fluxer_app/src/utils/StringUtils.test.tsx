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

import {getInitialsFromName} from '@app/utils/StringUtils';
import {describe, expect, test} from 'vitest';

describe('StringUtils', () => {
	describe('getInitialsFromName', () => {
		test('returns single initial for single word', () => {
			expect(getInitialsFromName('Hello')).toBe('H');
		});

		test('returns two initials for two words', () => {
			expect(getInitialsFromName('Hello World')).toBe('HW');
		});

		test('returns multiple initials for multiple words', () => {
			expect(getInitialsFromName('Hello Beautiful World')).toBe('HBW');
		});

		test('handles leading whitespace', () => {
			expect(getInitialsFromName('  Hello World')).toBe('HW');
		});

		test('handles trailing whitespace', () => {
			expect(getInitialsFromName('Hello World  ')).toBe('HW');
		});

		test('handles multiple spaces between words', () => {
			expect(getInitialsFromName('Hello    World')).toBe('HW');
		});

		test('returns empty string for empty input', () => {
			expect(getInitialsFromName('')).toBe('');
		});

		test('returns empty string for whitespace only', () => {
			expect(getInitialsFromName('   ')).toBe('');
		});

		test('handles lowercase words', () => {
			expect(getInitialsFromName('hello world')).toBe('hw');
		});

		test('handles mixed case words', () => {
			expect(getInitialsFromName('hELLO wORLD')).toBe('hw');
		});

		test('handles single character words', () => {
			expect(getInitialsFromName('a b c')).toBe('abc');
		});

		test('handles unicode characters', () => {
			expect(getInitialsFromName('Cafe Noir')).toBe('CN');
		});

		test('handles emoji in name', () => {
			const result = getInitialsFromName('Hello World');
			expect(result).toBe('HW');
		});
	});
});
