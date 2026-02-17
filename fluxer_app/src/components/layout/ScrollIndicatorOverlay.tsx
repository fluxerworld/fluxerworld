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

import styles from '@app/components/layout/ScrollIndicatorOverlay.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {clsx} from 'clsx';
import {AnimatePresence, motion} from 'framer-motion';
import type React from 'react';
import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';

export type ScrollIndicatorSeverity = 'mention' | 'unread';

interface ScrollEdgeIndicator {
	element: HTMLElement;
	severity: ScrollIndicatorSeverity;
	distance: number;
	id?: string;
}

type ScrollIndicatorDirection = 'top' | 'bottom';

interface ActiveScrollIndicator {
	direction: ScrollIndicatorDirection;
	indicator: ScrollEdgeIndicator;
}

const severityOrder: Record<ScrollIndicatorSeverity, number> = {
	mention: 2,
	unread: 1,
};

function pickActiveIndicator(
	topIndicator: ScrollEdgeIndicator | null,
	bottomIndicator: ScrollEdgeIndicator | null,
	preferredDirection: ScrollIndicatorDirection | null,
	previousDirection: ScrollIndicatorDirection | null,
): ActiveScrollIndicator | null {
	if (!topIndicator && !bottomIndicator) return null;
	if (!topIndicator && bottomIndicator) {
		return {direction: 'bottom', indicator: bottomIndicator};
	}
	if (topIndicator && !bottomIndicator) {
		return {direction: 'top', indicator: topIndicator};
	}

	if (!topIndicator || !bottomIndicator) return null;

	const topSeverityRank = severityOrder[topIndicator.severity];
	const bottomSeverityRank = severityOrder[bottomIndicator.severity];

	if (topSeverityRank > bottomSeverityRank) {
		return {direction: 'top', indicator: topIndicator};
	}
	if (bottomSeverityRank > topSeverityRank) {
		return {direction: 'bottom', indicator: bottomIndicator};
	}

	if (topIndicator.distance < bottomIndicator.distance) {
		return {direction: 'top', indicator: topIndicator};
	}
	if (bottomIndicator.distance < topIndicator.distance) {
		return {direction: 'bottom', indicator: bottomIndicator};
	}

	if (preferredDirection === 'top') {
		return {direction: 'top', indicator: topIndicator};
	}
	if (preferredDirection === 'bottom') {
		return {direction: 'bottom', indicator: bottomIndicator};
	}

	if (previousDirection === 'top') {
		return {direction: 'top', indicator: topIndicator};
	}
	if (previousDirection === 'bottom') {
		return {direction: 'bottom', indicator: bottomIndicator};
	}

	return {direction: 'top', indicator: topIndicator};
}

export const useScrollEdgeIndicators = (
	getScrollContainer: () => HTMLElement | null,
	dependencies: React.DependencyList = [],
) => {
	const [activeIndicator, setActiveIndicator] = useState<ActiveScrollIndicator | null>(null);
	const preferredDirectionRef = useRef<ScrollIndicatorDirection | null>(null);
	const lastScrollTopRef = useRef(0);

	const refresh = useCallback(() => {
		const container = getScrollContainer();
		if (!container) {
			setActiveIndicator(null);
			return;
		}

		const containerRect = container.getBoundingClientRect();
		const nodes = container.querySelectorAll<HTMLElement>(
			'[data-scroll-indicator="mention"],[data-scroll-indicator="unread"]',
		);

		let nextTop: ScrollEdgeIndicator | null = null;
		let nextBottom: ScrollEdgeIndicator | null = null;
		let topDistance = Infinity;
		let bottomDistance = Infinity;

		for (const node of nodes) {
			const datasetValue = node.dataset.scrollIndicator as ScrollIndicatorSeverity | undefined;
			if (!datasetValue) continue;
			const rect = node.getBoundingClientRect();
			const nodeId = node.dataset.scrollId;

			if (rect.bottom <= containerRect.top) {
				const distance = containerRect.top - rect.bottom;
				if (
					!nextTop ||
					severityOrder[datasetValue] > severityOrder[nextTop.severity] ||
					(severityOrder[datasetValue] === severityOrder[nextTop.severity] && distance < topDistance)
				) {
					nextTop = {element: node, severity: datasetValue, distance, id: nodeId};
					topDistance = distance;
				}
			} else if (rect.top >= containerRect.bottom) {
				const distance = rect.top - containerRect.bottom;
				if (
					!nextBottom ||
					severityOrder[datasetValue] > severityOrder[nextBottom.severity] ||
					(severityOrder[datasetValue] === severityOrder[nextBottom.severity] && distance < bottomDistance)
				) {
					nextBottom = {element: node, severity: datasetValue, distance, id: nodeId};
					bottomDistance = distance;
				}
			}
		}

		setActiveIndicator((previous) => {
			const nextActive = pickActiveIndicator(
				nextTop,
				nextBottom,
				preferredDirectionRef.current,
				previous?.direction ?? null,
			);
			if (
				previous &&
				nextActive &&
				previous.direction === nextActive.direction &&
				previous.indicator.element === nextActive.indicator.element &&
				previous.indicator.severity === nextActive.indicator.severity
			) {
				return previous;
			}
			return nextActive;
		});
	}, [getScrollContainer]);

	useLayoutEffect(() => {
		refresh();
	}, [refresh, ...dependencies]);

	useEffect(() => {
		const container = getScrollContainer();
		if (!container) return;

		lastScrollTopRef.current = container.scrollTop;

		const handleScroll = () => {
			const currentScrollTop = container.scrollTop;
			if (currentScrollTop > lastScrollTopRef.current) {
				preferredDirectionRef.current = 'bottom';
			} else if (currentScrollTop < lastScrollTopRef.current) {
				preferredDirectionRef.current = 'top';
			}
			lastScrollTopRef.current = currentScrollTop;
			refresh();
		};
		container.addEventListener('scroll', handleScroll, {passive: true});
		return () => {
			container.removeEventListener('scroll', handleScroll);
		};
	}, [getScrollContainer, refresh]);

	useEffect(() => {
		const handleResize = () => refresh();
		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}, [refresh]);

	return {activeIndicator, refresh};
};

