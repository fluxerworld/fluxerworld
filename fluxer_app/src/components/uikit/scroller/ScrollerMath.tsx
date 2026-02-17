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

export type ScrollAxis = 'vertical' | 'horizontal';

export interface AxisScrollMetrics {
	viewportSize: number;
	contentSize: number;
	scrollPosition: number;
	maxScrollPosition: number;
}

export interface ScrollbarThumbState {
	hasTrack: boolean;
	thumbSize: number;
	thumbOffset: number;
	trackSize: number;
	maxScrollPosition: number;
}

export function clamp(value: number, minValue: number, maxValue: number): number {
	return Math.max(minValue, Math.min(value, maxValue));
}

export function getAxisScrollMetrics(element: HTMLElement, orientation: ScrollAxis): AxisScrollMetrics {
	if (orientation === 'vertical') {
		const viewportSize = element.clientHeight;
		const contentSize = element.scrollHeight;
		const scrollPosition = element.scrollTop;
		const maxScrollPosition = Math.max(0, contentSize - viewportSize);

		return {
			viewportSize,
			contentSize,
			scrollPosition,
			maxScrollPosition,
		};
	}

	const viewportSize = element.clientWidth;
	const contentSize = element.scrollWidth;
	const scrollPosition = element.scrollLeft;
	const maxScrollPosition = Math.max(0, contentSize - viewportSize);

	return {
		viewportSize,
		contentSize,
		scrollPosition,
		maxScrollPosition,
	};
}

export function calculateThumbState(
	metrics: AxisScrollMetrics,
	minThumbSize: number,
	forceTrack: boolean,
): ScrollbarThumbState {
	const hasOverflow = metrics.maxScrollPosition > 0;
	const hasTrack = forceTrack || hasOverflow;
	const trackSize = metrics.viewportSize;

	if (!hasTrack || trackSize <= 0) {
		return {
			hasTrack: false,
			thumbSize: 0,
			thumbOffset: 0,
			trackSize,
			maxScrollPosition: metrics.maxScrollPosition,
		};
	}

	if (!hasOverflow) {
		return {
			hasTrack: true,
			thumbSize: trackSize,
			thumbOffset: 0,
			trackSize,
			maxScrollPosition: metrics.maxScrollPosition,
		};
	}

	const proportionalThumbSize = (metrics.viewportSize / metrics.contentSize) * trackSize;
	const thumbSize = clamp(proportionalThumbSize, minThumbSize, trackSize);
	const travelRange = Math.max(0, trackSize - thumbSize);
	const scrollRatio = metrics.maxScrollPosition === 0 ? 0 : metrics.scrollPosition / metrics.maxScrollPosition;
	const thumbOffset = travelRange * clamp(scrollRatio, 0, 1);

	return {
		hasTrack: true,
		thumbSize,
		thumbOffset,
		trackSize,
		maxScrollPosition: metrics.maxScrollPosition,
	};
}

export function getAxisPointerPosition(clientX: number, clientY: number, orientation: ScrollAxis): number {
	if (orientation === 'vertical') {
		return clientY;
	}

	return clientX;
}

export function getAxisScrollPosition(element: HTMLElement, orientation: ScrollAxis): number {
	if (orientation === 'vertical') {
		return element.scrollTop;
	}

	return element.scrollLeft;
}

export function setAxisScrollPosition(element: HTMLElement, orientation: ScrollAxis, value: number): void {
	if (orientation === 'vertical') {
		element.scrollTop = value;
		return;
	}

	element.scrollLeft = value;
}
