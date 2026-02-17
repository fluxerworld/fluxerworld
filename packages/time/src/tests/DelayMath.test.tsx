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

import {computeRemainingDelayMs} from '@fluxer/time/src/DelayMath';
import {describe, expect, it} from 'vitest';

describe('computeRemainingDelayMs', () => {
	it('returns a positive delay when the deadline is in the future', () => {
		expect(
			computeRemainingDelayMs({
				fromMs: 1000,
				toMs: 5000,
			}),
		).toBe(4000);
	});

	it('returns zero when the deadline has passed', () => {
		expect(
			computeRemainingDelayMs({
				fromMs: 5000,
				toMs: 1000,
			}),
		).toBe(0);
	});

	it('throws when the range computes to a non-finite number', () => {
		expect(() =>
			computeRemainingDelayMs({
				fromMs: Number.POSITIVE_INFINITY,
				toMs: 1000,
			}),
		).toThrow('Invalid delay range: fromMs=Infinity, toMs=1000');
	});
});
