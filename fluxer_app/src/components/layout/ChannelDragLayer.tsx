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

import {ChannelItemCore} from '@app/components/layout/ChannelItem';
import {DND_TYPES, type DragItem} from '@app/components/layout/types/DndTypes';
import ChannelStore from '@app/stores/ChannelStore';
import {observer} from 'mobx-react-lite';
import type {CSSProperties} from 'react';
import {useDragLayer} from 'react-dnd';

const layerStyles: CSSProperties = {
	position: 'fixed',
	pointerEvents: 'none',
	zIndex: 10000,
	left: 0,
	top: 0,
	width: '100%',
	height: '100%',
};

function getItemStyles(currentOffset: {x: number; y: number} | null): CSSProperties {
	if (!currentOffset) {
		return {display: 'none'};
	}
	const {x, y} = currentOffset;
	return {
		transform: `translate(${x}px, ${y}px)`,
		WebkitTransform: `translate(${x}px, ${y}px)`,
	};
}

export const ChannelDragLayer = observer(() => {
	const {itemType, item, isDragging, currentOffset} = useDragLayer((monitor) => ({
		item: monitor.getItem() as DragItem | null,
		itemType: monitor.getItemType(),
		isDragging: monitor.isDragging(),
		currentOffset: monitor.getClientOffset(),
	}));

	if (!isDragging || !item || (itemType !== DND_TYPES.CHANNEL && itemType !== DND_TYPES.CATEGORY)) {
		return null;
	}

	const channel = ChannelStore.getChannel(item.id);
	if (!channel) {
		return null;
	}

	return (
		<div style={layerStyles}>
			<div style={getItemStyles(currentOffset)}>
				<div
					style={{
						background: 'var(--background-floating)',
						borderRadius: 6,
						padding: '4px 8px',
						boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
						opacity: 0.9,
						maxWidth: 200,
						overflow: 'hidden',
					}}
				>
					<ChannelItemCore
						channel={{name: channel.name ?? '', type: channel.type}}
						isSelected={false}
					/>
				</div>
			</div>
		</div>
	);
});
