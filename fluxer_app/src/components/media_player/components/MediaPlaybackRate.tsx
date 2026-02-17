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

import styles from '@app/components/media_player/MediaPlaybackRate.module.css';
import {AUDIO_PLAYBACK_RATES, VIDEO_PLAYBACK_RATES} from '@app/components/media_player/utils/MediaConstants';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import type React from 'react';
import {useCallback, useMemo} from 'react';

interface MediaPlaybackRateProps {
	rate: number;
	onRateChange: (rate: number) => void;
	rates?: ReadonlyArray<number>;
	isAudio?: boolean;
	size?: 'small' | 'medium' | 'large';
	showTooltip?: boolean;
	className?: string;
}

function formatRate(rate: number): string {
	if (rate === 1) return '1x';
	if (Number.isInteger(rate)) return `${rate}x`;
	return `${rate}x`;
}

export function MediaPlaybackRate({
	rate,
	onRateChange,
	rates,
	isAudio = false,
	size = 'medium',
	showTooltip = true,
	className,
}: MediaPlaybackRateProps) {
	const {t} = useLingui();
	const availableRates = useMemo(() => {
		if (rates) return rates;
		return isAudio ? AUDIO_PLAYBACK_RATES : VIDEO_PLAYBACK_RATES;
	}, [rates, isAudio]);

	const handleClick = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();

			const currentIndex = availableRates.indexOf(rate);
			const nextIndex = (currentIndex + 1) % availableRates.length;
			onRateChange(availableRates[nextIndex]);
		},
		[rate, availableRates, onRateChange],
	);

	const isActive = rate !== 1;
	const formattedRate = formatRate(rate);
	const label = t`Playback speed: ${formattedRate}`;

	const button = (
		<FocusRing offset={-2}>
			<button
				type="button"
				onClick={handleClick}
				className={clsx(styles.button, styles[size], isActive && styles.active, className)}
				aria-label={label}
				data-rate-length={formattedRate.length}
			>
				<span className={styles.label}>{formattedRate}</span>
			</button>
		</FocusRing>
	);

	if (showTooltip) {
		return (
			<Tooltip text={t`Playback speed`} position="top">
				{button}
			</Tooltip>
		);
	}

	return button;
}
