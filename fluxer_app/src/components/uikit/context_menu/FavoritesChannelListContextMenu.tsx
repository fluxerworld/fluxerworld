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
import {AddFavoriteChannelModal} from '@app/components/modals/AddFavoriteChannelModal';
import {CreateFavoriteCategoryModal} from '@app/components/modals/CreateFavoriteCategoryModal';
import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import {CreateCategoryIcon, CreateChannelIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import FavoritesStore from '@app/stores/FavoritesStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

interface FavoritesChannelListContextMenuProps {
	onClose: () => void;
}

export const FavoritesChannelListContextMenu: React.FC<FavoritesChannelListContextMenuProps> = observer(({onClose}) => {
	const {t} = useLingui();
	const hideMutedChannels = FavoritesStore.hideMutedChannels;

	const handleToggleHideMutedChannels = useCallback((checked: boolean) => {
		FavoritesStore.setHideMutedChannels(checked);
	}, []);

	const handleAddChannel = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <AddFavoriteChannelModal />));
	}, [onClose]);

	const handleCreateCategory = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <CreateFavoriteCategoryModal />));
	}, [onClose]);

	return (
		<>
			<MenuGroup>
				<CheckboxItem checked={hideMutedChannels} onCheckedChange={handleToggleHideMutedChannels}>
					{t`Hide Muted Channels`}
				</CheckboxItem>
			</MenuGroup>

			<MenuGroup>
				<MenuItem icon={<CreateChannelIcon />} onClick={handleAddChannel}>
					{t`Add Channel`}
				</MenuItem>
				<MenuItem icon={<CreateCategoryIcon />} onClick={handleCreateCategory}>
					{t`Create Category`}
				</MenuItem>
			</MenuGroup>
		</>
	);
});
