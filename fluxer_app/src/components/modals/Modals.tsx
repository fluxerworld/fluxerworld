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

import {MediaViewerModal} from '@app/components/modals/MediaViewerModal';
import styles from '@app/components/modals/Modals.module.css';
import {UserProfileMobileSheet} from '@app/components/modals/UserProfileMobileSheet';
import ModalStore from '@app/stores/ModalStore';
import {ModalStackContext} from '@app/utils/modals/ModalUtils';
import {AnimatePresence} from 'framer-motion';
import {observer} from 'mobx-react-lite';

export const Modals = observer(() => {
	const orderedModals = ModalStore.orderedModals;

	return (
		<div className={styles.modals} data-overlay-pass-through="true">
			<MediaViewerModal />
			<UserProfileMobileSheet />

			<AnimatePresence>
				{orderedModals.map(({key, modal, stackIndex, isVisible, needsBackdrop, isTopmost}) => (
					<ModalStackContext.Provider key={key} value={{stackIndex, isVisible, needsBackdrop, isTopmost}}>
						{modal()}
					</ModalStackContext.Provider>
				))}
			</AnimatePresence>
		</div>
	);
});
