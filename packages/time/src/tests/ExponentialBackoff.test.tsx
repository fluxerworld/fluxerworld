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

import {computeExponentialBackoffSeconds, DefaultExponentialBackoffPolicy} from '@fluxer/time/src/ExponentialBackoff';
import {describe, expect, it} from 'vitest';

describe('computeExponentialBackoffSeconds', () => {
	it('computes exponential backoff with the default policy', () => {
		expect(computeExponentialBackoffSeconds({attemptCount: 0})).toBe(1);
		expect(computeExponentialBackoffSeconds({attemptCount: 1})).toBe(2);
		expect(computeExponentialBackoffSeconds({attemptCount: 2})).toBe(4);
		expect(computeExponentialBackoffSeconds({attemptCount: 9})).toBe(512);
	});

	it('caps the backoff with the default maximum', () => {
		expect(computeExponentialBackoffSeconds({attemptCount: 10})).toBe(600);
		expect(computeExponentialBackoffSeconds({attemptCount: 100})).toBe(600);
	});

	it('normalizes invalid attempt values', () => {
		expect(computeExponentialBackoffSeconds({attemptCount: -3})).toBe(1);
		expect(computeExponentialBackoffSeconds({attemptCount: Number.NaN})).toBe(1);
	});

	it('accepts custom policies', () => {
		expect(
			computeExponentialBackoffSeconds({
				attemptCount: 4,
				policy: {
					...DefaultExponentialBackoffPolicy,
					baseSeconds: 3,
					maximumSeconds: 25,
				},
			}),
		).toBe(25);
	});

	it('throws when policy values are invalid', () => {
		expect(() =>
			computeExponentialBackoffSeconds({
				attemptCount: 1,
				policy: {
					baseSeconds: 1,
					minimumSeconds: 10,
					maximumSeconds: 5,
					maxExponent: 30,
				},
			}),
		).toThrow('Invalid exponential backoff policy: maximumSeconds(5) is smaller than minimumSeconds(10)');
	});
});
