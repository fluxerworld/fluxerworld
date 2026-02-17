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

import {getRegionDisplayName, getRegionDisplayNames} from '@fluxer/geo_utils/src/RegionFormatting';
import {describe, expect, it} from 'vitest';

describe('getRegionDisplayName', () => {
	it('returns display name for valid region code', () => {
		expect(getRegionDisplayName('US')).toBe('United States');
		expect(getRegionDisplayName('GB')).toBe('United Kingdom');
	});

	it('returns undefined for unknown region code without fallback', () => {
		expect(getRegionDisplayName('XX')).toBeUndefined();
	});

	it('returns region code when fallbackToRegionCode is enabled', () => {
		expect(getRegionDisplayName('XX', {fallbackToRegionCode: true})).toBe('XX');
	});

	it('normalizes and returns fallback for lowercase unknown codes', () => {
		expect(getRegionDisplayName('xx', {fallbackToRegionCode: true})).toBe('XX');
	});

	it('returns undefined for empty string even with fallback', () => {
		expect(getRegionDisplayName('', {fallbackToRegionCode: true})).toBeUndefined();
	});

	it('returns undefined for whitespace-only even with fallback', () => {
		expect(getRegionDisplayName('   ', {fallbackToRegionCode: true})).toBeUndefined();
	});

	it('respects locale option', () => {
		expect(getRegionDisplayName('DE', {locale: 'fr'})).toBe('Allemagne');
	});

	it('uses en-US by default', () => {
		expect(getRegionDisplayName('JP')).toBe('Japan');
	});
});

describe('getRegionDisplayNames', () => {
	it('returns display names for multiple valid codes', () => {
		const result = getRegionDisplayNames(['US', 'FR', 'DE']);
		expect(result).toEqual(['United States', 'France', 'Germany']);
	});

	it('returns undefined for invalid codes without fallback', () => {
		const result = getRegionDisplayNames(['US', 'XX']);
		expect(result).toEqual(['United States', undefined]);
	});

	it('returns fallback codes when enabled', () => {
		const result = getRegionDisplayNames(['US', 'XX'], {fallbackToRegionCode: true});
		expect(result).toEqual(['United States', 'XX']);
	});

	it('respects locale for all entries', () => {
		const result = getRegionDisplayNames(['US', 'DE'], {locale: 'fr'});
		expect(result).toEqual(['États-Unis', 'Allemagne']);
	});

	it('returns empty array for empty input', () => {
		expect(getRegionDisplayNames([])).toEqual([]);
	});
});
