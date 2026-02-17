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

export interface ExpressionPremiumSummary<T> {
	accessibleItems: Array<T>;
	lockedItems: Array<T>;
	communityCount: number;
	lockedCommunityIds: Array<string>;
}

export function getExpressionPremiumSummary<T>(
	items: ReadonlyArray<T>,
	getAvailability: (item: T) => AvailabilityCheck,
	getGuildId: (item: T) => string | undefined | null,
): ExpressionPremiumSummary<T> {
	const accessibleItems: Array<T> = [];
	const lockedItems: Array<T> = [];
	const communities = new Set<string>();

	for (const item of items) {
		const availability = getAvailability(item);
		if (availability.canUse) {
			accessibleItems.push(item);
		}
		if (availability.isLockedByPremium) {
			lockedItems.push(item);
			const guildId = getGuildId(item);
			if (guildId) {
				communities.add(guildId);
			}
		}
	}

	return {
		accessibleItems,
		lockedItems,
		communityCount: communities.size,
		lockedCommunityIds: [...communities],
	};
}

const mulberry32 = (seed: number) => {
	let value = seed >>> 0;
	return () => {
		value += 0x6d2b79f5;
		let t = Math.imul(value ^ (value >>> 15), value | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

export function getPreviewItems<T>(items: ReadonlyArray<T>, limit: number, seed: number): Array<T> {
	if (items.length <= limit) {
		return [...items];
	}

	const shuffled = [...items];
	const random = mulberry32(seed);

	for (let i = shuffled.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}

	return shuffled.slice(0, limit);
}
