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

export interface MemberListGroupSnapshot {
	id: string;
	count: number;
}

export interface MemberListGroupLayout {
	id: string;
	count: number;
	headerRowIndex: number;
	memberStartIndex: number;
	memberEndIndex: number;
	rowEndIndex: number;
}

type RowSeekDirection = 'backward' | 'forward';

export function buildMemberListLayout(groups: ReadonlyArray<MemberListGroupSnapshot>): Array<MemberListGroupLayout> {
	const layouts: Array<MemberListGroupLayout> = [];
	let rowIndex = 0;
	let memberIndex = 0;

	for (const group of groups) {
		if (group.count <= 0) {
			continue;
		}

		const headerRowIndex = rowIndex;
		const memberStartIndex = memberIndex;
		const memberEndIndex = memberIndex + group.count - 1;
		const rowEndIndex = headerRowIndex + group.count;

		layouts.push({
			id: group.id,
			count: group.count,
			headerRowIndex,
			memberStartIndex,
			memberEndIndex,
			rowEndIndex,
		});

		rowIndex = rowEndIndex + 1;
		memberIndex = memberEndIndex + 1;
	}

	return layouts;
}

export function getTotalRowsFromLayout(layouts: ReadonlyArray<MemberListGroupLayout>): number {
	if (layouts.length === 0) {
		return 0;
	}
	return layouts[layouts.length - 1]!.rowEndIndex + 1;
}

export function getTotalMemberCount(groups: ReadonlyArray<MemberListGroupSnapshot>): number {
	let count = 0;
	for (const group of groups) {
		count += Math.max(0, group.count);
	}
	return count;
}

export function getGroupLayoutForRow(
	layouts: ReadonlyArray<MemberListGroupLayout>,
	rowIndex: number,
): MemberListGroupLayout | null {
	for (const layout of layouts) {
		if (rowIndex < layout.headerRowIndex) {
			return null;
		}
		if (rowIndex <= layout.rowEndIndex) {
			return layout;
		}
	}
	return null;
}

export function getMemberIndexForRow(
	layouts: ReadonlyArray<MemberListGroupLayout>,
	rowIndex: number,
	direction: RowSeekDirection,
): number | null {
	const layout = getGroupLayoutForRow(layouts, rowIndex);
	if (!layout) {
		return null;
	}

	if (rowIndex === layout.headerRowIndex) {
		if (direction === 'forward') {
			return layout.count > 0 ? layout.memberStartIndex : null;
		}
		const previousIndex = layout.memberStartIndex - 1;
		return previousIndex >= 0 ? previousIndex : null;
	}

	return layout.memberStartIndex + (rowIndex - layout.headerRowIndex - 1);
}

export function getMemberIndexRangeForRowRange(
	layouts: ReadonlyArray<MemberListGroupLayout>,
	startRowIndex: number,
	endRowIndex: number,
): [number, number] | null {
	const start = getMemberIndexForRow(layouts, startRowIndex, 'forward');
	const end = getMemberIndexForRow(layouts, endRowIndex, 'backward');
	if (start == null || end == null || start > end) {
		return null;
	}
	return [start, end];
}

export function getRowIndexForMemberIndex(
	layouts: ReadonlyArray<MemberListGroupLayout>,
	memberIndex: number,
): number | null {
	if (memberIndex < 0) {
		return null;
	}

	if (layouts.length === 0) {
		return memberIndex;
	}

	for (const layout of layouts) {
		if (memberIndex < layout.memberStartIndex) {
			return null;
		}
		if (memberIndex <= layout.memberEndIndex) {
			return layout.headerRowIndex + 1 + (memberIndex - layout.memberStartIndex);
		}
	}

	return null;
}

export function getRowIndexRangeForMemberIndexRange(
	layouts: ReadonlyArray<MemberListGroupLayout>,
	startMemberIndex: number,
	endMemberIndex: number,
): [number, number] | null {
	const start = getRowIndexForMemberIndex(layouts, startMemberIndex);
	const end = getRowIndexForMemberIndex(layouts, endMemberIndex);
	if (start == null || end == null || start > end) {
		return null;
	}
	return [start, end];
}
