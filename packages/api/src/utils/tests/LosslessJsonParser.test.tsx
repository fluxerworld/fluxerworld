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

import {parseJsonPreservingLargeIntegers} from '@fluxer/api/src/utils/LosslessJsonParser';
import {describe, expect, it} from 'vitest';

describe('parseJsonPreservingLargeIntegers', () => {
	it('keeps safe integers as numbers', () => {
		const parsed = parseJsonPreservingLargeIntegers('{"id":9007199254740991}') as {id: unknown};
		expect(parsed.id).toBe(9007199254740991);
		expect(typeof parsed.id).toBe('number');
	});

	it('converts unsafe integers to strings', () => {
		const parsed = parseJsonPreservingLargeIntegers('{"id":9007199254740992}') as {id: unknown};
		expect(parsed.id).toBe('9007199254740992');
		expect(typeof parsed.id).toBe('string');
	});

	it('preserves floating point numbers', () => {
		const parsed = parseJsonPreservingLargeIntegers('{"took":0.062,"id":1472109478688579732}') as {
			took: unknown;
			id: unknown;
		};
		expect(parsed.took).toBe(0.062);
		expect(typeof parsed.took).toBe('number');
		expect(parsed.id).toBe('1472109478688579732');
	});

	it('does not touch numbers inside strings', () => {
		const parsed = parseJsonPreservingLargeIntegers('{"id":"1472109478688579732"}') as {id: unknown};
		expect(parsed.id).toBe('1472109478688579732');
	});

	it('handles arrays of values', () => {
		const parsed = parseJsonPreservingLargeIntegers('{"arr":[1,1472109478688579732]}') as {arr: Array<unknown>};
		expect(parsed.arr[0]).toBe(1);
		expect(parsed.arr[1]).toBe('1472109478688579732');
	});
});
