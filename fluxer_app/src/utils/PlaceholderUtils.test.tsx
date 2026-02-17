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

import {getChannelPlaceholder, getDMPlaceholder} from '@app/utils/PlaceholderUtils';
import {describe, expect, test} from 'vitest';

describe('PlaceholderUtils', () => {
	describe('getChannelPlaceholder', () => {
		test('returns full placeholder when within length limit', () => {
			const result = getChannelPlaceholder('general', 'Message #', 50);
			expect(result).toBe('Message #general');
		});

		test('truncates channel name when too long', () => {
			const result = getChannelPlaceholder('very-long-channel-name', 'Message #', 20);
			expect(result.length).toBeLessThanOrEqual(20);
			expect(result.endsWith('...')).toBe(true);
		});

		test('returns only prefix when maxLength equals prefix length', () => {
			const prefix = 'Message #';
			const result = getChannelPlaceholder('general', prefix, prefix.length);
			expect(result).toBe(prefix);
		});

		test('returns only prefix when maxLength is less than prefix length', () => {
			const prefix = 'Message #';
			const result = getChannelPlaceholder('general', prefix, 5);
			expect(result).toBe(prefix);
		});

		test('handles empty channel name', () => {
			const result = getChannelPlaceholder('', 'Message #', 50);
			expect(result).toBe('Message #');
		});

		test('handles empty prefix', () => {
			const result = getChannelPlaceholder('general', '', 50);
			expect(result).toBe('general');
		});

		test('truncates to exact length with ellipsis', () => {
			const result = getChannelPlaceholder('abcdefghij', 'Msg #', 12);
			expect(result.length).toBeLessThanOrEqual(12);
		});
	});

	describe('getDMPlaceholder', () => {
		test('returns full placeholder when within length limit', () => {
			const result = getDMPlaceholder('JohnDoe', 'Message @', 50);
			expect(result).toBe('Message @JohnDoe');
		});

		test('truncates username when too long', () => {
			const result = getDMPlaceholder('VeryLongUsername123456', 'Message @', 20);
			expect(result.length).toBeLessThanOrEqual(20);
			expect(result.endsWith('...')).toBe(true);
		});

		test('returns only prefix when maxLength equals prefix length', () => {
			const prefix = 'Message @';
			const result = getDMPlaceholder('JohnDoe', prefix, prefix.length);
			expect(result).toBe(prefix);
		});

		test('returns only prefix when maxLength is less than prefix length', () => {
			const prefix = 'Message @';
			const result = getDMPlaceholder('JohnDoe', prefix, 5);
			expect(result).toBe(prefix);
		});

		test('handles empty username', () => {
			const result = getDMPlaceholder('', 'Message @', 50);
			expect(result).toBe('Message @');
		});

		test('handles empty prefix', () => {
			const result = getDMPlaceholder('JohnDoe', '', 50);
			expect(result).toBe('JohnDoe');
		});

		test('handles username with special characters', () => {
			const result = getDMPlaceholder('User_123', 'DM to ', 50);
			expect(result).toBe('DM to User_123');
		});

		test('truncates correctly near boundary', () => {
			const result = getDMPlaceholder('abcd', 'To ', 6);
			expect(result).toBe('To abc');
		});

		test('handles very short maxLength with space for one char', () => {
			const result = getDMPlaceholder('test', 'To ', 4);
			expect(result).toBe('To t');
		});

		test('returns only prefix when no space for name', () => {
			const result = getDMPlaceholder('test', 'To ', 3);
			expect(result).toBe('To ');
		});

		test('handles zero maxLength for truncation edge case', () => {
			const result = getDMPlaceholder('test', '', 0);
			expect(result).toBe('');
		});

		test('handles negative available length after prefix', () => {
			const result = getDMPlaceholder('test', 'Very Long Prefix', 5);
			expect(result).toBe('Very Long Prefix');
		});

		test('truncates with ellipsis when maxLength allows', () => {
			const result = getChannelPlaceholder('very-long-name', '', 7);
			expect(result).toBe('very...');
		});

		test('truncates without ellipsis when maxLength is 3 or less', () => {
			const result = getChannelPlaceholder('abcde', '', 3);
			expect(result).toBe('abc');
		});

		test('returns full name when exactly at maxLength', () => {
			const result = getChannelPlaceholder('test', '', 4);
			expect(result).toBe('test');
		});
	});
});
