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

import type {AvailabilityCheck} from '@app/utils/ExpressionPermissionUtils';
import {
	type ExpressionPremiumSummary,
	getExpressionPremiumSummary,
	getPreviewItems,
} from '@app/utils/ExpressionPremiumSummary';
import type React from 'react';
import {useMemo} from 'react';

export interface UsePremiumUpsellDataResult<T> {
	accessibleItems: Array<T>;
	summary: ExpressionPremiumSummary<T>;
	previewContent?: React.ReactNode;
}

interface UsePremiumUpsellDataOptions<T> {
	items: ReadonlyArray<T>;
	getAvailability: (item: T) => AvailabilityCheck;
	getGuildId: (item: T) => string | undefined | null;
	renderPreviewItem?: (item: T) => React.ReactNode;
	previewSeed?: number;
	previewLimit?: number;
}

export const usePremiumUpsellData = <T,>({
	items,
	getAvailability,
	getGuildId,
	renderPreviewItem,
	previewSeed,
	previewLimit = 4,
}: UsePremiumUpsellDataOptions<T>): UsePremiumUpsellDataResult<T> => {
	const summary = useMemo(
		() => getExpressionPremiumSummary(items, getAvailability, getGuildId),
		[items, getAvailability, getGuildId],
	);

	const seed = useMemo(() => previewSeed ?? Date.now(), [previewSeed, summary.lockedItems.length]);

	const previewContent = useMemo(() => {
		if (!renderPreviewItem || summary.lockedItems.length === 0) {
			return undefined;
		}

		const previewItems = getPreviewItems(summary.lockedItems, previewLimit, seed);
		if (previewItems.length === 0) {
			return undefined;
		}

		return <>{previewItems.map((item) => renderPreviewItem(item))}</>;
	}, [renderPreviewItem, summary.lockedItems, previewLimit, seed]);

	return {
		accessibleItems: summary.accessibleItems,
		summary,
		previewContent,
	};
};
