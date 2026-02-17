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

import styles from '@app/components/channel/active_now/ActiveNowSidebar.module.css';
import {useActiveFriendVoiceStates} from '@app/components/channel/active_now/useActiveFriendVoiceStates';
import {VoiceActivityCard} from '@app/components/profile/VoiceActivityCard';
import PrivacyPreferencesStore from '@app/stores/PrivacyPreferencesStore';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';

export const ActiveNowSidebar: React.FC = observer(function ActiveNowSidebar() {
	const {t} = useLingui();
	const showActiveNow = PrivacyPreferencesStore.getShowActiveNow();
	const activeChannels = useActiveFriendVoiceStates();

	if (!showActiveNow) {
		return null;
	}

	return (
		<aside className={styles.sidebar} aria-label={t`Active Now`}>
			<div className={styles.header}>
				<h2 className={styles.headerTitle}>{t`Active Now`}</h2>
			</div>

			{activeChannels.length === 0 ? (
				<div className={styles.emptyState}>
					<svg
						stroke="currentColor"
						fill="none"
						strokeWidth="2"
						viewBox="0 0 24 24"
						strokeLinecap="round"
						strokeLinejoin="round"
						className={styles.emptyIcon}
						xmlns="http://www.w3.org/2000/svg"
					>
						<path d="M4 12h6l-6 8h6" />
						<path d="M14 4h6l-6 8h6" />
					</svg>
					<span className={styles.emptyTitle}>{t`It's quiet for now...`}</span>
					<span className={styles.emptyDescription}>
						{t`When friends are active in voice channels, their activity will appear here.`}
					</span>
				</div>
			) : (
				<div className={styles.content}>
					{activeChannels.map((activity) => (
						<VoiceActivityCard key={activity.channelId} activity={activity} />
					))}
				</div>
			)}
		</aside>
	);
});
