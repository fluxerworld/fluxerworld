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

import type {ChannelRecord} from '@app/records/ChannelRecord';
import ChannelSearchStore, {getChannelSearchContextId} from '@app/stores/ChannelSearchStore';
import SelectedGuildStore from '@app/stores/SelectedGuildStore';
import type {SearchSegment} from '@app/utils/SearchSegmentManager';
import {useCallback, useMemo} from 'react';

interface UseChannelSearchStateReturn {
	searchQuery: string;
	searchSegments: Array<SearchSegment>;
	activeSearchQuery: string;
	activeSearchSegments: Array<SearchSegment>;
	isSearchActive: boolean;
	searchRefreshKey: number;
	handleSearchInputChange: (query: string, segments: Array<SearchSegment>) => void;
	setIsSearchActive: (value: boolean) => void;
	handleSearchSubmit: (query: string, segments: Array<SearchSegment>) => void;
	handleSearchClose: () => void;
}

export const useChannelSearchState = (channel?: ChannelRecord): UseChannelSearchStateReturn => {
	const selectedGuildId = SelectedGuildStore.selectedGuildId;
	const contextId = useMemo(
		() => getChannelSearchContextId(channel ?? null, selectedGuildId),
		[channel?.guildId, channel?.id, selectedGuildId],
	);

	const context = contextId ? ChannelSearchStore.getContext(contextId) : null;

	const handleSearchInputChange = useCallback(
		(query: string, segments: Array<SearchSegment>) => {
			if (!contextId) {
				return;
			}
			ChannelSearchStore.setSearchInput(contextId, query, segments);
		},
		[contextId],
	);

	const handleSearchSubmit = useCallback(
		(query: string, segments: Array<SearchSegment>) => {
			if (!contextId) {
				return;
			}
			ChannelSearchStore.setSearchInput(contextId, query, segments);
			ChannelSearchStore.setActiveSearch(contextId, query, segments);
		},
		[contextId],
	);

	const handleSearchClose = useCallback(() => {
		if (!contextId) {
			return;
		}
		ChannelSearchStore.closeSearch(contextId);
	}, [contextId]);

	const setIsSearchActive = useCallback(
		(value: boolean) => {
			if (!contextId) {
				return;
			}
			ChannelSearchStore.setIsSearchActive(contextId, value);
		},
		[contextId],
	);

	return {
		searchQuery: context?.searchQuery ?? '',
		searchSegments: context?.searchSegments ?? [],
		activeSearchQuery: context?.activeSearchQuery ?? '',
		activeSearchSegments: context?.activeSearchSegments ?? [],
		isSearchActive: context?.isSearchActive ?? false,
		searchRefreshKey: context?.searchRefreshKey ?? 0,
		handleSearchInputChange,
		setIsSearchActive,
		handleSearchSubmit,
		handleSearchClose,
	};
};
