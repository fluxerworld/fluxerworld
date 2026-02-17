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

import * as NagbarActionCreators from '@app/actions/NagbarActionCreators';
import styles from '@app/components/layout/app_layout/nagbars/DesktopDownloadNagbar.module.css';
import {Nagbar} from '@app/components/layout/Nagbar';
import {NagbarButton} from '@app/components/layout/NagbarButton';
import {NagbarContent} from '@app/components/layout/NagbarContent';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {Trans} from '@lingui/react/macro';
import {AndroidLogoIcon, AppleLogoIcon, WindowsLogoIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

export const DesktopDownloadNagbar = observer(({isMobile}: {isMobile: boolean}) => {
	const handleDownload = () => {
		openExternalUrl('https://fluxer.app/download');
	};

	const handleDismiss = () => {
		NagbarActionCreators.dismissNagbar('desktopDownloadDismissed');
	};

	return (
		<Nagbar
			isMobile={isMobile}
			backgroundColor="var(--brand-primary)"
			textColor="var(--text-on-brand-primary)"
			dismissible
			onDismiss={handleDismiss}
		>
			<NagbarContent
				isMobile={isMobile}
				onDismiss={handleDismiss}
				message={<Trans>Get the Fluxer desktop app for system-wide push-to-talk and a few other goodies.</Trans>}
				actions={
					<>
						<span className={styles.platformIcons}>
							<AppleLogoIcon weight="fill" className={styles.platformIcon} />
							<AndroidLogoIcon weight="fill" className={styles.platformIcon} />
							<WindowsLogoIcon weight="fill" className={styles.platformIcon} />
						</span>
						<NagbarButton isMobile={isMobile} onClick={handleDownload}>
							<Trans>Download</Trans>
						</NagbarButton>
					</>
				}
			/>
		</Nagbar>
	);
});
