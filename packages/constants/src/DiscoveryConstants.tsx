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

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const DiscoveryCategories = {
	GAMING: 0,
	MUSIC: 1,
	ENTERTAINMENT: 2,
	EDUCATION: 3,
	SCIENCE_AND_TECHNOLOGY: 4,
	CONTENT_CREATOR: 5,
	ANIME_AND_MANGA: 6,
	MOVIES_AND_TV: 7,
	OTHER: 8,
} as const;

export type DiscoveryCategory = ValueOf<typeof DiscoveryCategories>;

export const DiscoveryCategoryLabels: Record<DiscoveryCategory, string> = {
	0: 'Gaming',
	1: 'Music',
	2: 'Entertainment',
	3: 'Education',
	4: 'Science & Technology',
	5: 'Content Creator',
	6: 'Anime & Manga',
	7: 'Movies & TV',
	8: 'Other',
};

export const DiscoveryApplicationStatus = {
	PENDING: 'pending',
	APPROVED: 'approved',
	REJECTED: 'rejected',
	REMOVED: 'removed',
} as const;

export type DiscoveryApplicationStatusValue = ValueOf<typeof DiscoveryApplicationStatus>;

export const DISCOVERY_DESCRIPTION_MIN_LENGTH = 10;
export const DISCOVERY_DESCRIPTION_MAX_LENGTH = 300;
