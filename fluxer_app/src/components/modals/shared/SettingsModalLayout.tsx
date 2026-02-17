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

import styles from '@app/components/modals/shared/SettingsModalLayout.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import {
	type SettingsModalSidebarItemProps,
	useSettingsModalSidebarItemLogic,
} from '@app/utils/modals/SettingsModalLayoutUtils';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import React, {useContext, useEffect, useId, useMemo, useRef, useState} from 'react';

interface SettingsModalContextValue {
	fullscreen: boolean;
}

const SettingsModalContext = React.createContext<SettingsModalContextValue>({
	fullscreen: false,
});

export const SettingsModalContainer: React.FC<{children: React.ReactNode; fullscreen?: boolean}> = observer(
	({children, fullscreen = false}) => {
		const contextValue = useMemo(() => ({fullscreen}), [fullscreen]);
		return (
			<SettingsModalContext.Provider value={contextValue}>
				<div className={clsx(styles.container, {[styles.containerFullscreen]: fullscreen})}>{children}</div>
			</SettingsModalContext.Provider>
		);
	},
);

export const SettingsModalDesktopSidebar: React.FC<{children: React.ReactNode}> = observer(({children}) => {
	return (
		<div className={styles.desktopSidebar}>
			<div className={styles.desktopSidebarInner}>{children}</div>
		</div>
	);
});

interface SettingsModalDesktopContentProps {
	children: React.ReactNode;
	tabpanelId?: string;
	labelledBy?: string;
}

const SettingsModalDesktopContentComponent = React.forwardRef<HTMLDivElement, SettingsModalDesktopContentProps>(
	({children, tabpanelId, labelledBy}, ref) => {
		return (
			<div
				ref={ref}
				className={styles.desktopContent}
				role="tabpanel"
				id={tabpanelId}
				aria-labelledby={labelledBy}
				tabIndex={-1}
			>
				<div className={styles.desktopContentPad}>
					<div className={styles.desktopContentCard}>{children}</div>
				</div>
			</div>
		);
	},
);

export const SettingsModalDesktopContent = observer(SettingsModalDesktopContentComponent);

interface SettingsModalDesktopScrollProps {
	children: React.ReactNode;
	scrollKey?: string;
	scrollerRef?: React.RefObject<HTMLElement | null>;
}

export const SettingsModalDesktopScroll: React.FC<SettingsModalDesktopScrollProps> = observer(
	({children, scrollKey, scrollerRef}) => {
		const internalRef = useRef<ScrollerHandle | null>(null);

		useEffect(() => {
			if (scrollerRef && internalRef.current) {
				const node = internalRef.current.getScrollerNode();
				(scrollerRef as React.MutableRefObject<HTMLElement | null>).current = node;
			}
		});

		return (
			<Scroller
				ref={internalRef}
				className={styles.desktopScroll}
				key={scrollKey ?? 'settings-modal-desktop-scroll'}
				data-settings-scroll-container
			>
				<div className={styles.desktopScrollSpacerTop} />
				<div className={styles.desktopScrollInner}>{children}</div>
				<div className={styles.desktopScrollSpacerBottom} />
			</Scroller>
		);
	},
);

interface SidebarCategoryContextValue {
	setTitleId: (id: string | null) => void;
}

const SidebarCategoryContext = React.createContext<SidebarCategoryContextValue | null>(null);

interface SidebarTablistContextValue {
	hasSelectedTabInView: boolean;
}

const SidebarTablistContext = React.createContext<SidebarTablistContextValue>({
	hasSelectedTabInView: true,
});

interface SettingsModalSidebarNavProps {
	children: React.ReactNode;
	header?: React.ReactNode;
	hasSelectedTabInView?: boolean;
	footer?: React.ReactNode;
}

export const SettingsModalSidebarNav: React.FC<SettingsModalSidebarNavProps> = observer(
	({children, header, hasSelectedTabInView = true, footer}) => {
		const {t} = useLingui();
		const tablistContextValue = useMemo(() => ({hasSelectedTabInView}), [hasSelectedTabInView]);

		return (
			<SidebarTablistContext.Provider value={tablistContextValue}>
				{header && <div className={styles.sidebarHeader}>{header}</div>}
				<nav aria-label={t`Settings sections`} className={styles.sidebarNavWrapper}>
					<Scroller className={styles.sidebarNav} key="settings-modal-sidebar-nav">
						<div className={styles.sidebarNavContent}>
							<div className={styles.sidebarNavList} role="tablist" aria-orientation="vertical" data-settings-tablist>
								{children}
							</div>
							{footer && <div className={styles.sidebarNavFooter}>{footer}</div>}
						</div>
					</Scroller>
				</nav>
			</SidebarTablistContext.Provider>
		);
	},
);