interface FloatingScrollIndicatorProps {
	label: React.ReactNode;
	severity: ScrollIndicatorSeverity;
	direction: 'top' | 'bottom';
	onClick: () => void;
}

const FloatingScrollIndicator = ({label, severity, direction, onClick}: FloatingScrollIndicatorProps) => {
	const offset = direction === 'top' ? -24 : 24;
	const prefersReducedMotion = AccessibilityStore.useReducedMotion;

	return (
		<FocusRing offset={-2}>
			<motion.button
				type="button"
				className={clsx(styles.indicator, severity === 'mention' ? styles.indicatorMention : styles.indicatorBrand)}
				onClick={onClick}
				initial={prefersReducedMotion ? {opacity: 1, y: 0, scale: 1} : {opacity: 0, y: offset, scale: 0.9}}
				animate={{opacity: 1, y: 0, scale: 1}}
				exit={
					prefersReducedMotion
						? {opacity: 1, y: 0, scale: 1, transition: {duration: 0}}
						: {
								opacity: 0,
								y: offset,
								scale: direction === 'top' ? 0.9 : 0.95,
								transition: {duration: 0.15, ease: 'easeIn'},
							}
				}
				transition={
					prefersReducedMotion
						? {duration: 0}
						: {
								type: 'spring',
								stiffness: 600,
								damping: 18,
								mass: 0.6,
							}
				}
				whileHover={prefersReducedMotion ? undefined : {scale: 1.05}}
				whileTap={prefersReducedMotion ? undefined : {scale: 0.95}}
				aria-label={typeof label === 'string' ? label : undefined}
			>
				{label}
			</motion.button>
		</FocusRing>
	);
};

interface ScrollIndicatorOverlayProps {
	getScrollContainer: () => HTMLElement | null;
	dependencies?: React.DependencyList;
	label: React.ReactNode;
}

export const ScrollIndicatorOverlay = ({getScrollContainer, dependencies = [], label}: ScrollIndicatorOverlayProps) => {
	const {activeIndicator} = useScrollEdgeIndicators(getScrollContainer, dependencies);

	const scrollIndicatorIntoView = (indicator: ScrollEdgeIndicator) => {
		indicator.element.scrollIntoView({behavior: 'smooth', block: 'nearest'});
	};

	return (
		<div className={styles.scrollIndicatorLayer}>
			<AnimatePresence initial={false}>
				{activeIndicator && (
					<div
						className={clsx(
							styles.indicatorSlot,
							activeIndicator.direction === 'top' ? styles.indicatorSlotTop : styles.indicatorSlotBottom,
						)}
					>
						<FloatingScrollIndicator
							direction={activeIndicator.direction}
							severity={activeIndicator.indicator.severity}
							onClick={() => scrollIndicatorIntoView(activeIndicator.indicator)}
							label={label}
						/>
					</div>
				)}
			</AnimatePresence>
		</div>
	);
};
