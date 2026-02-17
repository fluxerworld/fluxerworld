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

import * as FavoritesActionCreators from '@app/actions/FavoritesActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as UserGuildSettingsActionCreators from '@app/actions/UserGuildSettingsActionCreators';
import sharedStyles from '@app/components/bottomsheets/shared.module.css';
import {AddFavoriteChannelModal} from '@app/components/modals/AddFavoriteChannelModal';
import {CreateFavoriteCategoryModal} from '@app/components/modals/CreateFavoriteCategoryModal';
import {
	CreateCategoryIcon,
	CreateChannelIcon,
	HideIcon,
	MuteIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import type {MenuGroupType} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {MenuBottomSheet} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import FavoritesStore from '@app/stores/FavoritesStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import {FAVORITES_GUILD_ID} from '@fluxer/constants/src/AppConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface FavoritesGuildHeaderBottomSheetProps {
	isOpen: boolean;
	onClose: () => void;
}

export const FavoritesGuildHeaderBottomSheet: React.FC<FavoritesGuildHeaderBottomSheetProps> = observer(
	({isOpen, onClose}) => {
		const {t, i18n} = useLingui();
		const hideMutedChannels = FavoritesStore.hideMutedChannels;
		const settings = UserGuildSettingsStore.getSettings(FAVORITES_GUILD_ID);
		const isMuted = settings?.muted ?? false;

		const handleAddChannel = () => {
			onClose();
			ModalActionCreators.push(modal(() => <AddFavoriteChannelModal />));
		};

		const handleCreateCategory = () => {
			onClose();
			ModalActionCreators.push(modal(() => <CreateFavoriteCategoryModal />));
		};

		const handleToggleHideMutedChannels = (checked: boolean) => {
			FavoritesStore.setHideMutedChannels(checked);
		};

		const handleToggleMuteFavorites = () => {
			UserGuildSettingsActionCreators.updateGuildSettings(FAVORITES_GUILD_ID, {muted: !isMuted});
			onClose();
		};

		const handleHideFavorites = () => {
			onClose();
			FavoritesActionCreators.confirmHideFavorites(undefined, i18n);
		};

		const menuGroups: Array<MenuGroupType> = [
			{
				items: [
					{
						icon: <CreateChannelIcon className={sharedStyles.icon} />,
						label: t`Add Channel`,
						onClick: handleAddChannel,
					},
					{
						icon: <CreateCategoryIcon className={sharedStyles.icon} />,
						label: t`Create Category`,
						onClick: handleCreateCategory,
					},
				],
			},
			{
				items: [
					{
						icon: <MuteIcon className={sharedStyles.icon} />,
						label: isMuted ? t`Unmute Favorites` : t`Mute Favorites`,
						onClick: handleToggleMuteFavorites,
					},
					{
						label: t`Hide Muted Channels`,
						checked: hideMutedChannels,
						onChange: handleToggleHideMutedChannels,
					},
				],
			},
			{
				items: [
					{
						icon: <HideIcon className={sharedStyles.icon} />,
						label: t`Hide Favorites`,
						onClick: handleHideFavorites,
						danger: true,
					},
				],
			},
		];

		return <MenuBottomSheet isOpen={isOpen} onClose={onClose} groups={menuGroups} />;
	},
);
