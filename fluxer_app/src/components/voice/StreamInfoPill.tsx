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

import {LiveBadge} from '@app/components/uikit/LiveBadge';
import styles from '@app/components/voice/StreamInfoPill.module.css';
import type {StreamTrackInfo} from '@app/components/voice/useStreamTrackInfo';
import {useLingui} from '@lingui/react/macro';
import {clsx} from 'clsx';
import {useMemo} from 'react';

type ResolutionHeight = 480 | 720 | 1080 | 1440 | 2160;

const RESOLUTION_HEIGHTS: Array<ResolutionHeight> = [480, 720, 1080, 1440, 2160];

type StreamInfoPillTone = 'default' | 'voice_tile';

function getClosestResolutionHeight(height: number) {
	let closest: ResolutionHeight = RESOLUTION_HEIGHTS[0];
	let smallestDiff = Math.abs(height - closest);

	for (const value of RESOLUTION_HEIGHTS) {
		const diff = Math.abs(height - value);
		if (diff < smallestDiff) {
			closest = value;
			smallestDiff = diff;
		}
	}

	return closest;
}

interface StreamInfoPillProps {
	info: StreamTrackInfo;
	className?: string;
	showLiveBadge?: boolean;
	tone?: StreamInfoPillTone;
}

export function StreamInfoPill({info, className, showLiveBadge = true, tone = 'default'}: StreamInfoPillProps) {
	const {t} = useLingui();

	const resolutionText = useMemo(() => {
		const targetHeight = getClosestResolutionHeight(info.height);
		switch (targetHeight) {
			case 480:
				return t`480p`;
			case 720:
				return t`720p`;
			case 1080:
				return t`1080p`;
			case 1440:
				return t`1440p`;
			case 2160:
				return t`4K`;
			default:
				return t`720p`;
		}
	}, [info.height, t]);

	const fpsText = useMemo(() => (Number.isFinite(info.fps) && info.fps > 0 ? t`${info.fps} FPS` : ''), [info.fps, t]);
	const labelText = useMemo(
		() => (fpsText ? `${resolutionText} ${fpsText}` : resolutionText),
		[fpsText, resolutionText],
	);

	return (
		<div className={clsx(styles.container, className)}>
			<span className={clsx(styles.pill, tone === 'voice_tile' && styles.pillOnTile)}>{labelText}</span>
			{showLiveBadge && <LiveBadge />}
		</div>
	);
}
