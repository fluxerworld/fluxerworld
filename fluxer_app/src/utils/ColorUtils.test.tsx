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

import {getBestContrastColor, int2hex, int2rgb, int2rgba} from '@app/utils/ColorUtils';
import {describe, expect, test} from 'vitest';

describe('ColorUtils', () => {
	describe('int2hex', () => {
		test('converts red to hex', () => {
			expect(int2hex(0xff0000)).toBe('#ff0000');
		});

		test('converts green to hex', () => {
			expect(int2hex(0x00ff00)).toBe('#00ff00');
		});

		test('converts blue to hex', () => {
			expect(int2hex(0x0000ff)).toBe('#0000ff');
		});

		test('converts white to hex', () => {
			expect(int2hex(0xffffff)).toBe('#ffffff');
		});

		test('converts black to hex', () => {
			expect(int2hex(0x000000)).toBe('#000000');
		});

		test('pads single digit values with zeros', () => {
			expect(int2hex(0x010203)).toBe('#010203');
		});

		test('converts arbitrary color to hex', () => {
			expect(int2hex(0x5865f2)).toBe('#5865f2');
		});
	});

	describe('int2rgba', () => {
		test('converts color to rgba with default alpha from color int', () => {
			const colorWithAlpha = (0x80 << 24) | 0xff0000;
			const result = int2rgba(colorWithAlpha);
			expect(result).toMatch(/^rgba\(255, 0, 0, 0\.5/);
		});

		test('converts color to rgba with provided alpha', () => {
			expect(int2rgba(0xff0000, 0.5)).toBe('rgba(255, 0, 0, 0.5)');
		});

		test('converts green to rgba', () => {
			expect(int2rgba(0x00ff00, 1)).toBe('rgba(0, 255, 0, 1)');
		});

		test('converts blue to rgba', () => {
			expect(int2rgba(0x0000ff, 0)).toBe('rgba(0, 0, 255, 0)');
		});

		test('handles zero color with alpha', () => {
			expect(int2rgba(0x000000, 0.75)).toBe('rgba(0, 0, 0, 0.75)');
		});
	});

	describe('int2rgb', () => {
		test('converts red to rgb', () => {
			expect(int2rgb(0xff0000)).toBe('rgb(255, 0, 0)');
		});

		test('converts green to rgb', () => {
			expect(int2rgb(0x00ff00)).toBe('rgb(0, 255, 0)');
		});

		test('converts blue to rgb', () => {
			expect(int2rgb(0x0000ff)).toBe('rgb(0, 0, 255)');
		});

		test('returns default gray for zero color', () => {
			expect(int2rgb(0x000000)).toBe('rgb(219, 222, 225)');
		});

		test('converts white to rgb', () => {
			expect(int2rgb(0xffffff)).toBe('rgb(255, 255, 255)');
		});
	});

	describe('getBestContrastColor', () => {
		test('returns black for white background', () => {
			expect(getBestContrastColor(0xffffff)).toBe('black');
		});

		test('returns white for black background', () => {
			expect(getBestContrastColor(0x000001)).toBe('white');
		});

		test('returns black for zero (default handling)', () => {
			expect(getBestContrastColor(0x000000)).toBe('black');
		});

		test('returns black for light yellow', () => {
			expect(getBestContrastColor(0xffff00)).toBe('black');
		});

		test('returns white for dark blue', () => {
			expect(getBestContrastColor(0x000080)).toBe('white');
		});

		test('returns white for red', () => {
			expect(getBestContrastColor(0xff0000)).toBe('white');
		});

		test('returns black for light green', () => {
			expect(getBestContrastColor(0x90ee90)).toBe('black');
		});

		test('returns white for dark purple', () => {
			expect(getBestContrastColor(0x800080)).toBe('white');
		});

		test('returns black for light gray', () => {
			expect(getBestContrastColor(0xcccccc)).toBe('black');
		});

		test('returns white for dark gray', () => {
			expect(getBestContrastColor(0x333333)).toBe('white');
		});
	});
});
