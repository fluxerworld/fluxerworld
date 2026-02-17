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

import styles from '@app/components/channel/ScheduledMessageEditBar.module.css';
import wrapperStyles from '@app/components/channel/textarea/InputWrapper.module.css';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {getCurrentLocale} from '@app/utils/LocaleUtils';
import {getFormattedDateTimeInZone} from '@fluxer/date_utils/src/DateFormatting';
import {useLingui} from '@lingui/react/macro';
import {ClockIcon, XCircleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo} from 'react';

interface ScheduledMessageEditBarProps {
	scheduledLocalAt: string;
	timezone: string;
	onCancel: () => void;
}

const formatScheduleLabel = (local: string, timezone: string): string => {
	const locale = getCurrentLocale();
	const formatted = getFormattedDateTimeInZone(local, timezone, locale);
	return `${formatted} (${timezone})`;
};

export const ScheduledMessageEditBar = observer(
	({scheduledLocalAt, timezone, onCancel}: ScheduledMessageEditBarProps) => {
		const {t} = useLingui();
		const scheduleLabel = useMemo(() => formatScheduleLabel(scheduledLocalAt, timezone), [scheduledLocalAt, timezone]);

		const handleStopEditing = useCallback(() => {
			onCancel();
		}, [onCancel]);

		return (
			<div
				className={`${wrapperStyles.box} ${wrapperStyles.wrapperSides} ${wrapperStyles.roundedTop} ${wrapperStyles.noBottomBorder}`}
			>
				<div className={wrapperStyles.barInner} style={{gridTemplateColumns: '1fr auto'}}>
					<div className={styles.text}>
						<div className={styles.label}>
							<ClockIcon className={styles.icon} weight="fill" />
							<span>{t`Editing scheduled message`}</span>
						</div>
						<div className={styles.timestamp}>{scheduleLabel}</div>
					</div>

					<div className={styles.controls}>
						<FocusRing offset={-2}>
							<button type="button" className={styles.button} onClick={handleStopEditing}>
								<XCircleIcon className={styles.icon} />
							</button>
						</FocusRing>
					</div>
				</div>
				<div className={wrapperStyles.separator} />
			</div>
		);
	},
);
