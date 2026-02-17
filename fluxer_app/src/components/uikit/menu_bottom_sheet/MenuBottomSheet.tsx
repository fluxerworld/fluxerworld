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

import {BottomSheet} from '@app/components/uikit/bottom_sheet/BottomSheet';
import styles from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet.module.css';
import {Slider} from '@app/components/uikit/Slider';
import {usePressable} from '@app/hooks/usePressable';
import {CaretLeftIcon, CaretRightIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useState} from 'react';

export interface MenuItemType {
	id?: string;
	icon?: React.ReactNode;
	label: string;
	onClick: () => void;
	danger?: boolean;
	disabled?: boolean;
	hint?: string;
	shortcut?: React.ReactNode;
	closeOnSelect?: boolean;
}

export interface MenuSubmenuItemType {
	id?: string;
	icon?: React.ReactNode;
	label: string;
	items: Array<MenuSheetItem>;
	disabled?: boolean;
	onTriggerSelect?: () => void;
}

export interface MenuSliderType {
	label: string;
	value: number;
	minValue: number;
	maxValue: number;
	onChange: (value: number) => void;
	onFormat?: (value: number) => string;
	factoryDefaultValue?: number;
}

export interface MenuCheckboxType {
	icon?: React.ReactNode;
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
}

export interface MenuRadioType {
	label: string;
	subtext?: string;
	selected: boolean;
	onSelect: () => void;
	disabled?: boolean;
}

export type MenuLeafItem = MenuItemType | MenuSliderType | MenuCheckboxType | MenuRadioType;
export type MenuSheetItem = MenuLeafItem | MenuSubmenuItemType;

export interface MenuGroupType {
	items: Array<MenuSheetItem>;
}

export interface MenuBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	groups: Array<MenuGroupType>;
	headerContent?: React.ReactNode;
	showCloseButton?: boolean;
}

const MenuCheckboxItem: React.FC<{item: MenuCheckboxType; isLast: boolean}> = observer(({item, isLast}) => {
	const {isPressed, pressableProps} = usePressable(item.disabled);
	return (
		<>
			<button
				type="button"
				role="checkbox"
				aria-checked={item.checked}
				aria-label={item.label}
				onClick={() => item.onChange(!item.checked)}
				disabled={item.disabled}
				className={clsx(styles.menuItem, item.disabled && styles.disabled, isPressed && styles.pressed)}
				{...pressableProps}
			>
				{item.icon && (
					<div className={styles.iconContainer} aria-hidden="true">
						{item.icon}
					</div>
				)}
				<span className={styles.label}>{item.label}</span>
				<div className={styles.checkboxContainer} aria-hidden="true">
					<div className={clsx(styles.checkbox, item.checked && styles.checked)}>
						{item.checked && (
							<svg className={styles.checkIcon} viewBox="0 0 12 12" fill="none" aria-hidden="true">
								<path
									d="M10 3L4.5 8.5L2 6"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						)}
					</div>
				</div>
			</button>
			{!isLast && <div className={styles.divider} />}
		</>
	);
});

const MenuRadioItem: React.FC<{item: MenuRadioType; isLast: boolean}> = observer(({item, isLast}) => {
	const {isPressed, pressableProps} = usePressable(item.disabled);
	return (
		<>
			<button
				type="button"
				role="radio"
				aria-checked={item.selected}
				aria-label={item.label}
				onClick={item.onSelect}
				disabled={item.disabled}
				className={clsx(styles.menuItem, item.disabled && styles.disabled, isPressed && styles.pressed)}
				{...pressableProps}
			>
				<div className={styles.radioContainer} aria-hidden="true">
					<div className={clsx(styles.radio, item.selected && styles.radioSelected)}>
						{item.selected && <div className={styles.radioInner} />}
					</div>
				</div>
				<div className={styles.labelColumn}>
					<span className={styles.label}>{item.label}</span>
					{item.subtext && <span className={styles.subtext}>{item.subtext}</span>}
				</div>
			</button>
			{!isLast && <div className={styles.divider} />}
		</>
	);
});

const MenuActionItem: React.FC<{item: MenuItemType; isLast: boolean}> = observer(({item, isLast}) => {
	const {isPressed, pressableProps} = usePressable(item.disabled);
	return (
		<>
			<button
				type="button"
				onClick={item.onClick}
				disabled={item.disabled}
				className={clsx(
					styles.menuItem,
					item.disabled && styles.disabled,
					item.danger && styles.danger,
					isPressed && styles.pressed,
					isPressed && item.danger && styles.pressedDanger,
				)}
				{...pressableProps}
			>
				{item.icon && (
					<div className={styles.iconContainer} aria-hidden="true">
						{item.icon}
					</div>
				)}
				<span className={styles.label}>{item.label}</span>
			</button>
			{!isLast && <div className={styles.divider} />}
		</>
	);
});

const MenuSliderItem: React.FC<{item: MenuSliderType; isLast: boolean}> = observer(({item, isLast}) => {
	return (
		<>
			<div className={styles.sliderContainer}>
				<span className={styles.sliderLabel}>{item.label}</span>
				<Slider
					defaultValue={item.value}
					factoryDefaultValue={item.factoryDefaultValue ?? item.value}
					minValue={item.minValue}
					maxValue={item.maxValue}
					onValueChange={item.onChange}
					onValueRender={item.onFormat}
					value={item.value}
					mini={true}
				/>
			</div>
			{!isLast && <div className={styles.divider} />}
		</>
	);
});

