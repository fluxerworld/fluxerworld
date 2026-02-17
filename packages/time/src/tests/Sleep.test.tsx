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

import {sleepMs} from '@fluxer/time/src/Sleep';
import {describe, expect, it} from 'vitest';

describe('sleepMs', () => {
	it('resolves after approximately the provided duration', async () => {
		const startMs = Date.now();
		await sleepMs(50);
		const elapsedMs = Date.now() - startMs;

		expect(elapsedMs).toBeGreaterThanOrEqual(45);
		expect(elapsedMs).toBeLessThan(150);
	});

	it('clamps negative durations to zero', async () => {
		const startMs = Date.now();
		await sleepMs(-10);
		const elapsedMs = Date.now() - startMs;

		expect(elapsedMs).toBeLessThan(50);
	});

	it('throws for non-finite inputs', () => {
		expect(() => sleepMs(Number.POSITIVE_INFINITY)).toThrow('Invalid sleep duration milliseconds: Infinity');
	});
});
