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

import gifStyles from '@app/components/channel/GifPicker.module.css';
import {useGifVideoPool} from '@app/components/channel/GifVideoPool';
import {MemesGrid} from '@app/components/channel/pickers/memes/MemesGrid';
import type {MemesPickerProps} from '@app/components/channel/pickers/memes/MemesPicker';
import {type ContentType, MemesPickerHeader} from '@app/components/channel/pickers/memes/MemesPickerHeader';
import {useScrollerViewport} from '@app/components/channel/pickers/shared/useScrollerViewport';
import {PickerEmptyState} from '@app/components/channel/shared/PickerEmptyState';
import {ExpressionPickerHeaderPortal} from '@app/components/popouts/ExpressionPickerPopout';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {Spinner} from '@app/components/uikit/Spinner';
import {useSearchInputAutofocus} from '@app/hooks/useSearchInputAutofocus';
import {useWindowFocusVideoControl} from '@app/hooks/useWindowFocusVideoControl';
import FavoriteMemeStore from '@app/stores/FavoriteMemeStore';
import MemesPickerStore from '@app/stores/MemesPickerStore';
import {useLingui} from '@lingui/react/macro';
import {SmileySadIcon} from '@phosphor-icons/react';
import {matchSorter} from 'match-sorter';
import {observer} from 'mobx-react-lite';
import {useEffect, useMemo, useRef, useState} from 'react';

interface MemesPickerState {
	searchTerm: string;
	selectedFilter: ContentType;
}

const initialState: MemesPickerState = {
	searchTerm: '',
	selectedFilter: 'all',
};

export const MemesPickerView = observer(({onClose}: MemesPickerProps = {}) => {
	const {t} = useLingui();
	const [state, setState] = useState<MemesPickerState>(initialState);

	const favoriteMemes = FavoriteMemeStore.memes;
	const fetched = FavoriteMemeStore.fetched;
	const storeLoading = !fetched;

	const gifAutoPlay = true;
	const videoPool = useGifVideoPool();

	const scrollerRef = useRef<ScrollerHandle>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);

	useSearchInputAutofocus(searchInputRef);

	const {viewportSize, scrollTop, handleScroll, handleResize, scrollToTop} = useScrollerViewport(scrollerRef);

	useWindowFocusVideoControl({scrollerRef, videoPool, gifAutoPlay});

	useEffect(() => {
		scrollToTop();
	}, [state.selectedFilter, state.searchTerm, scrollToTop]);

	const filteredMemes = useMemo(() => {
		let memes = [...favoriteMemes];

		if (state.selectedFilter !== 'all') {
			memes = memes.filter((meme) => {
				const contentType = meme.contentType.toLowerCase();
				switch (state.selectedFilter) {
					case 'image':
						return contentType.startsWith('image/') && !contentType.includes('gif') && !meme.isGifv;
					case 'video':
						return contentType.startsWith('video/') && !meme.isGifv;
					case 'audio':
						return contentType.startsWith('audio/');
					case 'gif':
						return contentType.includes('gif') || meme.isGifv;
					default:
						return true;
				}
			});
		}

		if (state.searchTerm) {
			const sortedByMatch = matchSorter(memes, state.searchTerm, {
				keys: ['name', 'altText', 'filename', 'tags'],
				threshold: matchSorter.rankings.CONTAINS,
			});
			const searchIndex = new Map(sortedByMatch.map((meme, index) => [meme.id, index]));

			memes = [...sortedByMatch].sort((a, b) => {
				const frecencyDiff = MemesPickerStore.getFrecencyScoreForMeme(b) - MemesPickerStore.getFrecencyScoreForMeme(a);
				if (frecencyDiff !== 0) return frecencyDiff;
				return (searchIndex.get(a.id) ?? 0) - (searchIndex.get(b.id) ?? 0);
			});
		}

		return memes;
	}, [favoriteMemes, state.selectedFilter, state.searchTerm]);

	const header = (
		<MemesPickerHeader
			searchTerm={state.searchTerm}
			onSearchTermChange={(value) => setState((s) => ({...s, searchTerm: value}))}
			onClearSearch={() => {
				setState((s) => ({...s, searchTerm: ''}));
				searchInputRef.current?.focus();
			}}
			selectedFilter={state.selectedFilter}
			onFilterChange={(filter) => setState((s) => ({...s, selectedFilter: filter}))}
			inputRef={searchInputRef}
		/>
	);

	if (storeLoading) {
		return (
			<div className={gifStyles.gifPickerContainer}>
				<ExpressionPickerHeaderPortal>{header}</ExpressionPickerHeaderPortal>
				<div className={gifStyles.gifPickerMain} style={{display: 'grid', placeItems: 'center'}}>
					<Spinner size="large" />
				</div>
			</div>
		);
	}

	if (favoriteMemes.length === 0) {
		return (
			<div className={gifStyles.gifPickerContainer}>
				<ExpressionPickerHeaderPortal>{header}</ExpressionPickerHeaderPortal>
				<div className={gifStyles.gifPickerMain}>
					<PickerEmptyState
						icon={SmileySadIcon}
						title={t`No Saved Media`}
						description={t`Save some media from messages to get started!`}
					/>
				</div>
			</div>
		);
	}

	if (filteredMemes.length === 0) {
		return (
			<div className={gifStyles.gifPickerContainer}>
				<ExpressionPickerHeaderPortal>{header}</ExpressionPickerHeaderPortal>
				<div className={gifStyles.gifPickerMain}>
					<PickerEmptyState
						icon={SmileySadIcon}
						title={t`No Results`}
						description={t`Try a different search term or filter`}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className={gifStyles.gifPickerContainer}>
			<ExpressionPickerHeaderPortal>{header}</ExpressionPickerHeaderPortal>

			<div className={gifStyles.gifPickerMain}>
				<div className={gifStyles.autoSizerWrapper}>
					<Scroller
						ref={scrollerRef}
						className={gifStyles.virtualList}
						onScroll={handleScroll}
						onResize={handleResize}
						fade={false}
						key="memes-picker-grid-scroller"
						style={{height: '100%', width: '100%'}}
					>
						{viewportSize.width > 0 && viewportSize.height > 0 && (
							<MemesGrid
								memes={filteredMemes}
								onClose={onClose}
								gifAutoPlay={gifAutoPlay}
								viewportWidth={viewportSize.width}
								viewportHeight={viewportSize.height}
								scrollTop={scrollTop}
							/>
						)}
					</Scroller>
				</div>
			</div>
		</div>
	);
});
