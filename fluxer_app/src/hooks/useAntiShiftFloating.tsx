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

import {Logger} from '@app/lib/Logger';
import {getAdaptivePadding} from '@app/utils/Positioning';
import {
	autoUpdate,
	computePosition,
	flip,
	limitShift,
	type Middleware,
	offset,
	type Placement,
	shift,
	size,
} from '@floating-ui/react';
import {useCallback, useEffect, useRef, useState} from 'react';

const logger = new Logger('useAntiShiftFloating');

const DEFAULT_MIDDLEWARE: Array<Middleware> = [];

interface FloatingState {
	x: number;
	y: number;
	isReady: boolean;
}

interface UseAntiShiftFloatingOptions {
	placement: Placement;
	offsetMainAxis?: number;
	offsetCrossAxis?: number;
	middleware?: Array<Middleware>;
	shouldAutoUpdate?: boolean;
	enableSmartBoundary?: boolean;
	constrainHeight?: boolean;
}

export function useAntiShiftFloating(
	target: HTMLElement | null,
	enabled: boolean,
	options: UseAntiShiftFloatingOptions,
) {
	const {
		placement,
		offsetMainAxis = 8,
		offsetCrossAxis = 0,
		middleware: extraMiddleware = DEFAULT_MIDDLEWARE,
		shouldAutoUpdate = true,
		enableSmartBoundary = false,
		constrainHeight = false,
	} = options;

	const floatingRef = useRef<HTMLElement>(null);
	const [state, setState] = useState<FloatingState>(() => {
		const {x, y} = target ? getInitialGuess(target, placement, offsetMainAxis, offsetCrossAxis) : {x: -9999, y: -9999};
		return {x, y, isReady: false};
	});
	const cleanupRef = useRef<(() => void) | null>(null);
	const isCalculatingRef = useRef(false);
	const rafIdRef = useRef<number | null>(null);

	const updatePosition = useCallback(async () => {
		if (!enabled || !target || !floatingRef.current || isCalculatingRef.current) {
			return;
		}

		isCalculatingRef.current = true;

		if (rafIdRef.current !== null) {
			cancelAnimationFrame(rafIdRef.current);
		}

		rafIdRef.current = requestAnimationFrame(async () => {
			try {
				const floating = floatingRef.current;
				if (!floating) {
					isCalculatingRef.current = false;
					return;
				}

				const adaptivePadding = enableSmartBoundary ? getAdaptivePadding() : 8;
				const shiftPadding = Math.max(6, adaptivePadding);

				const middleware: Array<Middleware> = [
					offset({mainAxis: offsetMainAxis, crossAxis: offsetCrossAxis}),
					flip({padding: shiftPadding}),
					shift({
						padding: shiftPadding,
						limiter: limitShift({
							offset: adaptivePadding,
						}),
					}),
					...extraMiddleware,
				];

				if (constrainHeight) {
					middleware.push(
						size({
							apply({availableHeight, elements}: {availableHeight: number; elements: {floating: HTMLElement}}) {
								const maxHeight = Math.max(100, availableHeight - shiftPadding * 2);
								Object.assign(elements.floating.style, {
									maxHeight: `${maxHeight}px`,
								});
								elements.floating.style.removeProperty('overflow-y');
							},
							padding: shiftPadding,
						}),
					);
				}

				const {x, y} = await computePosition(target, floating, {
					placement,
					middleware,
				});

				Object.assign(floating.style, {
					left: `${x}px`,
					top: `${y}px`,
					visibility: 'visible',
				});

				setState({x, y, isReady: true});
			} catch (error) {
				logger.error('Error positioning floating element', error);
				if (floatingRef.current) {
					floatingRef.current.style.visibility = 'visible';
				}
			} finally {
				isCalculatingRef.current = false;
				rafIdRef.current = null;
			}
		});
	}, [
		enabled,
		target,
		placement,
		offsetMainAxis,
		offsetCrossAxis,
		extraMiddleware,
		enableSmartBoundary,
		constrainHeight,
	]);

	useEffect(() => {
		if (!enabled || !target || !floatingRef.current) {
			setState((prev) => ({...prev, isReady: false}));
			return;
		}

		if (!document.contains(target)) {
			setState((prev) => ({...prev, isReady: false}));
			return;
		}

		updatePosition();

		if (shouldAutoUpdate) {
			cleanupRef.current = autoUpdate(target, floatingRef.current, updatePosition, {
				ancestorScroll: true,
				ancestorResize: true,
				elementResize: true,
				layoutShift: true,
			});
		}

		return () => {
			cleanupRef.current?.();
			cleanupRef.current = null;
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
			setState((prev) => ({...prev, isReady: false}));
		};
	}, [enabled, target, shouldAutoUpdate, updatePosition]);

	return {
		ref: floatingRef,
		state,
		style: {
			position: 'fixed' as const,
			left: state.x,
			top: state.y,
		},
		updatePosition,
	};
}

function getInitialGuess(target: HTMLElement, placement: Placement, offsetMainAxis: number, offsetCrossAxis: number) {
	const rect = target.getBoundingClientRect();
	const [side, align = 'center'] = placement.split('-') as [string, string];

	let x = rect.left;
	let y = rect.top;

	switch (side) {
		case 'right':
			x = rect.right + offsetMainAxis;
			break;
		case 'left':
			x = rect.left - offsetMainAxis;
			break;
		case 'bottom':
			y = rect.bottom + offsetMainAxis;
			break;
		case 'top':
			y = rect.top - offsetMainAxis;
			break;
		default:
			break;
	}

	if (side === 'top' || side === 'bottom') {
		if (align === 'end') {
			x = rect.right;
		} else if (align === 'start') {
			x = rect.left;
		} else {
			x = rect.left + rect.width / 2;
		}
		x += offsetCrossAxis;
	} else {
		if (align === 'end') {
			y = rect.bottom;
		} else if (align === 'start') {
			y = rect.top;
		} else {
			y = rect.top + rect.height / 2;
		}
		y += offsetCrossAxis;
	}

	return {x, y};
}
