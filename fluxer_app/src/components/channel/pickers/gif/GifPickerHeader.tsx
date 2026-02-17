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

import styles from '@app/components/channel/GifPicker.module.css';
import type {GifPickerStore} from '@app/components/channel/pickers/gif/GifPickerStore';
import {PickerSearchInput} from '@app/components/channel/shared/PickerSearchInput';
import pickerSearchInputStyles from '@app/components/channel/shared/PickerSearchInput.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import PoweredByKlipySvg from '@app/images/powered-by-klipy.svg?react';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import {useLingui} from '@lingui/react/macro';
import {ArrowLeftIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export const GifPickerHeader = observer(
	({
		store,
		inputRef,
	}: {
		store: GifPickerStore;
		inputRef: React.RefObject<HTMLInputElement | null> | React.RefObject<HTMLInputElement>;
	}) => {
		const {t} = useLingui();
		const isKlipy = RuntimeConfigStore.gifProvider === 'klipy';

		if (store.view !== 'default') {
			const title = store.view === 'trending' ? t`Trending GIFs` : t`GIFs`;
			return (
				<div className={styles.searchBarContainer}>
					<div className={styles.searchBarTitleWrapper}>
						<FocusRing offset={-2}>
							<button type="button" className={styles.searchBarBackButton} onClick={store.goToDefaultView}>
								<ArrowLeftIcon weight="regular" />
							</button>
						</FocusRing>
						<div className={styles.searchBarTitle}>{title}</div>
					</div>
				</div>
			);
		}

		const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				store.flushSearch();
			}
		};

		return (
			<PickerSearchInput
				value={store.searchTerm}
				onChange={store.setSearchTerm}
				placeholder={isKlipy ? t`Search KLIPY` : t`Search Tenor`}
				inputRef={inputRef}
				showBackButton={!!store.searchTerm.trim()}
				onBackButtonClick={() => store.setSearchTerm('')}
				onKeyDown={handleKeyDown}
				rightCustomElement={isKlipy ? <PoweredByKlipySvg className={pickerSearchInputStyles.poweredByKlipy} /> : null}
			/>
		);
	},
);
