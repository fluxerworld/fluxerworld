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

import {useCallback, useEffect, useRef, useState} from 'react';

export interface UseScrollSpyOptions {
	sectionIds: ReadonlyArray<string>;
	containerRef: React.RefObject<HTMLElement | null>;
	offset?: number;
}

export interface UseScrollSpyReturn {
	activeSectionId: string | null;
	scrollToSection: (sectionId: string) => void;
}

export function useScrollSpy({sectionIds, containerRef, offset = 68}: UseScrollSpyOptions): UseScrollSpyReturn {
	const [activeSectionId, setActiveSectionId] = useState<string | null>(sectionIds[0] ?? null);
	const rafIdRef = useRef<number | null>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || sectionIds.length === 0) {
			setActiveSectionId(null);
			return;
		}

		const updateActive = () => {
			const containerRect = container.getBoundingClientRect();
			const scrollTop = container.scrollTop;
			const maxScrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
			const isAtBottom = scrollTop >= maxScrollTop - 1;
			const target = scrollTop + offset + 1;
			let nextActive: string | null = null;

			for (const id of sectionIds) {
				const element = document.getElementById(id);
				if (!element) continue;

				const rect = element.getBoundingClientRect();
				const elementTop = rect.top - containerRect.top + scrollTop;

				if (elementTop <= target) {
					nextActive = id;
				} else if (nextActive) {
					break;
				}
			}

			if (!nextActive && sectionIds.length > 0) {
				nextActive = sectionIds[0];
			}

			if (isAtBottom && sectionIds.length > 0) {
				nextActive = sectionIds[sectionIds.length - 1];
			}

			if (nextActive) {
				setActiveSectionId((prev) => (prev === nextActive ? prev : nextActive));
			}
		};

		const scheduleUpdate = () => {
			if (rafIdRef.current != null) return;
			rafIdRef.current = window.requestAnimationFrame(() => {
				rafIdRef.current = null;
				updateActive();
			});
		};

		scheduleUpdate();
		container.addEventListener('scroll', scheduleUpdate, {passive: true});
		window.addEventListener('resize', scheduleUpdate);

		const resizeObserver = new ResizeObserver(() => scheduleUpdate());
		resizeObserver.observe(container);

		return () => {
			container.removeEventListener('scroll', scheduleUpdate);
			window.removeEventListener('resize', scheduleUpdate);
			resizeObserver.disconnect();
			if (rafIdRef.current != null) {
				cancelAnimationFrame(rafIdRef.current);
				rafIdRef.current = null;
			}
		};
	}, [sectionIds, containerRef, offset]);

	const scrollToSection = useCallback(
		(sectionId: string) => {
			const element = document.getElementById(sectionId);
			const container = containerRef.current;
			if (!element || !container) {
				return;
			}

			const containerRect = container.getBoundingClientRect();
			const elementRect = element.getBoundingClientRect();
			const scrollTop = container.scrollTop + (elementRect.top - containerRect.top) - offset;

			container.scrollTo({
				top: scrollTop,
				behavior: 'auto',
			});

			setActiveSectionId(sectionId);
		},
		[containerRef, offset],
	);

	return {activeSectionId, scrollToSection};
}
