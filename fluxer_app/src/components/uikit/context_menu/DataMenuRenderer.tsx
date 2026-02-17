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

import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemRadio} from '@app/components/uikit/context_menu/MenuItemRadio';
import {MenuItemSlider} from '@app/components/uikit/context_menu/MenuItemSlider';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import type {
	MenuCheckboxType,
	MenuGroupType,
	MenuItemType,
	MenuRadioType,
	MenuSliderType,
	MenuSubmenuItemType,
} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

type MenuDataItem = MenuItemType | MenuSliderType | MenuCheckboxType | MenuRadioType | MenuSubmenuItemType;

interface DataMenuRendererProps {
	groups: Array<MenuGroupType>;
	excludeLabels?: Array<string>;
}

function isSubmenuItem(item: MenuDataItem): item is MenuSubmenuItemType {
	return 'items' in item && Array.isArray((item as MenuSubmenuItemType).items);
}

function isCheckboxItem(item: MenuDataItem): item is MenuCheckboxType {
	return 'checked' in item && 'onChange' in item;
}

function isRadioItem(item: MenuDataItem): item is MenuRadioType {
	return 'selected' in item && 'onSelect' in item;
}

function isMenuItem(item: MenuDataItem): item is MenuItemType {
	return 'onClick' in item && 'label' in item && !isSubmenuItem(item);
}

function isSliderItem(item: MenuDataItem): item is MenuSliderType {
	return 'value' in item && 'minValue' in item && 'maxValue' in item && 'onChange' in item;
}

export const DataMenuRenderer: React.FC<DataMenuRendererProps> = observer(({groups, excludeLabels = []}) => {
	const filteredGroups = useMemo(() => {
		return groups
			.map((group) => ({
				...group,
				items: group.items.filter((item) => {
					if ('label' in item && excludeLabels.includes(item.label)) {
						return false;
					}
					return true;
				}),
			}))
			.filter((group) => group.items.length > 0);
	}, [groups, excludeLabels]);

	return (
		<>
			{filteredGroups.map((group, groupIndex) => (
				<MenuGroup key={groupIndex}>
					{group.items.map((item, itemIndex) => {
						const key = 'label' in item ? `${item.label}-${itemIndex}` : `item-${itemIndex}`;

						if (isSubmenuItem(item)) {
							return (
								<MenuItemSubmenu
									key={key}
									label={item.label}
									icon={item.icon}
									disabled={item.disabled}
									onTriggerSelect={item.onTriggerSelect}
									render={() => <DataMenuRenderer groups={[{items: item.items}]} excludeLabels={excludeLabels} />}
								/>
							);
						}

						if (isCheckboxItem(item)) {
							return (
								<CheckboxItem key={key} checked={item.checked} onCheckedChange={item.onChange}>
									{item.label}
								</CheckboxItem>
							);
						}

						if (isRadioItem(item)) {
							return (
								<MenuItemRadio key={key} selected={item.selected} onSelect={item.onSelect} disabled={item.disabled}>
									{item.label}
								</MenuItemRadio>
							);
						}

						if (isSliderItem(item)) {
							return (
								<MenuItemSlider
									key={key}
									label={item.label}
									value={item.value}
									minValue={item.minValue}
									maxValue={item.maxValue}
									onChange={item.onChange}
									onFormat={item.onFormat}
								/>
							);
						}

						if (isMenuItem(item)) {
							return (
								<MenuItem
									key={item.id ?? key}
									icon={item.icon}
									onClick={item.onClick}
									danger={item.danger}
									disabled={item.disabled}
									hint={item.hint}
								>
									{item.label}
								</MenuItem>
							);
						}

						return null;
					})}
				</MenuGroup>
			))}
		</>
	);
});
