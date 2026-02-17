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

import {MemeGridItem} from '@app/components/channel/pickers/memes/MemeGridItem';
import {computeMasonryColumns} from '@app/components/channel/pickers/shared/ComputeColumns';
import {MasonryVirtualGrid} from '@app/components/channel/pickers/shared/MasonryVirtualGrid';
import type {FavoriteMemeRecord} from '@app/records/FavoriteMemeRecord';
import MemesPickerStore from '@app/stores/MemesPickerStore';
import QuickSwitcherStore from '@app/stores/QuickSwitcherStore';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo} from 'react';

export const MemesGrid = observer(
	({
		memes,
		onClose,
		gifAutoPlay,
		viewportWidth,
		viewportHeight,
		scrollTop,
	}: {
		memes: Array<FavoriteMemeRecord>;
		onClose?: () => void;
		gifAutoPlay: boolean;
		viewportWidth: number;
		viewportHeight: number;
		scrollTop: number;
	}) => {
		const itemGutter = 8;
		const columns = computeMasonryColumns(viewportWidth, itemGutter);

		const data = useMemo(
			() =>
				memes.map((meme) => ({
					id: meme.id,
					original: meme,
					width: meme.width ?? 200,
					height: meme.height ?? 200,
				})),
			[memes],
		);

		const itemKeys = useMemo(() => data.map((d) => d.id), [data]);

		const handleSelectKey = useCallback((itemKey: string) => {
			MemesPickerStore.trackMemeUsage(itemKey);
		}, []);

		return (
			<MasonryVirtualGrid
				data={data}
				itemKeys={itemKeys}
				columns={columns}
				itemGutter={itemGutter}
				viewportWidth={viewportWidth}
				viewportHeight={viewportHeight}
				scrollTop={scrollTop}
				checkSuspension={() => QuickSwitcherStore.isOpen}
				onSelectItemKey={handleSelectKey}
				getItemKey={(item) => item.id}
				getItemHeight={(item, _index, columnWidth) => columnWidth * (item.height / item.width)}
				renderItem={({item, itemKey, coords, isFocused}) => (
					<MemeGridItem
						key={itemKey}
						meme={item.original}
						coords={coords}
						onClose={onClose}
						gifAutoPlay={gifAutoPlay}
						isFocused={isFocused}
						itemKey={itemKey}
					/>
				)}
			/>
		);
	},
);
