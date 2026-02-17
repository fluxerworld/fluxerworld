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

import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Toast} from '@app/components/uikit/toast/Toast';
import styles from '@app/components/uikit/toast/Toasts.module.css';
import ToastStore from '@app/stores/ToastStore';
import {isMobileExperienceEnabled} from '@app/utils/MobileExperience';
import {clsx} from 'clsx';
import {AnimatePresence} from 'framer-motion';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';

export const Toasts: React.FC = observer(() => {
	const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

	useEffect(() => {
		const container = document.createElement('div');
		container.id = 'toast-portal-root';
		document.body.appendChild(container);
		setPortalRoot(container);

		return () => {
			document.body.removeChild(container);
		};
	}, []);

	const isMobileExperience = isMobileExperienceEnabled();

	const closeToast = useCallback((id: string) => {
		ToastActionCreators.destroyToast(id);
	}, []);

	if (!portalRoot) return null;

	return createPortal(
		<div className={clsx(styles.container, isMobileExperience ? styles.containerMobile : styles.containerDesktop)}>
			<AnimatePresence mode="wait">
				{ToastStore.currentToast && (
					<div key={ToastStore.currentToast.id} className={styles.toastWrapper}>
						<Toast id={ToastStore.currentToast.id} closeToast={closeToast} {...ToastStore.currentToast.data} />
					</div>
				)}
			</AnimatePresence>
		</div>,
		portalRoot,
	);
});