export const SettingsModalSidebarCategory: React.FC<{children: React.ReactNode}> = observer(({children}) => {
	const [titleId, setTitleId] = useState<string | null>(null);
	const contextValue = useMemo<SidebarCategoryContextValue>(() => ({setTitleId}), []);
	return (
		<SidebarCategoryContext.Provider value={contextValue}>
			<section className={styles.sidebarCategory} aria-labelledby={titleId ?? undefined}>
				{children}
			</section>
		</SidebarCategoryContext.Provider>
	);
});

export const SettingsModalSidebarCategoryTitle: React.FC<{children: React.ReactNode}> = observer(({children}) => {
	const context = useContext(SidebarCategoryContext);
	const titleId = useId();
	useEffect(() => {
		context?.setTitleId(titleId);
		return () => context?.setTitleId(null);
	}, [context, titleId]);
	return (
		<h2 id={titleId} className={styles.sidebarCategoryTitle}>
			{children}
		</h2>
	);
});

export const SettingsModalSidebarItem: React.FC<SettingsModalSidebarItemProps> = observer(
	({
		label,
		icon: IconComponent,
		iconWeight = 'fill',
		selected,
		danger,
		onClick,
		onKeyDown,
		onRequestContentFocus,
		id,
		controlsId,
	}) => {
		const ref = useRef<HTMLButtonElement>(null);
		const {hasSelectedTabInView} = useContext(SidebarTablistContext);

		const {tabIndex, handleKeyDown} = useSettingsModalSidebarItemLogic({
			selected,
			onClick,
			onKeyDown,
			onRequestContentFocus,
			hasSelectedTabInView,
		});

		const isTabRole = id != null && controlsId != null;
		const sharedProps = {
			ref,
			id,
			type: 'button' as const,
			className: clsx(styles.sidebarItem, {
				[styles.sidebarItemSelected]: selected,
				[styles.sidebarItemDanger]: danger,
			}),
			onClick,
			onKeyDown: handleKeyDown,
		};

		const content = (
			<>
				<IconComponent className={styles.sidebarItemIcon} size={20} weight={iconWeight} />
				<span className={styles.sidebarItemLabel}>{label}</span>
			</>
		);

		return (
			<FocusRing offset={-2}>
				{isTabRole ? (
					<button
						{...sharedProps}
						data-settings-tab="true"
						role="tab"
						aria-selected={Boolean(selected)}
						aria-controls={controlsId}
						tabIndex={tabIndex}
					>
						{content}
					</button>
				) : (
					<button {...sharedProps} aria-controls={controlsId} tabIndex={0}>
						{content}
					</button>
				)}
			</FocusRing>
		);
	},
);

export const SettingsModalSidebarFooter: React.FC<{children: React.ReactNode}> = observer(({children}) => {
	return <div className={styles.sidebarFooter}>{children}</div>;
});

export interface SettingsModalSidebarSubItemProps {
	label: React.ReactNode;
	sectionId: string;
	isActive: boolean;
	onClick: () => void;
}

export const SettingsModalSidebarSubItem: React.FC<SettingsModalSidebarSubItemProps> = observer(
	({label, sectionId, isActive, onClick}) => {
		return (
			<FocusRing offset={-2}>
				<button
					type="button"
					className={clsx(styles.sidebarSubItem, isActive && styles.sidebarSubItemActive)}
					onClick={onClick}
					data-section-id={sectionId}
				>
					<span className={styles.sidebarSubItemIndicator} />
					<span className={styles.sidebarSubItemLabel}>{label}</span>
				</button>
			</FocusRing>
		);
	},
);

export interface SettingsModalSidebarSubItemsProps {
	children: React.ReactNode;
}

export const SettingsModalSidebarSubItems: React.FC<SettingsModalSidebarSubItemsProps> = observer(({children}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const childrenArray = React.Children.toArray(children);
	const reducedMotion = AccessibilityStore.useReducedMotion;

	const activeIndex = childrenArray.findIndex((child) => {
		if (!React.isValidElement(child)) return false;
		const element = child as React.ReactElement<{isActive?: boolean}>;
		return element.props?.isActive === true;
	});

	const hasActive = activeIndex !== -1;

	useEffect(() => {
		if (!containerRef.current || !hasActive) return;

		const container = containerRef.current;
		const childElements = Array.from(container.children) as Array<HTMLElement>;
		const activeElement = childElements[activeIndex] as HTMLElement;

		if (!activeElement) return;

		const containerRect = container.getBoundingClientRect();
		const activeRect = activeElement.getBoundingClientRect();

		const top = activeRect.top - containerRect.top;
		const height = activeRect.height;

		container.style.setProperty('--active-top', `${top}px`);
		container.style.setProperty('--active-height', `${height}px`);
	}, [activeIndex, hasActive, children]);

	return (
		<div
			ref={containerRef}
			className={styles.sidebarSubItems}
			data-has-active={hasActive}
			data-reduced-motion={reducedMotion}
			style={
				hasActive
					? ({
							'--active-top': '0px',
							'--active-height': '0px',
						} as React.CSSProperties)
					: undefined
			}
		>
			{children}
		</div>
	);
});

export const settingsModalStyles = styles;
