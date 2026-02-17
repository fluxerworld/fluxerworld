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

import {
	buildMemberListLayout,
	getMemberIndexForRow,
	getMemberIndexRangeForRowRange,
	getRowIndexForMemberIndex,
	getRowIndexRangeForMemberIndexRange,
	getTotalRowsFromLayout,
} from '@app/utils/MemberListLayout';
import {describe, expect, test} from 'vitest';

describe('MemberListLayout', () => {
	test('builds row and member indices for group layouts', () => {
		const layouts = buildMemberListLayout([
			{id: 'online', count: 2},
			{id: 'offline', count: 1},
		]);

		expect(layouts).toHaveLength(2);
		expect(layouts[0]?.headerRowIndex).toBe(0);
		expect(layouts[0]?.memberStartIndex).toBe(0);
		expect(layouts[0]?.memberEndIndex).toBe(1);
		expect(layouts[1]?.headerRowIndex).toBe(3);
		expect(layouts[1]?.memberStartIndex).toBe(2);
		expect(layouts[1]?.memberEndIndex).toBe(2);
		expect(getTotalRowsFromLayout(layouts)).toBe(5);
	});

	test('maps row indices to member indices', () => {
		const layouts = buildMemberListLayout([
			{id: 'online', count: 2},
			{id: 'offline', count: 1},
		]);

		expect(getMemberIndexForRow(layouts, 0, 'forward')).toBe(0);
		expect(getMemberIndexForRow(layouts, 1, 'forward')).toBe(0);
		expect(getMemberIndexForRow(layouts, 2, 'forward')).toBe(1);
		expect(getMemberIndexForRow(layouts, 3, 'forward')).toBe(2);
	});

	test('derives member index ranges from row ranges', () => {
		const layouts = buildMemberListLayout([
			{id: 'online', count: 1},
			{id: 'offline', count: 2},
		]);

		expect(getMemberIndexRangeForRowRange(layouts, 0, 2)).toEqual([0, 0]);
		expect(getMemberIndexRangeForRowRange(layouts, 1, 4)).toEqual([0, 2]);
	});

	test('maps member indices back to row indices', () => {
		const layouts = buildMemberListLayout([
			{id: 'online', count: 2},
			{id: 'offline', count: 1},
		]);

		expect(getRowIndexForMemberIndex(layouts, 0)).toBe(1);
		expect(getRowIndexForMemberIndex(layouts, 1)).toBe(2);
		expect(getRowIndexForMemberIndex(layouts, 2)).toBe(4);
	});

	test('derives row index ranges from member ranges', () => {
		const layouts = buildMemberListLayout([
			{id: 'online', count: 1},
			{id: 'offline', count: 2},
		]);

		expect(getRowIndexRangeForMemberIndexRange(layouts, 0, 0)).toEqual([1, 1]);
		expect(getRowIndexRangeForMemberIndexRange(layouts, 0, 2)).toEqual([1, 4]);
	});
});
