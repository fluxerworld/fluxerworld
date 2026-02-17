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

import {formatFileSize} from '@app/utils/FileUtils';
import {describe, expect, test} from 'vitest';

describe('FileUtils', () => {
	describe('formatFileSize', () => {
		test('returns 0 B for zero bytes', () => {
			expect(formatFileSize(0)).toBe('0 B');
		});

		test('formats bytes correctly', () => {
			expect(formatFileSize(500)).toBe('500 B');
		});

		test('formats small byte values', () => {
			expect(formatFileSize(1)).toBe('1 B');
		});

		test('formats kilobytes correctly', () => {
			expect(formatFileSize(1024)).toBe('1 KB');
		});

		test('formats kilobytes with decimal', () => {
			expect(formatFileSize(1536)).toBe('1.5 KB');
		});

		test('formats megabytes correctly', () => {
			expect(formatFileSize(1024 * 1024)).toBe('1 MB');
		});

		test('formats megabytes with decimal', () => {
			expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
		});

		test('formats gigabytes correctly', () => {
			expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
		});

		test('formats gigabytes with decimal', () => {
			expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB');
		});

		test('formats 25MB attachment size', () => {
			expect(formatFileSize(25 * 1024 * 1024)).toBe('25 MB');
		});

		test('formats 500MB attachment size', () => {
			expect(formatFileSize(500 * 1024 * 1024)).toBe('500 MB');
		});

		test('rounds to one decimal place', () => {
			expect(formatFileSize(1234)).toBe('1.2 KB');
		});

		test('handles values just under 1KB', () => {
			expect(formatFileSize(1023)).toBe('1023 B');
		});

		test('handles large byte values below 1KB', () => {
			expect(formatFileSize(512)).toBe('512 B');
		});
	});
});
