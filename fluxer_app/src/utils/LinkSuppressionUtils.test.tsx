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

import {isLinkWrappedInAngleBrackets} from '@app/utils/LinkSuppressionUtils';
import {describe, expect, test} from 'vitest';

describe('LinkSuppressionUtils', () => {
	describe('isLinkWrappedInAngleBrackets', () => {
		test('returns true when link is wrapped in angle brackets', () => {
			const content = 'Check this <https://example.com> out';
			const matchStart = 12;
			const matchLength = 19;
			expect(isLinkWrappedInAngleBrackets(content, matchStart, matchLength)).toBe(true);
		});

		test('returns false when link is not wrapped', () => {
			const content = 'Check this https://example.com out';
			const matchStart = 11;
			const matchLength = 19;
			expect(isLinkWrappedInAngleBrackets(content, matchStart, matchLength)).toBe(false);
		});

		test('returns false when only opening bracket exists', () => {
			const content = 'Check this <https://example.com out';
			const matchStart = 12;
			const matchLength = 19;
			expect(isLinkWrappedInAngleBrackets(content, matchStart, matchLength)).toBe(false);
		});

		test('returns false when only closing bracket exists', () => {
			const content = 'Check this https://example.com> out';
			const matchStart = 11;
			const matchLength = 19;
			expect(isLinkWrappedInAngleBrackets(content, matchStart, matchLength)).toBe(false);
		});

		test('returns false when match is at beginning of string', () => {
			const content = 'https://example.com>';
			const matchStart = 0;
			const matchLength = 19;
			expect(isLinkWrappedInAngleBrackets(content, matchStart, matchLength)).toBe(false);
		});

		test('returns false when match extends beyond string end', () => {
			const content = '<https://example.com';
			const matchStart = 1;
			const matchLength = 19;
			expect(isLinkWrappedInAngleBrackets(content, matchStart, matchLength)).toBe(false);
		});

		test('returns false for zero match length', () => {
			const content = '<>';
			const matchStart = 1;
			const matchLength = 0;
			expect(isLinkWrappedInAngleBrackets(content, matchStart, matchLength)).toBe(false);
		});

		test('returns false for negative match length', () => {
			const content = '<test>';
			const matchStart = 1;
			const matchLength = -1;
			expect(isLinkWrappedInAngleBrackets(content, matchStart, matchLength)).toBe(false);
		});

		test('handles link at exact end of string with bracket', () => {
			const content = '<https://example.com>';
			const matchStart = 1;
			const matchLength = 19;
			expect(isLinkWrappedInAngleBrackets(content, matchStart, matchLength)).toBe(true);
		});

		test('handles multiple links, checking first one', () => {
			const content = '<https://first.com> https://second.com';
			const matchStart = 1;
			const matchLength = 17;
			expect(isLinkWrappedInAngleBrackets(content, matchStart, matchLength)).toBe(true);
		});

		test('handles multiple links, checking second one not wrapped', () => {
			const content = '<https://first.com> https://second.com';
			const matchStart = 20;
			const matchLength = 18;
			expect(isLinkWrappedInAngleBrackets(content, matchStart, matchLength)).toBe(false);
		});
	});
});
