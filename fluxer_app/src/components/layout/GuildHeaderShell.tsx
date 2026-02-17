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

import {LongPressable} from '@app/components/LongPressable';
import styles from '@app/components/layout/GuildHeader.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Popout} from '@app/components/uikit/popout/Popout';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import PopoutStore from '@app/stores/PopoutStore';
import {isMobileExperienceEnabled} from '@app/utils/MobileExperience';
import {observer} from 'mobx-react-lite';
import React, {useCallback, useRef, useState} from 'react';

interface GuildHeaderShellProps {
	popoutId: string;
	renderPopout: () => React.ReactNode;
	renderBottomSheet: (props: {isOpen: boolean; onClose: () => void}) => React.ReactNode;
	onContextMenu: (event: React.MouseEvent) => void;
	children: React.ReactNode | ((isOpen: boolean) => React.ReactNode);
	className?: string;
	triggerRef?: React.Ref<HTMLDivElement>;
}

const GuildHeaderTrigger = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	(props, forwardedRef) => {
		const {children, ...rest} = props;
		const triggerRef = useRef<HTMLDivElement | null>(null);
		const mergedRef = useMergeRefs([triggerRef, forwardedRef]);

		return (
			<FocusRing ringClassName={styles.headerFocusRing} focusTarget={triggerRef} ringTarget={triggerRef} offset={0}>
				<div {...rest} ref={mergedRef}>
					{children}
				</div>
			</FocusRing>
		);
	},
);

GuildHeaderTrigger.displayName = 'GuildHeaderTrigger';

export const GuildHeaderShell = observer(
	({
		popoutId,
		renderPopout,
		renderBottomSheet,
		onContextMenu,
		children,
		className,
		triggerRef,
	}: GuildHeaderShellProps) => {
		const {popouts} = PopoutStore;
		const isOpen = popoutId in popouts;
		const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
		const isMobile = isMobileExperienceEnabled();
		const internalRef = useRef<HTMLDivElement | null>(null);
		const mergedRef = useMergeRefs([internalRef, triggerRef]);

		const handleOpenBottomSheet = useCallback(() => {
			setBottomSheetOpen(true);
		}, []);

		const handleCloseBottomSheet = useCallback(() => {
			setBottomSheetOpen(false);
		}, []);

		const handleContextMenuWrapper = useCallback(
			(event: React.MouseEvent) => {
				event.preventDefault();
				event.stopPropagation();
				if (isMobile) {
					handleOpenBottomSheet();
				} else {
					onContextMenu(event);
				}
			},
			[isMobile, handleOpenBottomSheet, onContextMenu],
		);

		if (isMobile) {
			return (
				<>
					<FocusRing
						ringClassName={styles.headerFocusRing}
						focusTarget={internalRef}
						ringTarget={internalRef}
						offset={0}
					>
						<LongPressable
							className={className}
							onClick={handleOpenBottomSheet}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleOpenBottomSheet();
								}
							}}
							onContextMenu={handleContextMenuWrapper}
							onLongPress={handleOpenBottomSheet}
							role="button"
							tabIndex={0}
							ref={mergedRef}
						>
							{typeof children === 'function' ? children(bottomSheetOpen) : children}
						</LongPressable>
					</FocusRing>
					{renderBottomSheet({isOpen: bottomSheetOpen, onClose: handleCloseBottomSheet})}
				</>
			);
		}

		return (
			<Popout uniqueId={popoutId} render={renderPopout} position="bottom">
				<GuildHeaderTrigger
					className={className}
					onContextMenu={handleContextMenuWrapper}
					role="button"
					tabIndex={0}
					ref={mergedRef}
				>
					{typeof children === 'function' ? children(isOpen) : children}
				</GuildHeaderTrigger>
			</Popout>
		);
	},
);
