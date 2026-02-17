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

import {getGroupDMAccentColor} from '@app/utils/GroupDMColorUtils';
import {describe, expect, test} from 'vitest';

describe('GroupDMColorUtils', () => {
	describe('getGroupDMAccentColor', () => {
		const validColors = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#9B59B6'];

		test('returns a valid color for a channel ID', () => {
			const color = getGroupDMAccentColor('123456789');
			expect(validColors).toContain(color);
		});

		test('returns consistent color for same channel ID', () => {
			const channelId = '987654321';
			const color1 = getGroupDMAccentColor(channelId);
			const color2 = getGroupDMAccentColor(channelId);
			expect(color1).toBe(color2);
		});

		test('returns first color for empty channel ID', () => {
			const color = getGroupDMAccentColor('');
			expect(color).toBe('#5865F2');
		});

		test('different channel IDs can produce different colors', () => {
			const colors = new Set<string>();
			for (let i = 0; i < 100; i++) {
				colors.add(getGroupDMAccentColor(`channel-${i}`));
			}
			expect(colors.size).toBeGreaterThan(1);
		});

		test('produces colors from the predefined palette', () => {
			for (let i = 0; i < 50; i++) {
				const color = getGroupDMAccentColor(`test-channel-${i}`);
				expect(validColors).toContain(color);
			}
		});

		test('handles numeric string channel IDs', () => {
			const color = getGroupDMAccentColor('1234567890123456789');
			expect(validColors).toContain(color);
		});

		test('handles single character channel ID', () => {
			const color = getGroupDMAccentColor('a');
			expect(validColors).toContain(color);
		});

		test('handles long channel ID', () => {
			const color = getGroupDMAccentColor('a'.repeat(100));
			expect(validColors).toContain(color);
		});
	});
});
