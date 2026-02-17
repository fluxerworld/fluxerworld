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

import {escapeRegex} from '@app/utils/RegexUtils';
import {describe, expect, test} from 'vitest';

describe('RegexUtils', () => {
	describe('escapeRegex', () => {
		test('returns empty string for empty input', () => {
			expect(escapeRegex('')).toBe('');
		});

		test('returns unchanged string without special characters', () => {
			expect(escapeRegex('hello world')).toBe('hello world');
		});

		test('escapes hyphen', () => {
			expect(escapeRegex('-')).toBe('\\-');
		});

		test('escapes square brackets', () => {
			expect(escapeRegex('[test]')).toBe('\\[test\\]');
		});

		test('escapes forward slash', () => {
			expect(escapeRegex('/')).toBe('\\/');
		});

		test('escapes curly braces', () => {
			expect(escapeRegex('{test}')).toBe('\\{test\\}');
		});

		test('escapes parentheses', () => {
			expect(escapeRegex('(test)')).toBe('\\(test\\)');
		});

		test('escapes asterisk', () => {
			expect(escapeRegex('*')).toBe('\\*');
		});

		test('escapes plus', () => {
			expect(escapeRegex('+')).toBe('\\+');
		});

		test('escapes question mark', () => {
			expect(escapeRegex('?')).toBe('\\?');
		});

		test('escapes period', () => {
			expect(escapeRegex('.')).toBe('\\.');
		});

		test('escapes backslash', () => {
			expect(escapeRegex('\\')).toBe('\\\\');
		});

		test('escapes caret', () => {
			expect(escapeRegex('^')).toBe('\\^');
		});

		test('escapes dollar sign', () => {
			expect(escapeRegex('$')).toBe('\\$');
		});

		test('escapes pipe', () => {
			expect(escapeRegex('|')).toBe('\\|');
		});

		test('escapes multiple special characters in a string', () => {
			expect(escapeRegex('test.com/path?query=value')).toBe('test\\.com\\/path\\?query=value');
		});

		test('escapes URL-like string', () => {
			expect(escapeRegex('https://example.com')).toBe('https:\\/\\/example\\.com');
		});

		test('escaped string can be used in RegExp without throwing', () => {
			const input = '[test](value)?.+*$^|{1,2}';
			const escaped = escapeRegex(input);
			expect(() => new RegExp(escaped)).not.toThrow();
		});

		test('escaped pattern matches literal characters', () => {
			const specialString = 'test.value';
			const escaped = escapeRegex(specialString);
			const regex = new RegExp(escaped);
			expect(regex.test(specialString)).toBe(true);
			expect(regex.test('testXvalue')).toBe(false);
		});
	});
});
