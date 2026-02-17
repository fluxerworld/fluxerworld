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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import {RenameChannelModal} from '@app/components/modals/RenameChannelModal';
import {
	CollapseIcon,
	CreateChannelIcon,
	DeleteIcon,
	EditSimpleIcon,
	ExpandIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import FavoritesStore from '@app/stores/FavoritesStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface FavoritesCategoryContextMenuProps {
	category: {id: string; name: string};
	onClose: () => void;
	onAddChannel: () => void;
}

export const FavoritesCategoryContextMenu: React.FC<FavoritesCategoryContextMenuProps> = observer(
	({category, onClose, onAddChannel}) => {
		const {t} = useLingui();
		const isCollapsed = FavoritesStore.isCategoryCollapsed(category.id);

		const handleRename = () => {
			onClose();
			ModalActionCreators.push(
				modal(() => (
					<RenameChannelModal
						currentName={category.name}
						onSave={(name) => {
							FavoritesStore.renameCategory(category.id, name);
						}}
					/>
				)),
			);
		};

		const handleToggleCollapse = () => {
			FavoritesStore.toggleCategoryCollapsed(category.id);
			onClose();
		};

		const handleRemove = () => {
			FavoritesStore.removeCategory(category.id);
			onClose();
		};

		const handleAddChannelClick = () => {
			onClose();
			onAddChannel();
		};

		return (
			<>
				<MenuGroup>
					<MenuItem icon={<CreateChannelIcon />} onClick={handleAddChannelClick}>
						{t`Add Channel`}
					</MenuItem>
					<MenuItem icon={<EditSimpleIcon />} onClick={handleRename}>
						{t`Rename Category`}
					</MenuItem>
				</MenuGroup>

				<MenuGroup>
					<MenuItem icon={isCollapsed ? <ExpandIcon /> : <CollapseIcon />} onClick={handleToggleCollapse}>
						{isCollapsed ? t`Expand Category` : t`Collapse Category`}
					</MenuItem>
				</MenuGroup>

				<MenuGroup>
					<MenuItem icon={<DeleteIcon />} onClick={handleRemove} danger>
						{t`Delete Category`}
					</MenuItem>
				</MenuGroup>
			</>
		);
	},
);
