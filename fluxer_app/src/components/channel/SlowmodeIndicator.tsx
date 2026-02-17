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

import styles from '@app/components/channel/SlowmodeIndicator.module.css';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {MS_PER_SECOND, SECONDS_PER_HOUR, SECONDS_PER_MINUTE} from '@fluxer/date_utils/src/DateConstants';
import {Trans} from '@lingui/react/macro';
import {ClockIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';

interface SlowmodeIndicatorProps {
	slowmodeRemaining: number;
	isImmune: boolean;
}

export const SlowmodeIndicator = observer(({slowmodeRemaining, isImmune}: SlowmodeIndicatorProps) => {
	if (slowmodeRemaining <= 0 && !isImmune) {
		return null;
	}

	const formatTime = (ms: number): string => {
		const totalSeconds = Math.ceil(ms / MS_PER_SECOND);
		const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
		const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
		const seconds = totalSeconds % 60;

		if (hours > 0) {
			return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
		}

		return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	};

	const tooltipText = isImmune ? (
		<Trans>Slowmode is enabled, but you are immune.</Trans>
	) : (
		<Trans>You are in slowmode. Please wait before sending another message.</Trans>
	);

	return (
		<Tooltip text={() => tooltipText}>
			<div className={styles.container}>
				<ClockIcon size={12} weight="fill" />
				{slowmodeRemaining > 0 ? (
					<span className={styles.time}>{formatTime(slowmodeRemaining)}</span>
				) : (
					<span className={styles.label}>
						<Trans>Slowmode</Trans>
					</span>
				)}
			</div>
		</Tooltip>
	);
});
