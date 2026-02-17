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

import styles from '@app/components/voice/VoiceGridLayout.module.css';
import type {TrackReferenceOrPlaceholder} from '@livekit/components-react';
import {isTrackReference, ParticipantContext, TrackRefContext} from '@livekit/components-react';
import {clsx} from 'clsx';
import type React from 'react';
import {useLayoutEffect, useMemo, useRef, useState} from 'react';

interface VoiceGridLayoutProps {
	tracks: Array<TrackReferenceOrPlaceholder>;
	children: React.ReactElement;
	onOverflowChange?: (isOverflowing: boolean) => void;
	edgeToEdge?: boolean;
	compact?: boolean;
}

interface GridStyle extends React.CSSProperties {
	'--voice-grid-single-tile-width'?: string;
}

const OVERFLOW_ENTER_HYSTERESIS_PX = 2;
const OVERFLOW_EXIT_HYSTERESIS_PX = 6;
const TILE_ASPECT_RATIO = 16 / 9;

function resolveOverflowWithHysteresis(overflowDelta: number, wasOverflowing: boolean): boolean {
	if (wasOverflowing) {
		return overflowDelta > -OVERFLOW_EXIT_HYSTERESIS_PX;
	}

	return overflowDelta > OVERFLOW_ENTER_HYSTERESIS_PX;
}

export function VoiceGridLayout({
	tracks,
	children,
	onOverflowChange,
	edgeToEdge = false,
	compact = false,
}: VoiceGridLayoutProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);
	const [isOverflowing, setIsOverflowing] = useState(false);
	const [singleTileWidthPx, setSingleTileWidthPx] = useState<number | null>(null);
	const overflowStateRef = useRef(false);
	const gridStyle = useMemo<GridStyle | undefined>(() => {
		if (tracks.length !== 1 || singleTileWidthPx == null) {
			return undefined;
		}
		return {
			'--voice-grid-single-tile-width': `${Math.round(singleTileWidthPx)}px`,
		};
	}, [singleTileWidthPx, tracks.length]);

	useLayoutEffect(() => {
		if (tracks.length <= 1) {
			overflowStateRef.current = false;
			setIsOverflowing(false);
			return;
		}

		const container = containerRef.current;
		const grid = gridRef.current;
		if (!container || !grid) return;
		const containerNode = container;
		const gridNode = grid;

		function recompute() {
			const overflowDelta = gridNode.scrollHeight - containerNode.clientHeight;
			const nextOverflow = resolveOverflowWithHysteresis(overflowDelta, overflowStateRef.current);
			overflowStateRef.current = nextOverflow;
			setIsOverflowing((previous) => (previous === nextOverflow ? previous : nextOverflow));
		}

		if (typeof ResizeObserver === 'undefined') {
			recompute();
			return;
		}

		const observer = new ResizeObserver(() => {
			recompute();
		});
		observer.observe(containerNode);
		observer.observe(gridNode);
		recompute();

		return () => {
			observer.disconnect();
		};
	}, [tracks.length]);

	useLayoutEffect(() => {
		if (tracks.length !== 1) {
			setSingleTileWidthPx(null);
			return;
		}

		const container = containerRef.current;
		const grid = gridRef.current;
		if (!container || !grid) return;
		const containerNode = container;
		const gridNode = grid;

		function recomputeSingleTileWidth() {
			const containerWidth = containerNode.clientWidth;
			const containerHeight = containerNode.clientHeight;
			if (containerWidth <= 0 || containerHeight <= 0) return;

			const computed = window.getComputedStyle(gridNode);
			const sidePadding = Number.parseFloat(computed.getPropertyValue('--voice-grid-side-padding')) || 12;
			const verticalPadding = Number.parseFloat(computed.getPropertyValue('--voice-grid-vertical-padding')) || 14;
			const availableWidth = Math.max(0, containerWidth - sidePadding * 2);
			const availableHeight = Math.max(0, containerHeight - verticalPadding * 2);
			const nextWidth = Math.max(0, Math.min(availableWidth, availableHeight * TILE_ASPECT_RATIO));
			setSingleTileWidthPx((previousWidth) => {
				if (previousWidth != null && Math.abs(previousWidth - nextWidth) < 0.5) {
					return previousWidth;
				}
				return nextWidth;
			});
		}

		if (typeof ResizeObserver === 'undefined') {
			recomputeSingleTileWidth();
			return;
		}

		const observer = new ResizeObserver(() => {
			recomputeSingleTileWidth();
		});
		observer.observe(containerNode);
		observer.observe(gridNode);
		recomputeSingleTileWidth();

		return () => {
			observer.disconnect();
		};
	}, [tracks.length]);

	useLayoutEffect(() => {
		onOverflowChange?.(isOverflowing);
	}, [isOverflowing, onOverflowChange]);

	return (
		<div
			ref={containerRef}
			className={clsx(
				styles.gridViewport,
				isOverflowing && styles.gridViewportOverflowing,
				compact && styles.gridViewportCompact,
			)}
			data-edge-to-edge={edgeToEdge ? 'true' : undefined}
		>
			<div ref={gridRef} className={styles.grid} data-tile-count={tracks.length} style={gridStyle}>
				{tracks.map((trackRef, index) => {
					const key = isTrackReference(trackRef)
						? `${trackRef.participant.identity}-${trackRef.source}`
						: `placeholder-${trackRef.participant.identity}-${index}`;

					return (
						<div key={key} className={styles.gridItem}>
							<TrackRefContext.Provider value={trackRef}>
								<ParticipantContext.Provider value={trackRef.participant}>{children}</ParticipantContext.Provider>
							</TrackRefContext.Provider>
						</div>
					);
				})}
			</div>
		</div>
	);
}
