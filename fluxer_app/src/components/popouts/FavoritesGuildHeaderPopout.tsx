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
import {GuildHeaderPopoutCheckboxItem, GuildHeaderPopoutItem} from '@app/components/popouts/GuildHeaderPopout';
import styles from '@app/components/popouts/GuildHeaderPopout.module.css';
import {useRovingFocusList} from '@app/hooks/useRovingFocusList';
import FavoritesStore from '@app/stores/FavoritesStore';
import {useLingui} from '@lingui/react/macro';
import {FolderPlusIcon, PlusCircleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';

export const FavoritesGuildHeaderPopout = observer(() => {
	const {t} = useLingui();
	const hideMutedChannels = FavoritesStore.hideMutedChannels;

	const handleToggleHideMutedChannels = useCallback((checked: boolean) => {
		FavoritesStore.setHideMutedChannels(checked);
	}, []);

	const listRef = useRovingFocusList<HTMLDivElement>({
		autoFocusFirst: true,
		focusableSelector: '[data-roving-focus="true"]',
	});

	return (
		<div className={styles.container} ref={listRef} style={{width: 'var(--layout-header-popout-width)'}}>
			<GuildHeaderPopoutItem
				icon={PlusCircleIcon}
				title={t`Add Channel`}
				onClick={() => ModalActionCreators.push(modal(() => <AddFavoriteChannelModal />))}
			/>
			<GuildHeaderPopoutItem
				icon={FolderPlusIcon}
				title={t`Create Category`}
				onClick={() => ModalActionCreators.push(modal(() => <CreateFavoriteCategoryModal />))}
			/>
			<GuildHeaderPopoutCheckboxItem
				title={t`Hide Muted Channels`}
				checked={hideMutedChannels}
				onChange={handleToggleHideMutedChannels}
			/>
		</div>
	);
});
