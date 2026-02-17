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

import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import Config from '@app/Config';
import styles from '@app/components/modals/components/ClientInfo.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import DeveloperModeStore from '@app/stores/DeveloperModeStore';
import {getClientInfo, getClientInfoSync} from '@app/utils/ClientInfoUtils';
import {isDesktop} from '@app/utils/NativeUtils';
import {formatShortRelativeTime} from '@fluxer/date_utils/src/DateDuration';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useEffect, useState} from 'react';

export const ClientInfo = observer(() => {
	const {t, i18n} = useLingui();
	const [clientInfo, setClientInfo] = useState(getClientInfoSync());

	useEffect(() => {
		let mounted = true;
		void getClientInfo().then((info) => {
			if (!mounted) return;
			setClientInfo(info);
		});
		return () => {
			mounted = false;
		};
	}, []);

	const buildShaShort = (Config.PUBLIC_BUILD_SHA ?? '').slice(0, 7);
	const buildNumber = Config.PUBLIC_BUILD_NUMBER;
	const desktopVersion = clientInfo.desktopVersion;
	const desktopChannel = clientInfo.desktopChannel;

	const browserName = clientInfo.browserName || 'Unknown';
	const browserVersion = clientInfo.browserVersion || '';
	const osName = clientInfo.osName || 'Unknown';
	const rawOsVersion = clientInfo.osVersion ?? '';
	const isDesktopApp = isDesktop();
	const osArchitecture = clientInfo.desktopArch ?? clientInfo.arch;
	const shouldShowOsVersion = Boolean(rawOsVersion) && (isDesktopApp || osName !== 'macOS');
	const osVersionForDisplay = shouldShowOsVersion ? rawOsVersion : undefined;

	const buildOsDescription = () => {
		const parts = [osName];
		if (osVersionForDisplay) {
			parts.push(osVersionForDisplay);
		}
		const archSuffix = osArchitecture ? ` (${osArchitecture})` : '';
		return `${parts.join(' ')}${archSuffix}`.trim();
	};
	const osDescription = buildOsDescription();

	const onClick = () => {
		let timestamp = '';
		if (Config.PUBLIC_BUILD_TIMESTAMP) {
			const date = new Date(Config.PUBLIC_BUILD_TIMESTAMP * 1000);
			const year = date.getUTCFullYear();
			const month = String(date.getUTCMonth() + 1).padStart(2, '0');
			const day = String(date.getUTCDate()).padStart(2, '0');
			const hours = String(date.getUTCHours()).padStart(2, '0');
			const minutes = String(date.getUTCMinutes()).padStart(2, '0');
			const seconds = String(date.getUTCSeconds()).padStart(2, '0');
			timestamp = `, ${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
		}
		const justUnlocked = DeveloperModeStore.registerBuildTap();
		if (justUnlocked) {
			ToastActionCreators.success(t`You are now a developer!`);
		}

		const desktopInfo = desktopVersion && desktopChannel ? `, desktop ${desktopChannel} ${desktopVersion}` : '';
		const buildInfo = buildNumber ? `build ${buildNumber} (${buildShaShort})` : `(${buildShaShort})`;

		TextCopyActionCreators.copy(
			i18n,
			`${Config.PUBLIC_RELEASE_CHANNEL} ${buildInfo}${timestamp}, ${browserName} ${browserVersion}, ${osDescription}${desktopInfo}`,
		);
	};

	return (
		<Tooltip text={t`Click to copy`}>
			<FocusRing>
				<button type="button" onClick={onClick} className={styles.button}>
					<span>
						{Config.PUBLIC_RELEASE_CHANNEL}{' '}
						{buildNumber ? `build ${buildNumber} (${buildShaShort})` : `(${buildShaShort})`}
					</span>
					{desktopVersion && (
						<span>
							Desktop {desktopChannel ?? 'stable'} {desktopVersion}
						</span>
					)}
					{Config.PUBLIC_BUILD_TIMESTAMP && (
						<span>
							<Trans>Deployed</Trans> {formatShortRelativeTime(Config.PUBLIC_BUILD_TIMESTAMP * 1000)}
						</span>
					)}
					<span>
						{browserName} {browserVersion}
					</span>
					<span>{osDescription}</span>
				</button>
			</FocusRing>
		</Tooltip>
	);
});