const MenuSubmenuItem: React.FC<{
	item: MenuSubmenuItemType;
	isLast: boolean;
	onExpand: (item: MenuSubmenuItemType) => void;
}> = observer(({item, isLast, onExpand}) => {
	const {isPressed, pressableProps} = usePressable(item.disabled);
	const handleClick = useCallback(() => {
		onExpand(item);
	}, [item, onExpand]);

	return (
		<>
			<button
				type="button"
				onClick={handleClick}
				disabled={item.disabled}
				className={clsx(styles.menuItem, item.disabled && styles.disabled, isPressed && styles.pressed)}
				{...pressableProps}
			>
				{item.icon && (
					<div className={styles.iconContainer} aria-hidden="true">
						{item.icon}
					</div>
				)}
				<span className={styles.label}>{item.label}</span>
				<CaretRightIcon size={20} className={styles.submenuChevron} />
			</button>
			{!isLast && <div className={styles.divider} />}
		</>
	);
});

const MenuItem: React.FC<{
	item: MenuItemType | MenuSliderType | MenuCheckboxType | MenuRadioType | MenuSubmenuItemType;
	isLast?: boolean;
	onExpandSubmenu?: (item: MenuSubmenuItemType) => void;
}> = observer(({item, isLast = false, onExpandSubmenu}) => {
	if ('checked' in item) {
		return <MenuCheckboxItem item={item as MenuCheckboxType} isLast={isLast} />;
	}
	if ('selected' in item) {
		return <MenuRadioItem item={item as MenuRadioType} isLast={isLast} />;
	}
	if ('items' in item && onExpandSubmenu) {
		return <MenuSubmenuItem item={item as MenuSubmenuItemType} isLast={isLast} onExpand={onExpandSubmenu} />;
	}
	if ('onClick' in item) {
		return <MenuActionItem item={item as MenuItemType} isLast={isLast} />;
	}
	return <MenuSliderItem item={item as MenuSliderType} isLast={isLast} />;
});

const MenuGroup: React.FC<{
	group: MenuGroupType;
	isLast?: boolean;
	onExpandSubmenu?: (item: MenuSubmenuItemType) => void;
}> = observer(({group, isLast = false, onExpandSubmenu}) => {
	return (
		<>
			<div className={styles.groupContainer}>
				{group.items.map((item, index) => (
					<MenuItem
						key={`${'label' in item ? item.label : 'slider'}-${index}`}
						item={item}
						isLast={index === group.items.length - 1}
						onExpandSubmenu={onExpandSubmenu}
					/>
				))}
			</div>
			{!isLast && <div className={styles.groupSpacer} />}
		</>
	);
});

export const MenuBottomSheet: React.FC<MenuBottomSheetProps> = observer(
	({isOpen, onClose, title, groups, headerContent, showCloseButton = false}) => {
		const [activeSubmenu, setActiveSubmenu] = useState<MenuSubmenuItemType | null>(null);
		const hasHeader = Boolean(title || headerContent);

		const handleExpandSubmenu = useCallback((item: MenuSubmenuItemType) => {
			setActiveSubmenu(item);
		}, []);

		const handleCloseSubmenu = useCallback(() => {
			setActiveSubmenu(null);
		}, []);

		const handleClose = useCallback(() => {
			setActiveSubmenu(null);
			onClose();
		}, [onClose]);

		if (activeSubmenu) {
			const submenuGroups: Array<MenuGroupType> = [{items: activeSubmenu.items}];
			const backButton = (
				<button type="button" onClick={handleCloseSubmenu} className={styles.backButton}>
					<CaretLeftIcon size={20} />
				</button>
			);
			return (
				<BottomSheet
					isOpen={isOpen}
					onClose={handleClose}
					snapPoints={[0, 0.6, 1]}
					initialSnap={1}
					title={activeSubmenu.label}
					showCloseButton={false}
					leadingAction={backButton}
				>
					<div className={styles.bottomSheetContent}>
						<div className={styles.groupStack}>
							{submenuGroups.map((group, index) => (
								<MenuGroup key={index} group={group} isLast={index === submenuGroups.length - 1} />
							))}
						</div>
					</div>
				</BottomSheet>
			);
		}

		return (
			<BottomSheet
				isOpen={isOpen}
				onClose={handleClose}
				snapPoints={[0, 0.6, 1]}
				initialSnap={1}
				title={title}
				showCloseButton={showCloseButton}
				disableDefaultHeader={!title && !showCloseButton}
			>
				<div className={styles.bottomSheetContent}>
					{headerContent && <div className={styles.headerSlot}>{headerContent}</div>}
					<div className={clsx(styles.groupStack, hasHeader && styles.groupStackWithHeader)}>
						{groups.map((group, index) => (
							<MenuGroup
								key={index}
								group={group}
								isLast={index === groups.length - 1}
								onExpandSubmenu={handleExpandSubmenu}
							/>
						))}
					</div>
				</div>
			</BottomSheet>
		);
	},
);

MenuBottomSheet.displayName = 'MenuBottomSheet';
