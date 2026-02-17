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

import {calculateAge, isUserAdult} from '@fluxer/api/src/utils/AgeUtils';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

describe('calculateAge', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 0, 24));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('with object input', () => {
		it('calculates age for birthday earlier this year', () => {
			expect(calculateAge({year: 2000, month: 1, day: 1})).toBe(26);
		});

		it('calculates age for birthday later this year', () => {
			expect(calculateAge({year: 2000, month: 12, day: 31})).toBe(25);
		});

		it('calculates age for birthday today', () => {
			expect(calculateAge({year: 2000, month: 1, day: 24})).toBe(26);
		});

		it('calculates age for birthday yesterday', () => {
			expect(calculateAge({year: 2000, month: 1, day: 23})).toBe(26);
		});

		it('calculates age for birthday tomorrow', () => {
			expect(calculateAge({year: 2000, month: 1, day: 25})).toBe(25);
		});

		it('calculates age for same month different day (before)', () => {
			expect(calculateAge({year: 2000, month: 1, day: 1})).toBe(26);
		});

		it('calculates age for same month different day (after)', () => {
			expect(calculateAge({year: 2000, month: 1, day: 31})).toBe(25);
		});

		it('handles leap year birthday on non-leap year', () => {
			expect(calculateAge({year: 2004, month: 2, day: 29})).toBe(21);
		});

		it('calculates age of 0 for person born this year', () => {
			expect(calculateAge({year: 2026, month: 1, day: 1})).toBe(0);
		});

		it('calculates age of 0 for person born later this year', () => {
			expect(calculateAge({year: 2026, month: 6, day: 15})).toBe(-1);
		});

		it('calculates age for very old dates', () => {
			expect(calculateAge({year: 1926, month: 1, day: 1})).toBe(100);
		});
	});

	describe('with string input', () => {
		it('parses and calculates age from ISO date string', () => {
			expect(calculateAge('2000-01-01')).toBe(26);
		});

		it('parses date string with birthday later this year', () => {
			expect(calculateAge('2000-12-31')).toBe(25);
		});

		it('parses date string with birthday today', () => {
			expect(calculateAge('2000-01-24')).toBe(26);
		});

		it('parses date string with leading zeros', () => {
			expect(calculateAge('2000-01-05')).toBe(26);
		});
	});

	describe('boundary conditions', () => {
		it('handles end of year birthday', () => {
			expect(calculateAge({year: 2000, month: 12, day: 31})).toBe(25);
		});

		it('handles start of year birthday', () => {
			expect(calculateAge({year: 2000, month: 1, day: 1})).toBe(26);
		});

		it('handles birthday on current date exactly', () => {
			expect(calculateAge({year: 2008, month: 1, day: 24})).toBe(18);
		});
	});
});

describe('isUserAdult', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 0, 24));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('with object input', () => {
		it('returns true for person exactly 18', () => {
			expect(isUserAdult({year: 2008, month: 1, day: 24})).toBe(true);
		});

		it('returns true for person over 18', () => {
			expect(isUserAdult({year: 2000, month: 1, day: 1})).toBe(true);
		});

		it('returns false for person almost 18', () => {
			expect(isUserAdult({year: 2008, month: 1, day: 25})).toBe(false);
		});

		it('returns false for person under 18', () => {
			expect(isUserAdult({year: 2010, month: 6, day: 15})).toBe(false);
		});

		it('returns true for very old person', () => {
			expect(isUserAdult({year: 1926, month: 1, day: 1})).toBe(true);
		});
	});

	describe('with string input', () => {
		it('returns true for adult with string date', () => {
			expect(isUserAdult('2000-01-01')).toBe(true);
		});

		it('returns false for minor with string date', () => {
			expect(isUserAdult('2010-06-15')).toBe(false);
		});

		it('handles exactly 18 with string date', () => {
			expect(isUserAdult('2008-01-24')).toBe(true);
		});
	});

	describe('handles null and undefined', () => {
		it('returns false for null', () => {
			expect(isUserAdult(null)).toBe(false);
		});

		it('returns false for undefined', () => {
			expect(isUserAdult(undefined)).toBe(false);
		});
	});

	describe('boundary on 18th birthday', () => {
		it('returns true on 18th birthday', () => {
			expect(isUserAdult({year: 2008, month: 1, day: 24})).toBe(true);
		});

		it('returns false one day before 18th birthday', () => {
			expect(isUserAdult({year: 2008, month: 1, day: 25})).toBe(false);
		});

		it('returns true one day after 18th birthday', () => {
			expect(isUserAdult({year: 2008, month: 1, day: 23})).toBe(true);
		});
	});
});
