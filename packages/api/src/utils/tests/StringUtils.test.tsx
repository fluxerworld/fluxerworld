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

import {parseString} from '@fluxer/api/src/utils/StringUtils';
import {describe, expect, it} from 'vitest';

describe('parseString', () => {
	it('returns trimmed string within max length', () => {
		expect(parseString('Hello World', 50)).toBe('Hello World');
	});

	it('trims whitespace from the string', () => {
		expect(parseString('  Hello World  ', 50)).toBe('Hello World');
	});

	it('truncates string exceeding max length', () => {
		const result = parseString('This is a very long string that needs truncation', 20);
		expect(result.length).toBeLessThanOrEqual(20);
		expect(result).toContain('...');
	});

	it('handles exact max length', () => {
		const result = parseString('12345', 5);
		expect(result).toBe('12345');
	});

	it('decodes HTML entities before processing', () => {
		expect(parseString('Hello &amp; World', 50)).toBe('Hello & World');
		expect(parseString('&lt;script&gt;', 50)).toBe('<script>');
	});

	it('handles empty string', () => {
		expect(parseString('', 50)).toBe('');
	});

	it('handles string with only whitespace', () => {
		expect(parseString('   ', 50)).toBe('');
	});

	it('handles unicode characters', () => {
		expect(parseString('Hello \u{1F600} World', 50)).toBe('Hello \u{1F600} World');
	});

	it('truncates with ellipsis by default', () => {
		const result = parseString('This is a test string for truncation', 15);
		expect(result.endsWith('...')).toBe(true);
	});

	it('handles max length of 0 (lodash truncate returns ellipsis)', () => {
		const result = parseString('Hello', 0);
		expect(result).toBe('...');
	});

	it('handles max length of 1 (lodash truncate minimum is ellipsis length)', () => {
		const result = parseString('Hello', 1);
		expect(result).toBe('...');
	});

	it('handles max length of 3 (minimum for truncation)', () => {
		const result = parseString('Hello', 3);
		expect(result).toBe('...');
	});

	it('handles max length of 4', () => {
		const result = parseString('Hello', 4);
		expect(result.length).toBeLessThanOrEqual(4);
	});

	it('preserves string with special characters', () => {
		const input = 'Hello\nWorld\tTab';
		const result = parseString(input, 50);
		expect(result).toContain('\n');
		expect(result).toContain('\t');
	});

	it('handles combined HTML entities and long strings', () => {
		const input = '&amp; '.repeat(20);
		const result = parseString(input, 30);
		expect(result.length).toBeLessThanOrEqual(30);
	});
});
