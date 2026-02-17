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

import sectionStyles from '@app/components/modals/shared/SettingsSection.module.css';
import styles from '@app/components/uikit/accordion/Accordion.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {CaretDownIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useRef, useState} from 'react';

export interface AccordionProps {
	id: string;
	title: React.ReactNode;
	description?: React.ReactNode;
	defaultExpanded?: boolean;
	expanded?: boolean;
	onExpandedChange?: (expanded: boolean) => void;
	children: React.ReactNode;
	className?: string;
}

export const Accordion: React.FC<AccordionProps> = observer(
	({
		id,
		title,
		description,
		defaultExpanded = false,
		expanded: controlledExpanded,
		onExpandedChange,
		children,
		className,
	}) => {
		const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
		const headerRef = useRef<HTMLButtonElement>(null);
		const scrollContainerRef = useRef<HTMLElement | null>(null);
		const wasAtBottomRef = useRef(false);
		const contentId = `${id}-content`;

		const isControlled = controlledExpanded !== undefined;
		const expanded = isControlled ? controlledExpanded : internalExpanded;

		const handleToggle = useCallback(() => {
			const scrollContainer = headerRef.current?.closest('[data-settings-scroll-container]') as HTMLElement | null;

			wasAtBottomRef.current =
				scrollContainer != null &&
				Math.abs(scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight) < 50;

			scrollContainerRef.current = scrollContainer;

			const newExpanded = !expanded;

			if (isControlled) {
				onExpandedChange?.(newExpanded);
			} else {
				setInternalExpanded(newExpanded);
				onExpandedChange?.(newExpanded);
			}

			if (scrollContainer && !newExpanded) {
				const headerRect = headerRef.current?.getBoundingClientRect();
				const containerRect = scrollContainer?.getBoundingClientRect();
				const offsetFromContainer = headerRect && containerRect ? headerRect.top - containerRect.top : null;

				if (offsetFromContainer !== null) {
					requestAnimationFrame(() => {
						const newHeaderRect = headerRef.current?.getBoundingClientRect();
						const newContainerRect = scrollContainer.getBoundingClientRect();
						if (newHeaderRect && newContainerRect) {
							const newOffset = newHeaderRect.top - newContainerRect.top;
							const delta = newOffset - offsetFromContainer;
							if (Math.abs(delta) > 1) {
								scrollContainer.scrollTop += delta;
							}
						}
					});
				}
			}
		}, [expanded, isControlled, onExpandedChange, id]);

		useEffect(() => {
			if (expanded && scrollContainerRef.current && wasAtBottomRef.current) {
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						if (scrollContainerRef.current) {
							scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
						}
					});
				});
			}
			if (!expanded) {
				wasAtBottomRef.current = false;
				scrollContainerRef.current = null;
			}
		}, [expanded]);

		return (
			<div className={clsx(styles.accordion, className)} id={id}>
				<FocusRing offset={-2}>
					<button
						ref={headerRef}
						type="button"
						className={styles.header}
						onClick={handleToggle}
						aria-expanded={expanded}
						aria-controls={contentId}
					>
						<div className={styles.headerContent}>
							<span className={sectionStyles.sectionTitle}>{title}</span>
							{description ? <span className={sectionStyles.sectionDescription}>{description}</span> : null}
						</div>
						<CaretDownIcon className={clsx(styles.caret, expanded && styles.caretExpanded)} size={20} weight="bold" />
					</button>
				</FocusRing>
				{expanded ? (
					<div id={contentId} className={styles.contentWrapper}>
						<div className={styles.content}>{children}</div>
					</div>
				) : null}
			</div>
		);
	},
);
