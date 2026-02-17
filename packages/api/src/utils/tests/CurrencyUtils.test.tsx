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

import {getCurrency} from '@fluxer/api/src/utils/CurrencyUtils';
import {describe, expect, it} from 'vitest';

describe('getCurrency', () => {
	describe('returns USD for non-EEA countries', () => {
		it('returns USD for United States', () => {
			expect(getCurrency('US')).toBe('USD');
		});

		it('returns USD for Canada', () => {
			expect(getCurrency('CA')).toBe('USD');
		});

		it('returns USD for United Kingdom', () => {
			expect(getCurrency('GB')).toBe('USD');
		});

		it('returns USD for Japan', () => {
			expect(getCurrency('JP')).toBe('USD');
		});

		it('returns USD for Australia', () => {
			expect(getCurrency('AU')).toBe('USD');
		});

		it('returns USD for Switzerland', () => {
			expect(getCurrency('CH')).toBe('USD');
		});
	});

	describe('returns EUR for EEA countries', () => {
		it('returns EUR for Germany', () => {
			expect(getCurrency('DE')).toBe('EUR');
		});

		it('returns EUR for France', () => {
			expect(getCurrency('FR')).toBe('EUR');
		});

		it('returns EUR for Italy', () => {
			expect(getCurrency('IT')).toBe('EUR');
		});

		it('returns EUR for Spain', () => {
			expect(getCurrency('ES')).toBe('EUR');
		});

		it('returns EUR for Netherlands', () => {
			expect(getCurrency('NL')).toBe('EUR');
		});

		it('returns EUR for Belgium', () => {
			expect(getCurrency('BE')).toBe('EUR');
		});

		it('returns EUR for Austria', () => {
			expect(getCurrency('AT')).toBe('EUR');
		});

		it('returns EUR for Portugal', () => {
			expect(getCurrency('PT')).toBe('EUR');
		});

		it('returns EUR for Ireland', () => {
			expect(getCurrency('IE')).toBe('EUR');
		});

		it('returns EUR for Finland', () => {
			expect(getCurrency('FI')).toBe('EUR');
		});

		it('returns EUR for Sweden', () => {
			expect(getCurrency('SE')).toBe('EUR');
		});

		it('returns EUR for Denmark', () => {
			expect(getCurrency('DK')).toBe('EUR');
		});

		it('returns EUR for Poland', () => {
			expect(getCurrency('PL')).toBe('EUR');
		});

		it('returns EUR for Greece', () => {
			expect(getCurrency('GR')).toBe('EUR');
		});

		it('returns EUR for Czech Republic', () => {
			expect(getCurrency('CZ')).toBe('EUR');
		});

		it('returns EUR for Hungary', () => {
			expect(getCurrency('HU')).toBe('EUR');
		});

		it('returns EUR for Romania', () => {
			expect(getCurrency('RO')).toBe('EUR');
		});

		it('returns EUR for Norway (EEA but not EU)', () => {
			expect(getCurrency('NO')).toBe('EUR');
		});

		it('returns EUR for Iceland (EEA but not EU)', () => {
			expect(getCurrency('IS')).toBe('EUR');
		});

		it('returns EUR for Liechtenstein (EEA but not EU)', () => {
			expect(getCurrency('LI')).toBe('EUR');
		});
	});

	describe('handles case insensitivity', () => {
		it('returns EUR for lowercase country code', () => {
			expect(getCurrency('de')).toBe('EUR');
			expect(getCurrency('fr')).toBe('EUR');
		});

		it('returns USD for lowercase non-EEA', () => {
			expect(getCurrency('us')).toBe('USD');
			expect(getCurrency('gb')).toBe('USD');
		});

		it('handles mixed case', () => {
			expect(getCurrency('De')).toBe('EUR');
			expect(getCurrency('dE')).toBe('EUR');
		});
	});

	describe('handles null and undefined', () => {
		it('returns USD for null', () => {
			expect(getCurrency(null)).toBe('USD');
		});

		it('returns USD for undefined', () => {
			expect(getCurrency(undefined)).toBe('USD');
		});
	});

	describe('handles empty and invalid inputs', () => {
		it('returns USD for empty string', () => {
			expect(getCurrency('')).toBe('USD');
		});

		it('returns USD for invalid country code', () => {
			expect(getCurrency('XX')).toBe('USD');
			expect(getCurrency('ZZ')).toBe('USD');
		});

		it('returns USD for numeric strings', () => {
			expect(getCurrency('12')).toBe('USD');
		});
	});

	describe('covers all EEA member states', () => {
		const eeaCountries = [
			'AT',
			'BE',
			'BG',
			'HR',
			'CY',
			'CZ',
			'DK',
			'EE',
			'FI',
			'FR',
			'DE',
			'GR',
			'HU',
			'IE',
			'IT',
			'LV',
			'LT',
			'LU',
			'MT',
			'NL',
			'PL',
			'PT',
			'RO',
			'SK',
			'SI',
			'ES',
			'SE',
			'IS',
			'LI',
			'NO',
		];

		for (const country of eeaCountries) {
			it(`returns EUR for ${country}`, () => {
				expect(getCurrency(country)).toBe('EUR');
			});
		}
	});
});
