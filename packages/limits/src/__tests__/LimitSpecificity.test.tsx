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

import {calculateSpecificity, compareSpecificity} from '@fluxer/limits/src/LimitSpecificity';
import {describe, expect, test} from 'vitest';

describe('LimitSpecificity', () => {
	test('calculateSpecificity returns 0 for undefined filters', () => {
		expect(calculateSpecificity(undefined)).toBe(0);
	});

	test('calculateSpecificity returns 0 for empty filters', () => {
		expect(calculateSpecificity({})).toBe(0);
	});

	test('calculateSpecificity counts traits', () => {
		expect(calculateSpecificity({traits: ['premium']})).toBe(1);
		expect(calculateSpecificity({traits: ['premium', 'verified']})).toBe(2);
	});

	test('calculateSpecificity counts guild features', () => {
		expect(calculateSpecificity({guildFeatures: ['MORE_EMOJI']})).toBe(1);
		expect(calculateSpecificity({guildFeatures: ['MORE_EMOJI', 'MORE_STICKERS']})).toBe(2);
	});

	test('calculateSpecificity counts combined traits and guild features', () => {
		expect(calculateSpecificity({traits: ['premium'], guildFeatures: ['MORE_EMOJI']})).toBe(2);
		expect(
			calculateSpecificity({
				traits: ['premium', 'verified'],
				guildFeatures: ['MORE_EMOJI', 'MORE_STICKERS'],
			}),
		).toBe(4);
	});

	test('compareSpecificity returns negative when a is less specific', () => {
		expect(compareSpecificity(undefined, {traits: ['premium']})).toBeLessThan(0);
		expect(compareSpecificity({traits: ['premium']}, {traits: ['premium', 'verified']})).toBeLessThan(0);
	});

	test('compareSpecificity returns 0 when equal specificity', () => {
		expect(compareSpecificity(undefined, undefined)).toBe(0);
		expect(compareSpecificity({traits: ['premium']}, {traits: ['verified']})).toBe(0);
	});

	test('compareSpecificity returns positive when a is more specific', () => {
		expect(compareSpecificity({traits: ['premium']}, undefined)).toBeGreaterThan(0);
		expect(compareSpecificity({traits: ['premium', 'verified']}, {traits: ['premium']})).toBeGreaterThan(0);
	});
});
