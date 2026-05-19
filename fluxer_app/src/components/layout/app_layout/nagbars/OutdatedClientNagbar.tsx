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

import {Nagbar} from '@app/components/layout/Nagbar';
import {NagbarButton} from '@app/components/layout/NagbarButton';
import {NagbarContent} from '@app/components/layout/NagbarContent';
import NagbarStore from '@app/stores/NagbarStore';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {MS_PER_DAY} from '@fluxer/date_utils/src/DateConstants';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

const DOWNLOAD_URL = 'https://fluxer.world/index.html#downloads';

export const OutdatedClientNagbar = observer(({isMobile}: {isMobile: boolean}) => {
	const handleDownload = () => {
		openExternalUrl(DOWNLOAD_URL);
	};

	const handleDismiss = () => {
		NagbarStore.outdatedClientDismissedUntil = Date.now() + MS_PER_DAY;
	};

	return (
		<Nagbar
			isMobile={isMobile}
			backgroundColor="var(--status-danger-background)"
			textColor="var(--status-danger-text)"
			dismissible
			onDismiss={handleDismiss}
		>
			<NagbarContent
				isMobile={isMobile}
				onDismiss={handleDismiss}
				message={
					<Trans>
						Your Fluxer desktop app is out of date. You may be missing recent fixes and features — update when
						convenient.
					</Trans>
				}
				actions={
					<NagbarButton isMobile={isMobile} onClick={handleDownload}>
						<Trans>Download latest</Trans>
					</NagbarButton>
				}
			/>
		</Nagbar>
	);
});
