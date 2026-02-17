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

import {isRegionCode, normalizeRegionCode} from '@fluxer/geo_utils/src/RegionCodeValidation';
import {describe, expect, it} from 'vitest';

describe('normalizeRegionCode', () => {
	it('returns uppercase for valid lowercase codes', () => {
		expect(normalizeRegionCode('us')).toBe('US');
		expect(normalizeRegionCode('gb')).toBe('GB');
		expect(normalizeRegionCode('fr')).toBe('FR');
	});

	it('returns uppercase for already uppercase codes', () => {
		expect(normalizeRegionCode('US')).toBe('US');
		expect(normalizeRegionCode('DE')).toBe('DE');
	});

	it('handles mixed case', () => {
		expect(normalizeRegionCode('Us')).toBe('US');
		expect(normalizeRegionCode('gB')).toBe('GB');
	});

	it('trims whitespace', () => {
		expect(normalizeRegionCode(' US ')).toBe('US');
		expect(normalizeRegionCode('\tFR\n')).toBe('FR');
	});

	it('returns undefined for empty string', () => {
		expect(normalizeRegionCode('')).toBeUndefined();
	});

	it('returns undefined for single character', () => {
		expect(normalizeRegionCode('U')).toBeUndefined();
	});

	it('returns undefined for three or more characters', () => {
		expect(normalizeRegionCode('USA')).toBeUndefined();
		expect(normalizeRegionCode('ABCD')).toBeUndefined();
	});

	it('returns undefined for non-alpha characters', () => {
		expect(normalizeRegionCode('12')).toBeUndefined();
		expect(normalizeRegionCode('A1')).toBeUndefined();
		expect(normalizeRegionCode('!@')).toBeUndefined();
	});

	it('returns undefined for whitespace-only input', () => {
		expect(normalizeRegionCode('   ')).toBeUndefined();
	});
});

describe('isRegionCode', () => {
	it('returns true for valid region codes', () => {
		expect(isRegionCode('US')).toBe(true);
		expect(isRegionCode('gb')).toBe(true);
		expect(isRegionCode(' FR ')).toBe(true);
	});

	it('returns false for invalid values', () => {
		expect(isRegionCode('')).toBe(false);
		expect(isRegionCode('USA')).toBe(false);
		expect(isRegionCode('1')).toBe(false);
		expect(isRegionCode('12')).toBe(false);
	});
});
