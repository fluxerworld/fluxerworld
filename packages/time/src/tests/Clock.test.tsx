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

import type {IClock} from '@fluxer/time/src/Clock';
import {nowMs} from '@fluxer/time/src/Clock';
import {describe, expect, it} from 'vitest';

describe('nowMs', () => {
	it('returns the current time in milliseconds by default', () => {
		const before = Date.now();
		const value = nowMs();
		const after = Date.now();

		expect(value).toBeGreaterThanOrEqual(before);
		expect(value).toBeLessThanOrEqual(after);
	});

	it('reads time from the provided clock', () => {
		const fixedClock: IClock = {
			nowMs(): number {
				return 1735732800000;
			},
		};

		expect(nowMs(fixedClock)).toBe(1735732800000);
	});
});
