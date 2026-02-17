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

import {escapeXml, formatAmzDate, formatISODate, parseAmzDate, xmlHeader, xmlTag} from '@fluxer/s3/src/utils/XmlUtils';
import {describe, expect, it} from 'vitest';

describe('escapeXml', () => {
	it('should escape ampersand', () => {
		expect(escapeXml('a & b')).toBe('a &amp; b');
	});

	it('should escape less than', () => {
		expect(escapeXml('a < b')).toBe('a &lt; b');
	});

	it('should escape greater than', () => {
		expect(escapeXml('a > b')).toBe('a &gt; b');
	});

	it('should escape double quotes', () => {
		expect(escapeXml('a "b" c')).toBe('a &quot;b&quot; c');
	});

	it('should escape single quotes', () => {
		expect(escapeXml("a 'b' c")).toBe('a &apos;b&apos; c');
	});

	it('should escape all special characters', () => {
		expect(escapeXml('<tag attr="value">a & b</tag>')).toBe('&lt;tag attr=&quot;value&quot;&gt;a &amp; b&lt;/tag&gt;');
	});
});

describe('xmlTag', () => {
	it('should create XML tag with string value', () => {
		expect(xmlTag('Name', 'test')).toBe('<Name>test</Name>');
	});

	it('should create XML tag with number value', () => {
		expect(xmlTag('Count', 42)).toBe('<Count>42</Count>');
	});

	it('should create XML tag with boolean value', () => {
		expect(xmlTag('Active', true)).toBe('<Active>true</Active>');
	});

	it('should return empty string for undefined value', () => {
		expect(xmlTag('Empty', undefined)).toBe('');
	});

	it('should return empty string for null value', () => {
		expect(xmlTag('Empty', null)).toBe('');
	});

	it('should escape value by default', () => {
		expect(xmlTag('Key', '<test>')).toBe('<Key>&lt;test&gt;</Key>');
	});

	it('should not escape value when shouldEscape is false', () => {
		expect(xmlTag('Key', '<test>', false)).toBe('<Key><test></Key>');
	});
});

describe('xmlHeader', () => {
	it('should return XML declaration', () => {
		expect(xmlHeader()).toBe('<?xml version="1.0" encoding="UTF-8"?>\n');
	});
});

describe('S3 date utilities', () => {
	describe('formatISODate', () => {
		it('should format date in ISO format', () => {
			const date = new Date('2024-01-15T12:30:45.000Z');
			expect(formatISODate(date)).toBe('2024-01-15T12:30:45.000Z');
		});

		it('should handle dates with milliseconds', () => {
			const date = new Date('2024-06-01T00:00:00.123Z');
			expect(formatISODate(date)).toBe('2024-06-01T00:00:00.123Z');
		});
	});

	describe('formatAmzDate', () => {
		it('should format date in AMZ format (compact ISO)', () => {
			const date = new Date('2024-01-15T12:30:45.000Z');
			expect(formatAmzDate(date)).toBe('20240115T123045Z');
		});

		it('should remove milliseconds', () => {
			const date = new Date('2024-01-15T12:30:45.999Z');
			expect(formatAmzDate(date)).toBe('20240115T123045Z');
		});
	});

	describe('parseAmzDate', () => {
		it('should parse valid AMZ date format', () => {
			const result = parseAmzDate('20240115T123045Z');
			expect(result).toBeInstanceOf(Date);
			expect(result?.toISOString()).toBe('2024-01-15T12:30:45.000Z');
		});

		it('should return null for invalid format', () => {
			expect(parseAmzDate('2024-01-15T12:30:45Z')).toBeNull();
			expect(parseAmzDate('invalid')).toBeNull();
			expect(parseAmzDate('')).toBeNull();
		});

		it('should handle midnight', () => {
			const result = parseAmzDate('20240101T000000Z');
			expect(result?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
		});

		it('should handle end of year', () => {
			const result = parseAmzDate('20241231T235959Z');
			expect(result?.toISOString()).toBe('2024-12-31T23:59:59.000Z');
		});
	});
});
