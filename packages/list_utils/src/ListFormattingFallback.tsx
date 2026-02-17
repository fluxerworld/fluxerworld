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

import type {ListFormatType} from '@fluxer/list_utils/src/ListFormattingTypes';

function getFallbackConjunction(type: ListFormatType): string {
	if (type === 'disjunction') {
		return 'or';
	}
	return 'and';
}

export function formatListWithFallback(items: ReadonlyArray<string>, type: ListFormatType): string {
	if (items.length === 0) {
		return '';
	}

	if (items.length === 1) {
		return items[0] ?? '';
	}

	if (type === 'unit') {
		return items.join(', ');
	}

	const conjunction = getFallbackConjunction(type);

	if (items.length === 2) {
		return `${items[0]} ${conjunction} ${items[1]}`;
	}

	const lastItem = items[items.length - 1];
	const leadingItems = items.slice(0, -1).join(', ');
	return `${leadingItems}, ${conjunction} ${lastItem}`;
}
