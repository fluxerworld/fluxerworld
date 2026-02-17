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

import {getInitialsLength} from '@app/utils/GuildInitialsUtils';
import {describe, expect, test} from 'vitest';

describe('GuildInitialsUtils', () => {
	describe('getInitialsLength', () => {
		test('returns short for empty string', () => {
			expect(getInitialsLength('')).toBe('short');
		});

		test('returns short for single character', () => {
			expect(getInitialsLength('A')).toBe('short');
		});

		test('returns short for two characters', () => {
			expect(getInitialsLength('AB')).toBe('short');
		});

		test('returns medium for three characters', () => {
			expect(getInitialsLength('ABC')).toBe('medium');
		});

		test('returns medium for four characters', () => {
			expect(getInitialsLength('ABCD')).toBe('medium');
		});

		test('returns long for five characters', () => {
			expect(getInitialsLength('ABCDE')).toBe('long');
		});

		test('returns long for many characters', () => {
			expect(getInitialsLength('ABCDEFGH')).toBe('long');
		});

		test('handles lowercase initials', () => {
			expect(getInitialsLength('abc')).toBe('medium');
		});

		test('handles numeric strings', () => {
			expect(getInitialsLength('123')).toBe('medium');
		});
	});
});
