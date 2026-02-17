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

import {
	calculateThumbState,
	clamp,
	getAxisPointerPosition,
	getAxisScrollMetrics,
	getAxisScrollPosition,
	type ScrollAxis,
	type ScrollbarThumbState,
	setAxisScrollPosition,
} from '@app/components/uikit/scroller/ScrollerMath';
import {type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState} from 'react';

type ScrollOverflow = 'scroll' | 'auto' | 'hidden';

interface UseScrollerThumbOptions {
	orientation: ScrollAxis;
	overflow: ScrollOverflow;
	minThumbSize: number;
	scrollRef: React.RefObject<HTMLDivElement | null>;
}

interface DragState {
	maxScrollPosition: number;
	pointerId: number;
	pointerStart: number;
	scrollStart: number;
	thumbElement: HTMLDivElement;
	trackTravel: number;
}

interface UseScrollerThumbResult {
	isDragging: boolean;
	refreshThumbState: () => void;
	thumbState: ScrollbarThumbState;
	onThumbPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
	onTrackPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

function createEmptyThumbState(): ScrollbarThumbState {
	return {
		hasTrack: false,
		thumbSize: 0,
		thumbOffset: 0,
		trackSize: 0,
		maxScrollPosition: 0,
	};
}

export function useScrollerThumb({
	orientation,
	overflow,
	minThumbSize,
	scrollRef,
}: UseScrollerThumbOptions): UseScrollerThumbResult {
	const [isDragging, setIsDragging] = useState(false);
	const [thumbState, setThumbState] = useState<ScrollbarThumbState>(createEmptyThumbState);
	const thumbStateRef = useRef<ScrollbarThumbState>(thumbState);
	const dragStateRef = useRef<DragState | null>(null);
	const previousUserSelectRef = useRef<string>('');
	const previousCursorRef = useRef<string>('');

	const setThumbStateIfChanged = useCallback((nextThumbState: ScrollbarThumbState) => {
		const previousState = thumbStateRef.current;
		if (!previousState.hasTrack && !nextThumbState.hasTrack) {
			return;
		}

		const hasSameValues =
			previousState.hasTrack === nextThumbState.hasTrack &&
			previousState.thumbSize === nextThumbState.thumbSize &&
			previousState.thumbOffset === nextThumbState.thumbOffset &&
			previousState.trackSize === nextThumbState.trackSize &&
			previousState.maxScrollPosition === nextThumbState.maxScrollPosition;
		if (hasSameValues) {
			return;
		}

		thumbStateRef.current = nextThumbState;
		setThumbState(nextThumbState);
	}, []);

	const refreshThumbState = useCallback(() => {
		const scrollElement = scrollRef.current;
		if (!scrollElement || overflow === 'hidden') {
			setThumbStateIfChanged(createEmptyThumbState());
			return;
		}

		const metrics = getAxisScrollMetrics(scrollElement, orientation);
		const forceTrack = overflow === 'scroll';
		const nextThumbState = calculateThumbState(metrics, minThumbSize, forceTrack);
		setThumbStateIfChanged(nextThumbState);
	}, [minThumbSize, orientation, overflow, scrollRef, setThumbStateIfChanged]);

	const stopDragging = useCallback(() => {
		const dragState = dragStateRef.current;
		if (dragState) {
			try {
				dragState.thumbElement.releasePointerCapture(dragState.pointerId);
			} catch {}
		}
		dragStateRef.current = null;
		setIsDragging(false);

		if (previousUserSelectRef.current) {
			document.body.style.userSelect = previousUserSelectRef.current;
			previousUserSelectRef.current = '';
		} else {
			document.body.style.removeProperty('user-select');
		}

		if (previousCursorRef.current) {
			document.body.style.cursor = previousCursorRef.current;
			previousCursorRef.current = '';
		} else {
			document.body.style.removeProperty('cursor');
		}
	}, []);

	const handleWindowPointerMove = useCallback(
		(event: PointerEvent) => {
			const dragState = dragStateRef.current;
			const scrollElement = scrollRef.current;
			if (!dragState || !scrollElement) {
				return;
			}

			const currentPointer = getAxisPointerPosition(event.clientX, event.clientY, orientation);
			const pointerDelta = currentPointer - dragState.pointerStart;
			const scrollDelta = (pointerDelta / dragState.trackTravel) * dragState.maxScrollPosition;
			const nextScrollPosition = clamp(dragState.scrollStart + scrollDelta, 0, dragState.maxScrollPosition);

			setAxisScrollPosition(scrollElement, orientation, nextScrollPosition);
		},
		[orientation, scrollRef],
	);

	const handleWindowPointerUp = useCallback(() => {
		stopDragging();
	}, [stopDragging]);

	useEffect(() => {
		if (!isDragging) {
			return;
		}

		window.addEventListener('pointermove', handleWindowPointerMove);
		window.addEventListener('pointerup', handleWindowPointerUp);
		window.addEventListener('pointercancel', handleWindowPointerUp);

		return () => {
			window.removeEventListener('pointermove', handleWindowPointerMove);
			window.removeEventListener('pointerup', handleWindowPointerUp);
			window.removeEventListener('pointercancel', handleWindowPointerUp);
		};
	}, [isDragging, handleWindowPointerMove, handleWindowPointerUp]);

	useEffect(() => {
		return () => {
			stopDragging();
		};
	}, [stopDragging]);

	useEffect(() => {
		refreshThumbState();
	}, [refreshThumbState]);

	const onThumbPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (event.button !== 0 || thumbState.maxScrollPosition <= 0) {
				return;
			}

			const scrollElement = scrollRef.current;
			if (!scrollElement) {
				return;
			}

			const trackTravel = Math.max(1, thumbState.trackSize - thumbState.thumbSize);
			const pointerStart = getAxisPointerPosition(event.clientX, event.clientY, orientation);
			const scrollStart = getAxisScrollPosition(scrollElement, orientation);

			const thumbElement = event.currentTarget;
			thumbElement.setPointerCapture(event.pointerId);

			dragStateRef.current = {
				maxScrollPosition: thumbState.maxScrollPosition,
				pointerId: event.pointerId,
				pointerStart,
				scrollStart,
				thumbElement,
				trackTravel,
			};

			previousUserSelectRef.current = document.body.style.userSelect;
			document.body.style.userSelect = 'none';
			previousCursorRef.current = document.body.style.cursor;
			document.body.style.cursor = 'grabbing';
			setIsDragging(true);

			event.preventDefault();
			event.stopPropagation();
		},
		[orientation, scrollRef, thumbState.maxScrollPosition, thumbState.thumbSize, thumbState.trackSize],
	);

	const onTrackPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (event.button !== 0 || thumbState.maxScrollPosition <= 0) {
				return;
			}

			const target = event.target as HTMLElement;
			if (target.dataset.scrollerThumb === 'true') {
				return;
			}

			const scrollElement = scrollRef.current;
			if (!scrollElement) {
				return;
			}

			const rect = event.currentTarget.getBoundingClientRect();
			const pointerPosition = orientation === 'vertical' ? event.clientY - rect.top : event.clientX - rect.left;
			const trackTravel = Math.max(1, thumbState.trackSize - thumbState.thumbSize);
			const thumbOffset = pointerPosition - thumbState.thumbSize / 2;
			const nextRatio = clamp(thumbOffset / trackTravel, 0, 1);
			const nextScrollPosition = nextRatio * thumbState.maxScrollPosition;

			setAxisScrollPosition(scrollElement, orientation, nextScrollPosition);
			event.preventDefault();
		},
		[orientation, scrollRef, thumbState.maxScrollPosition, thumbState.thumbSize, thumbState.trackSize],
	);

	return {
		isDragging,
		refreshThumbState,
		thumbState,
		onThumbPointerDown,
		onTrackPointerDown,
	};
}
