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

import styles from '@app/components/channel/ChannelHeader.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {Platform} from '@app/lib/Platform';
import UpdaterStore from '@app/stores/UpdaterStore';
import {t} from '@lingui/core/macro';
import {DownloadSimpleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo} from 'react';

export const UpdaterIcon = observer(() => {
	const store = UpdaterStore;

	const hasActionableNativeUpdate = Platform.isElectron && store.nativeUpdateReady;
	const hasActionableWebUpdate = !!store.updateInfo.web.available && !hasActionableNativeUpdate;

	const tooltip = useMemo(() => {
		const version = store.displayVersion;

		if (hasActionableNativeUpdate) {
			return version ? t`Click to install update (${version})` : t`Click to install update`;
		}

		return version ? t`Click to reload and update (${version})` : t`Click to reload and update`;
	}, [hasActionableNativeUpdate, store.displayVersion]);

	const handleClick = useCallback(() => {
		void store.applyUpdate();
	}, [store]);

	if (!hasActionableNativeUpdate && !hasActionableWebUpdate) {
		return null;
	}

	return (
		<Tooltip text={tooltip} position="bottom">
			<FocusRing offset={-2}>
				<button type="button" className={styles.updateIconButton} onClick={handleClick} aria-label={tooltip}>
					<DownloadSimpleIcon weight="bold" className={styles.updateIcon} />
				</button>
			</FocusRing>
		</Tooltip>
	);
});
