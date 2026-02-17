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

import {generateSnowflake} from '@fluxer/snowflake/src/Snowflake';
import {
	age,
	atNextMillisecond,
	atPreviousMillisecond,
	compare,
	extractTimestamp,
	fromTimestamp,
	fromTimestampWithSequence,
	isProbablyAValidSnowflake,
	SnowflakeSequence,
	sortBySnowflakeDesc,
} from '@fluxer/snowflake/src/SnowflakeUtils';
import {describe, expect, test} from 'vitest';

describe('SnowflakeUtils', () => {
	describe('extractTimestamp', () => {
		test('round-trips generated snowflakes without precision loss', () => {
			const timestamp = Date.now();
			const snowflake = fromTimestamp(timestamp);

			expect(extractTimestamp(snowflake)).toBe(timestamp);
		});

		test('returns NaN for invalid snowflake string', () => {
			expect(Number.isNaN(extractTimestamp('invalid'))).toBe(true);
		});

		test('returns epoch timestamp for empty string (BigInt 0)', () => {
			const result = extractTimestamp('');
			expect(typeof result).toBe('number');
		});
	});

	describe('fromTimestamp', () => {
		test('generates valid snowflake from timestamp', () => {
			const timestamp = Date.now();
			const snowflake = fromTimestamp(timestamp);
			expect(snowflake).toBeTruthy();
			expect(typeof snowflake).toBe('string');
		});

		test('returns 0 for timestamp before epoch', () => {
			const snowflake = fromTimestamp(0);
			expect(snowflake).toBe('0');
		});

		test('returns 0 for negative timestamp', () => {
			const snowflake = fromTimestamp(-1000);
			expect(snowflake).toBe('0');
		});
	});

	describe('fromTimestampWithSequence', () => {
		test('preserves the timestamp while the sequence makes later IDs larger', () => {
			const timestamp = Date.now();
			const sequence = new SnowflakeSequence();

			const first = fromTimestampWithSequence(timestamp, sequence);
			const second = fromTimestampWithSequence(timestamp, sequence);

			expect(extractTimestamp(first)).toBe(timestamp);
			expect(extractTimestamp(second)).toBe(timestamp);
			expect(compare(second, first)).toBeGreaterThan(0);
		});

		test('handles timestamp before epoch', () => {
			const sequence = new SnowflakeSequence();
			const snowflake = fromTimestampWithSequence(0, sequence);
			expect(snowflake).toBeTruthy();
		});
	});

	describe('atPreviousMillisecond', () => {
		test('returns snowflake one millisecond before', () => {
			const timestamp = Date.now();
			const snowflake = fromTimestamp(timestamp);
			const previous = atPreviousMillisecond(snowflake);
			expect(extractTimestamp(previous)).toBe(timestamp - 1);
		});
	});

	describe('atNextMillisecond', () => {
		test('returns snowflake one millisecond after', () => {
			const timestamp = Date.now();
			const snowflake = fromTimestamp(timestamp);
			const next = atNextMillisecond(snowflake);
			expect(extractTimestamp(next)).toBe(timestamp + 1);
		});
	});

	describe('compare', () => {
		test('returns 0 for equal snowflakes', () => {
			expect(compare('12345', '12345')).toBe(0);
		});

		test('returns 0 for both null', () => {
			expect(compare(null, null)).toBe(0);
		});

		test('returns -1 for first null', () => {
			expect(compare(null, '1')).toBe(-1);
		});

		test('returns 1 for second null', () => {
			expect(compare('2', null)).toBe(1);
		});

		test('compares by length first for larger snowflakes', () => {
			expect(compare('99999999999999999', '1')).toBeGreaterThan(0);
		});

		test('compares lexicographically for same length', () => {
			expect(compare('1', '2')).toBeLessThan(0);
			expect(compare('2', '1')).toBeGreaterThan(0);
		});

		test('handles equal length different values', () => {
			expect(compare('123', '456')).toBeLessThan(0);
			expect(compare('789', '123')).toBeGreaterThan(0);
		});
	});

	describe('isProbablyAValidSnowflake', () => {
		test('returns true for valid snowflake string', () => {
			expect(isProbablyAValidSnowflake('123456789012345678')).toBe(true);
		});

		test('returns false for null', () => {
			expect(isProbablyAValidSnowflake(null)).toBe(false);
		});

		test('returns false for undefined', () => {
			expect(isProbablyAValidSnowflake(undefined)).toBe(false);
		});

		test('returns false for non-numeric string', () => {
			expect(isProbablyAValidSnowflake('invalid')).toBe(false);
		});

		test('returns false for zero', () => {
			expect(isProbablyAValidSnowflake('0')).toBe(false);
		});

		test('returns false for negative number string', () => {
			expect(isProbablyAValidSnowflake('-123')).toBe(false);
		});

		test('returns true for small valid number', () => {
			expect(isProbablyAValidSnowflake('1')).toBe(true);
		});
	});

	describe('sortBySnowflakeDesc', () => {
		test('sorts items by id in descending order', () => {
			const items = [{id: '100'}, {id: '300'}, {id: '200'}];
			const sorted = sortBySnowflakeDesc(items);
			expect(sorted.map((i) => i.id)).toEqual(['300', '200', '100']);
		});

		test('returns empty array for empty input', () => {
			const sorted = sortBySnowflakeDesc([]);
			expect(sorted).toEqual([]);
		});

		test('handles single item', () => {
			const items = [{id: '123'}];
			const sorted = sortBySnowflakeDesc(items);
			expect(sorted).toEqual([{id: '123'}]);
		});

		test('does not mutate original array', () => {
			const items = [{id: '100'}, {id: '200'}];
			const originalItems = [...items];
			sortBySnowflakeDesc(items);
			expect(items).toEqual(originalItems);
		});
	});

	describe('age', () => {
		test('returns age in milliseconds', () => {
			const timestamp = Date.now() - 1000;
			const snowflake = fromTimestamp(timestamp);
			const snowflakeAge = age(snowflake);
			expect(snowflakeAge).toBeGreaterThanOrEqual(1000);
			expect(snowflakeAge).toBeLessThan(2000);
		});

		test('returns 0 for invalid snowflake', () => {
			expect(age('invalid')).toBe(0);
		});
	});

	describe('generateSnowflake', () => {
		test('generates a bigint snowflake', () => {
			const snowflake = generateSnowflake();
			expect(typeof snowflake).toBe('bigint');
			expect(snowflake > BigInt(0)).toBe(true);
		});
	});

	describe('SnowflakeSequence', () => {
		test('starts at 0', () => {
			const seq = new SnowflakeSequence();
			expect(seq.next()).toBe(0);
		});

		test('increments on each call', () => {
			const seq = new SnowflakeSequence();
			expect(seq.next()).toBe(0);
			expect(seq.next()).toBe(1);
			expect(seq.next()).toBe(2);
		});

		test('reset sets sequence back to 0', () => {
			const seq = new SnowflakeSequence();
			seq.next();
			seq.next();
			seq.reset();
			expect(seq.next()).toBe(0);
		});

		test('willOverflowNext returns false when not at limit', () => {
			const seq = new SnowflakeSequence();
			expect(seq.willOverflowNext()).toBe(false);
		});
	});
});
