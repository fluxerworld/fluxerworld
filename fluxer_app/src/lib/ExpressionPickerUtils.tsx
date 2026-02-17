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

import type {FlatEmoji} from '@app/types/EmojiTypes';
import type React from 'react';

export interface ExpressionPickerItem {
	id: string;
	type: 'emoji' | 'sticker' | 'gif' | 'meme';
	content: FlatEmoji | unknown;
	renderComponent: () => React.ReactNode;
	ariaLabel?: string;
}

export interface ExpressionPickerSection {
	id: string;
	title: string;
	items: ReadonlyArray<ExpressionPickerItem>;
}

export function buildExpressionItem(
	id: string,
	type: ExpressionPickerItem['type'],
	content: FlatEmoji | unknown,
	renderComponent: () => React.ReactNode,
	ariaLabel?: string,
): ExpressionPickerItem {
	return {
		id,
		type,
		content,
		renderComponent,
		ariaLabel,
	};
}

export function buildExpressionSection(
	id: string,
	title: string,
	items: ReadonlyArray<ExpressionPickerItem>,
): ExpressionPickerSection {
	return {
		id,
		title,
		items,
	};
}

export function getExpressionPickerSelectedId(item: ExpressionPickerItem | null): string | null {
	if (!item) return null;
	return item.id;
}

export function getExpressionPickerHeight(itemCount: number, itemHeight: number, sectionHeaderHeight: number): number {
	const estimatedHeight = itemCount * itemHeight;
	const totalSections = Math.ceil(itemCount / 20);
	const totalSectionHeaders = totalSections * sectionHeaderHeight;
	return estimatedHeight + totalSectionHeaders;
}
