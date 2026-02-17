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

import styles from '@app/components/layout/NativeTitlebar.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import FluxerWordmark from '@app/images/fluxer-wordmark.svg?react';
import {getElectronAPI, type NativePlatform} from '@app/utils/NativeUtils';
import {useLingui} from '@lingui/react/macro';
import {CopySimpleIcon, MinusIcon, SquareIcon, XIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import type React from 'react';
import {useEffect, useState} from 'react';

interface NativeTitlebarProps {
	platform: NativePlatform;
}

export const NativeTitlebar: React.FC<NativeTitlebarProps> = ({platform}) => {
	const {t} = useLingui();
	const [isMaximized, setIsMaximized] = useState(false);

	useEffect(() => {
		const electronApi = getElectronAPI();
		if (!electronApi?.onWindowMaximizeChange) return;

		const unsubscribe = electronApi.onWindowMaximizeChange((maximized: boolean) => {
			setIsMaximized(maximized);
		});

		return () => {
			unsubscribe();
		};
	}, []);

	const handleMinimize = () => {
		const electronApi = getElectronAPI();
		electronApi?.windowMinimize?.();
	};

	const handleToggleMaximize = () => {
		const electronApi = getElectronAPI();
		if (!electronApi?.windowMaximize) return;

		electronApi.windowMaximize();
	};

	const handleClose = () => {
		const electronApi = getElectronAPI();
		electronApi?.windowClose?.();
	};

	const handleDoubleClick = () => {
		handleToggleMaximize();
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Titlebar needs to capture double clicks
		<div className={styles.titlebar} onDoubleClick={handleDoubleClick} data-platform={platform}>
			<div className={styles.left}>
				<FluxerWordmark className={styles.wordmark} />
			</div>
			<div className={styles.spacer} />
			<div className={styles.controls}>
				<FocusRing offset={-2}>
					<button
						type="button"
						className={styles.controlButton}
						onClick={handleMinimize}
						aria-label={t`Minimize window`}
					>
						<MinusIcon weight="bold" />
					</button>
				</FocusRing>
				<FocusRing offset={-2}>
					<button
						type="button"
						className={styles.controlButton}
						onClick={handleToggleMaximize}
						aria-label={isMaximized ? t`Restore window` : t`Maximize window`}
					>
						{isMaximized ? <CopySimpleIcon weight="bold" /> : <SquareIcon weight="bold" />}
					</button>
				</FocusRing>
				<FocusRing offset={-2}>
					<button
						type="button"
						className={clsx(styles.controlButton, styles.closeButton)}
						onClick={handleClose}
						aria-label={t`Close window`}
					>
						<XIcon weight="bold" />
					</button>
				</FocusRing>
			</div>
		</div>
	);
};
