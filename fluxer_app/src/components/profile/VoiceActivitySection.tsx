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

import {VoiceActivityCard} from '@app/components/profile/VoiceActivityCard';
import styles from '@app/components/profile/VoiceActivitySection.module.css';
import {useUserVoiceActivityAggregates} from '@app/hooks/useUserVoiceActivities';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo} from 'react';

interface VoiceActivitySectionProps {
	userId: string;
	onNavigate?: () => void;
	showAllActivities?: boolean;
}

export const VoiceActivitySection: React.FC<VoiceActivitySectionProps> = observer(
	({userId, onNavigate, showAllActivities = false}) => {
		const {t} = useLingui();
		const activityAggregates = useUserVoiceActivityAggregates(userId);

		const primaryActivity = activityAggregates[0]?.primaryActivity;
		const aggregatedActivities = useMemo(
			() => activityAggregates.map((aggregate) => aggregate.primaryActivity),
			[activityAggregates],
		);
		const additionalCount = Math.max(0, aggregatedActivities.length - 1);
		const additionalCallsLabel = useMemo(() => {
			if (additionalCount === 1) {
				return t`And 1 other call`;
			}
			return t`And ${additionalCount} other calls`;
		}, [additionalCount, t]);

		if (!primaryActivity) {
			return null;
		}

		if (showAllActivities) {
			return (
				<div className={styles.section}>
					<div className={styles.allCallsGrid}>
						{aggregatedActivities.map((activity) => (
							<div key={`${activity.guildId ?? 'dm'}:${activity.channelId}`} className={styles.gridItem}>
								<VoiceActivityCard activity={activity} onNavigate={onNavigate} />
							</div>
						))}
					</div>
				</div>
			);
		}

		return (
			<div className={styles.section}>
				<VoiceActivityCard activity={primaryActivity} onNavigate={onNavigate} />
				{additionalCount > 0 ? <span className={styles.moreCallsText}>{additionalCallsLabel}</span> : null}
			</div>
		);
	},
);
