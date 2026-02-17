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
import channelItemStyles from '@app/components/layout/ChannelItem.module.css';
import channelItemSurfaceStyles from '@app/components/layout/ChannelItemSurface.module.css';
import {DropIndicator} from '@app/components/layout/DropIndicator';
import type {ScrollIndicatorSeverity} from '@app/components/layout/ScrollIndicatorOverlay';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {CaretDownIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import React from 'react';

interface GenericChannelItemProps {
	icon?: React.ReactNode;
	name?: string;
	actions?: React.ReactNode;
	badges?: React.ReactNode;
	isSelected?: boolean;
	isMuted?: boolean;
	isDragging?: boolean;
	isOver?: boolean;
	dropIndicator?: {position: 'top' | 'bottom'; isValid: boolean} | null;
	onClick?: () => void;
	onContextMenu?: (event: React.MouseEvent) => void;
	onKeyDown?: (event: React.KeyboardEvent) => void;
	onFocus?: () => void;
	onBlur?: () => void;
	onLongPress?: () => void;
	innerRef?: React.Ref<HTMLDivElement>;
	className?: string;
	pressedClassName?: string;
	containerClassName?: string;
	style?: React.CSSProperties;
	isCategory?: boolean;
	isCollapsed?: boolean;
	onToggle?: () => void;
	disabled?: boolean;
	role?: string;
	tabIndex?: number;
	children?: React.ReactNode;
	extraContent?: React.ReactNode;
	'aria-label'?: string;
	'data-dnd-name'?: string;
	dataScrollIndicator?: ScrollIndicatorSeverity;
	dataScrollId?: string;
	onMouseEnter?: (event: React.MouseEvent) => void;
	onMouseLeave?: (event: React.MouseEvent) => void;
}

export const GenericChannelItem = React.forwardRef<HTMLDivElement, GenericChannelItemProps>(
	(
		{
			icon,
			name,
			actions,
			badges,
			isSelected,
			isOver,
			dropIndicator,
			onClick,
			onContextMenu,
			onKeyDown,
			onFocus,
			onBlur,
			onLongPress,
			innerRef,
			className,
			pressedClassName,
			containerClassName,
			style,
			isCategory,
			isCollapsed,
			disabled,
			role = 'button',
			tabIndex = 0,
			children,
			extraContent,
			'aria-label': ariaLabel,
			'data-dnd-name': dataDndName,
			dataScrollIndicator,
			dataScrollId,
			onMouseEnter,
			onMouseLeave,
		},
		ref,
	) => {
		return (
			<div className={containerClassName} style={{position: 'relative', ...style}} ref={ref}>
				{extraContent}
				{isOver && dropIndicator && <DropIndicator position={dropIndicator.position} isValid={dropIndicator.isValid} />}
				<FocusRing offset={-2} ringClassName={channelItemSurfaceStyles.channelItemFocusRing}>
					<LongPressable
						ref={innerRef}
						disabled={disabled}
						className={clsx(
							channelItemSurfaceStyles.channelItemSurface,
							isSelected && channelItemSurfaceStyles.channelItemSurfaceSelected,
							className,
						)}
						pressedClassName={pressedClassName ?? channelItemStyles.channelItemPressed}
						onClick={onClick}
						onContextMenu={onContextMenu}
						onKeyDown={onKeyDown}
						onFocus={onFocus}
						onBlur={onBlur}
						onMouseEnter={onMouseEnter}
						onMouseLeave={onMouseLeave}
						role={role}
						tabIndex={tabIndex}
						onLongPress={onLongPress}
						aria-label={ariaLabel}
						data-dnd-name={dataDndName}
						data-scroll-indicator={dataScrollIndicator}
						data-scroll-id={dataScrollId}
					>
						{children ? (
							children
						) : (
							<>
								{isCategory ? (
									<div className={channelItemStyles.categoryContainer}>
										<span className={channelItemStyles.categoryName}>{name}</span>
										<CaretDownIcon weight="bold" style={{transform: `rotate(${isCollapsed ? -90 : 0}deg)`}} />
									</div>
								) : (
									<>
										{icon && <div className={channelItemStyles.iconContainer}>{icon}</div>}
										<span className={channelItemStyles.channelName}>{name}</span>
									</>
								)}
								<div className={channelItemStyles.actionsContainer}>
									{actions}
									{badges}
								</div>
							</>
						)}
					</LongPressable>
				</FocusRing>
			</div>
		);
	},
);

GenericChannelItem.displayName = 'GenericChannelItem';
