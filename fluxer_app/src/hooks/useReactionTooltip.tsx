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
import type {Placement} from '@floating-ui/react-dom';
import {autoUpdate, computePosition, flip, offset, shift} from '@floating-ui/react-dom';
import {useCallback, useEffect, useRef, useState} from 'react';

const logger = new Logger('useReactionTooltip');

interface ReactionTooltipState {
	x: number;
	y: number;
	isOpen: boolean;
	isReady: boolean;
}

export function useReactionTooltip(hoverDelay = 500, placement: Placement = 'top') {
	const targetRef = useRef<HTMLElement | null>(null);
	const tooltipRef = useRef<HTMLDivElement | null>(null);
	const cleanupRef = useRef<(() => void) | null>(null);
	const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
	const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
	const isCalculatingRef = useRef(false);
	const lastPointerRef = useRef<{x: number; y: number} | null>(null);

	const [state, setState] = useState<ReactionTooltipState>({
		x: 0,
		y: 0,
		isOpen: false,
		isReady: false,
	});

	const clearTimers = useCallback(() => {
		if (hoverTimerRef.current) {
			clearTimeout(hoverTimerRef.current);
			hoverTimerRef.current = null;
		}
		if (closeTimerRef.current) {
			clearTimeout(closeTimerRef.current);
			closeTimerRef.current = null;
		}
	}, []);

	const isInHoverRegion = useCallback((node: EventTarget | null) => {
		if (!node || !(node instanceof Node)) return false;
		return !!targetRef.current?.contains(node) || !!tooltipRef.current?.contains(node);
	}, []);

	const updateLastPointer = useCallback((event: MouseEvent | React.MouseEvent | PointerEvent) => {
		lastPointerRef.current = {x: event.clientX, y: event.clientY};
	}, []);

	const shouldKeepOpen = useCallback(() => {
		const lastPointer = lastPointerRef.current;
		if (!lastPointer) return false;
		const element = document.elementFromPoint(lastPointer.x, lastPointer.y);
		return isInHoverRegion(element);
	}, [isInHoverRegion]);

	const updatePosition = useCallback(async () => {
		if (!state.isOpen || !targetRef.current || !tooltipRef.current || isCalculatingRef.current) {
			return;
		}

		if (!document.contains(targetRef.current)) {
			setState((prev) => ({...prev, isOpen: false, isReady: false}));
			return;
		}

		isCalculatingRef.current = true;

		try {
			const target = targetRef.current;
			const tooltip = tooltipRef.current;

			Object.assign(tooltip.style, {
				position: 'fixed',
				left: '-9999px',
				top: '-9999px',
			});

			const middleware = [offset(8), flip(), shift({padding: 8})];

			const {x, y} = await computePosition(target, tooltip, {
				placement,
				middleware,
			});

			Object.assign(tooltip.style, {
				left: `${x}px`,
				top: `${y}px`,
			});

			setState((prev) => ({...prev, x, y, isReady: true}));
		} catch (error) {
			logger.error('Error positioning reaction tooltip', error);
		} finally {
			isCalculatingRef.current = false;
		}
	}, [state.isOpen, placement]);

	const show = useCallback(() => {
		clearTimers();
		setState((prev) => ({...prev, isOpen: true, isReady: false}));
	}, [clearTimers]);

	const hide = useCallback(() => {
		clearTimers();
		setState({x: 0, y: 0, isOpen: false, isReady: false});
	}, [clearTimers]);

	const scheduleHide = useCallback(() => {
		closeTimerRef.current = setTimeout(() => {
			if (shouldKeepOpen()) {
				return;
			}
			hide();
		}, 100);
	}, [hide, shouldKeepOpen]);

	const handleMouseEnter = useCallback(() => {
		clearTimers();
		if (state.isOpen) return;
		hoverTimerRef.current = setTimeout(() => {
			show();
		}, hoverDelay);
	}, [show, hoverDelay, clearTimers, state.isOpen]);

	const handleMouseLeave = useCallback(
		(event: React.MouseEvent) => {
			clearTimers();
			updateLastPointer(event);

			if (isInHoverRegion(event.relatedTarget)) {
				return;
			}

			scheduleHide();
		},
		[clearTimers, isInHoverRegion, scheduleHide, updateLastPointer],
	);

	const handleFocus = useCallback(() => {
		clearTimers();
		if (!state.isOpen) {
			show();
		}
	}, [clearTimers, show, state.isOpen]);

	const handleBlur = useCallback(() => {
		clearTimers();
		scheduleHide();
	}, [clearTimers, scheduleHide]);

	const handleTooltipMouseEnter = useCallback(
		(event: React.MouseEvent) => {
			clearTimers();
			updateLastPointer(event);
		},
		[clearTimers, updateLastPointer],
	);

	const handleTooltipMouseLeave = useCallback(
		(event: React.MouseEvent) => {
			clearTimers();
			updateLastPointer(event);

			if (isInHoverRegion(event.relatedTarget)) {
				return;
			}

			scheduleHide();
		},
		[clearTimers, isInHoverRegion, scheduleHide, updateLastPointer],
	);

	useEffect(() => {
		if (!state.isOpen || !targetRef.current || !tooltipRef.current) {
			if (cleanupRef.current) {
				cleanupRef.current();
				cleanupRef.current = null;
			}
			return;
		}

		if (!document.contains(targetRef.current)) {
			setState({x: 0, y: 0, isOpen: false, isReady: false});
			return;
		}

		updatePosition();

		cleanupRef.current = autoUpdate(targetRef.current, tooltipRef.current, updatePosition, {
			ancestorScroll: true,
			ancestorResize: true,
			elementResize: true,
			layoutShift: true,
		});

		return () => {
			if (cleanupRef.current) {
				cleanupRef.current();
				cleanupRef.current = null;
			}
		};
	}, [state.isOpen, updatePosition]);

	useEffect(() => {
		if (!state.isOpen) {
			return;
		}

		const handlePointerMove = (event: PointerEvent | MouseEvent) => {
			lastPointerRef.current = {x: event.clientX, y: event.clientY};
		};

		window.addEventListener('pointermove', handlePointerMove, {passive: true});
		window.addEventListener('mousemove', handlePointerMove, {passive: true});

		return () => {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('mousemove', handlePointerMove);
		};
	}, [state.isOpen]);

	useEffect(() => {
		return () => {
			clearTimers();
			if (cleanupRef.current) {
				cleanupRef.current();
				cleanupRef.current = null;
			}
		};
	}, [clearTimers]);

	return {
		targetRef,
		tooltipRef,
		state,
		updatePosition,
		show,
		hide,
		handlers: {
			onMouseEnter: handleMouseEnter,
			onMouseLeave: handleMouseLeave,
			onFocus: handleFocus,
			onBlur: handleBlur,
		},
		tooltipHandlers: {
			onMouseEnter: handleTooltipMouseEnter,
			onMouseLeave: handleTooltipMouseLeave,
		},
	};
}
