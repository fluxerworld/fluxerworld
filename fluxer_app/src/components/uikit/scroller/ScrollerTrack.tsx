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

import styles from '@app/components/uikit/scroller/ScrollerTrack.module.css';
import {clsx} from 'clsx';
import type {CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent} from 'react';

type ScrollAxis = 'vertical' | 'horizontal';

interface ScrollerTrackProps {
	orientation: ScrollAxis;
	scrollbar: 'thin' | 'regular';
	hasTrack: boolean;
	isVisible: boolean;
	isDragging: boolean;
	thumbOffset: number;
	thumbSize: number;
	onTrackPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
	onThumbPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
	onWheel?: (event: ReactWheelEvent<HTMLDivElement>) => void;
}

export function ScrollerTrack({
	orientation,
	scrollbar,
	hasTrack,
	isVisible,
	isDragging,
	thumbOffset,
	thumbSize,
	onTrackPointerDown,
	onThumbPointerDown,
	onWheel,
}: ScrollerTrackProps) {
	if (!hasTrack) {
		return null;
	}

	const trackClassName = clsx(styles.track, {
		[styles.vertical]: orientation === 'vertical',
		[styles.horizontal]: orientation === 'horizontal',
		[styles.regular]: scrollbar === 'regular',
		[styles.visible]: isVisible,
	});

	const thumbStyle: CSSProperties =
		orientation === 'vertical'
			? {
					height: `${thumbSize}px`,
					transform: `translateY(${thumbOffset}px)`,
				}
			: {
					width: `${thumbSize}px`,
					transform: `translateX(${thumbOffset}px)`,
				};

	const thumbClassName = clsx(styles.thumb, {[styles.active]: isDragging});

	return (
		<div
			className={trackClassName}
			onPointerDown={onTrackPointerDown}
			onWheel={onWheel}
			style={{pointerEvents: isVisible ? 'auto' : 'none'}}
			role="presentation"
		>
			<div
				className={thumbClassName}
				style={thumbStyle}
				onPointerDown={onThumbPointerDown}
				data-scroller-thumb="true"
				role="presentation"
			/>
		</div>
	);
}
