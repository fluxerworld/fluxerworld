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

import {toIdString, toSortedIdArray} from '@fluxer/api/src/utils/IdUtils';
import {describe, expect, it} from 'vitest';

describe('toIdString', () => {
	it('returns null for null input', () => {
		expect(toIdString(null)).toBeNull();
	});

	it('returns null for undefined input', () => {
		expect(toIdString(undefined)).toBeNull();
	});

	it('converts bigint to string', () => {
		expect(toIdString(123456789012345678n)).toBe('123456789012345678');
	});

	it('converts string to string (passthrough)', () => {
		expect(toIdString('123456789012345678')).toBe('123456789012345678');
	});

	it('handles zero bigint', () => {
		expect(toIdString(0n)).toBe('0');
	});

	it('handles very large bigints', () => {
		const large = 999999999999999999999999999999n;
		expect(toIdString(large)).toBe(large.toString());
	});

	it('handles negative bigints', () => {
		expect(toIdString(-1n)).toBe('-1');
	});

	it('preserves numeric string exactly', () => {
		expect(toIdString('0')).toBe('0');
		expect(toIdString('00123')).toBe('00123');
	});
});

describe('toSortedIdArray', () => {
	it('returns empty array for null input', () => {
		expect(toSortedIdArray(null)).toEqual([]);
	});

	it('returns empty array for undefined input', () => {
		expect(toSortedIdArray(undefined)).toEqual([]);
	});

	it('returns empty array for empty array input', () => {
		expect(toSortedIdArray([])).toEqual([]);
	});

	it('converts and sorts array of bigints', () => {
		const input = [300n, 100n, 200n];
		expect(toSortedIdArray(input)).toEqual(['100', '200', '300']);
	});

	it('converts and sorts array of strings', () => {
		const input = ['300', '100', '200'];
		expect(toSortedIdArray(input)).toEqual(['100', '200', '300']);
	});

	it('converts Set to sorted array', () => {
		const input = new Set([300n, 100n, 200n]);
		expect(toSortedIdArray(input)).toEqual(['100', '200', '300']);
	});

	it('handles single element array', () => {
		expect(toSortedIdArray([42n])).toEqual(['42']);
	});

	it('handles already sorted input', () => {
		const input = [100n, 200n, 300n];
		expect(toSortedIdArray(input)).toEqual(['100', '200', '300']);
	});

	it('handles reverse sorted input', () => {
		const input = [300n, 200n, 100n];
		expect(toSortedIdArray(input)).toEqual(['100', '200', '300']);
	});

	it('sorts lexicographically (string sort)', () => {
		const input = [2n, 10n, 1n];
		expect(toSortedIdArray(input)).toEqual(['1', '10', '2']);
	});

	it('handles duplicates in input array', () => {
		const input = [100n, 100n, 200n];
		expect(toSortedIdArray(input)).toEqual(['100', '100', '200']);
	});

	it('handles Set with single element', () => {
		const input = new Set([123n]);
		expect(toSortedIdArray(input)).toEqual(['123']);
	});

	it('handles empty Set', () => {
		const input = new Set<bigint>();
		expect(toSortedIdArray(input)).toEqual([]);
	});
});
