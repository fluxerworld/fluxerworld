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

import {createCalculator, MediaDimensionCalculator} from '@app/utils/DimensionUtils';
import {describe, expect, test} from 'vitest';

describe('DimensionUtils', () => {
	describe('MediaDimensionCalculator', () => {
		describe('calculate with preserve option', () => {
			test('preserves original dimensions', () => {
				const calculator = new MediaDimensionCalculator();
				const result = calculator.calculate({width: 800, height: 600}, {preserve: true});

				expect(result.dimensions).toEqual({width: 800, height: 600});
				expect(result.scale).toBe(1);
				expect(result.style.width).toBe(800);
				expect(result.style.aspectRatio).toBe('800/600');
			});
		});

		describe('calculate with forceScale option', () => {
			test('scales down large image to fit within constraints', () => {
				const calculator = new MediaDimensionCalculator();
				const result = calculator.calculate(
					{width: 1100, height: 800},
					{forceScale: true, maxWidth: 550, maxHeight: 400},
				);

				expect(result.dimensions.width).toBeLessThanOrEqual(550);
				expect(result.dimensions.height).toBeLessThanOrEqual(400);
				expect(result.scale).toBeLessThan(1);
			});

			test('does not scale up small image', () => {
				const calculator = new MediaDimensionCalculator();
				const result = calculator.calculate(
					{width: 200, height: 150},
					{forceScale: true, maxWidth: 550, maxHeight: 400},
				);

				expect(result.dimensions).toEqual({width: 200, height: 150});
				expect(result.scale).toBe(1);
			});

			test('maintains aspect ratio when scaling', () => {
				const calculator = new MediaDimensionCalculator();
				const result = calculator.calculate(
					{width: 1000, height: 500},
					{forceScale: true, maxWidth: 500, maxHeight: 400},
				);

				const originalAspect = 1000 / 500;
				const scaledAspect = result.dimensions.width / result.dimensions.height;
				expect(Math.abs(originalAspect - scaledAspect)).toBeLessThan(0.01);
			});
		});

		describe('calculate with responsive dimensions', () => {
			test('calculates responsive dimensions for landscape image', () => {
				const calculator = new MediaDimensionCalculator();
				const result = calculator.calculate({width: 800, height: 400}, {responsive: true});

				expect(result.style.maxWidth).toBeDefined();
				expect(result.style.width).toBe('100%');
			});

			test('calculates responsive dimensions for portrait image', () => {
				const calculator = new MediaDimensionCalculator();
				const result = calculator.calculate({width: 400, height: 800}, {responsive: true});

				expect(result.style.maxWidth).toBeDefined();
			});

			test('handles square images', () => {
				const calculator = new MediaDimensionCalculator();
				const result = calculator.calculate({width: 500, height: 500}, {responsive: true});

				expect(result.dimensions).toBeDefined();
				expect(result.scale).toBeDefined();
			});
		});

		describe('calculateImage', () => {
			test('calculates image dimensions without forceScale', () => {
				const calculator = new MediaDimensionCalculator();
				const result = calculator.calculateImage({width: 800, height: 600});

				expect(result.dimensions).toBeDefined();
				expect(result.style).toBeDefined();
			});
		});

		describe('calculateVideo', () => {
			test('calculates video dimensions without preserve', () => {
				const calculator = new MediaDimensionCalculator();
				const result = calculator.calculateVideo({width: 1920, height: 1080});

				expect(result.dimensions).toBeDefined();
				expect(result.style).toBeDefined();
			});
		});

		describe('static scale method', () => {
			test('scales dimensions to fit within constraints', () => {
				const [width, height] = MediaDimensionCalculator.scale(1000, 800, 500, 400);

				expect(width).toBeLessThanOrEqual(500);
				expect(height).toBeLessThanOrEqual(400);
			});

			test('uses default max dimensions when not provided', () => {
				const [width, height] = MediaDimensionCalculator.scale(1000, 800);

				expect(width).toBeLessThanOrEqual(550);
				expect(height).toBeLessThanOrEqual(400);
			});

			test('does not scale up smaller images', () => {
				const [width, height] = MediaDimensionCalculator.scale(100, 50, 500, 400);

				expect(width).toBe(100);
				expect(height).toBe(50);
			});

			test('maintains aspect ratio', () => {
				const [width, height] = MediaDimensionCalculator.scale(1600, 900, 800, 600);

				const originalAspect = 1600 / 900;
				const scaledAspect = width / height;
				expect(Math.abs(originalAspect - scaledAspect)).toBeLessThan(0.02);
			});
		});
	});

	describe('createCalculator', () => {
		test('creates a new calculator with default options', () => {
			const calculator = createCalculator();
			expect(calculator).toBeInstanceOf(MediaDimensionCalculator);
		});

		test('creates a calculator with custom options', () => {
			const calculator = createCalculator({maxWidth: 300, maxHeight: 200});
			const result = calculator.calculate({width: 600, height: 400}, {forceScale: true});

			expect(result.dimensions.width).toBeLessThanOrEqual(300);
			expect(result.dimensions.height).toBeLessThanOrEqual(200);
		});
	});
});
