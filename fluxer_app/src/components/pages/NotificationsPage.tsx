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

import {SelectBottomSheet} from '@app/components/form/SelectBottomSheet';
import styles from '@app/components/pages/NotificationsPage.module.css';
import {RecentMentionsContent} from '@app/components/popouts/RecentMentionsContent';
import {UnreadChannelsContent} from '@app/components/popouts/UnreadChannelsContent';
import {Trans, useLingui} from '@lingui/react/macro';
import {BookmarkSimpleIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useMemo, useState} from 'react';

interface NotificationsPageProps {
	onBookmarksClick: () => void;
}

export const NotificationsPage = observer(({onBookmarksClick}: NotificationsPageProps) => {
	const {t} = useLingui();
	const [filter, setFilter] = useState<'unreads' | 'mentions'>('unreads');
	const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);

	const filterOptions = useMemo(
		() => [
			{label: t`Unreads`, value: 'unreads' as const},
			{label: t`Mentions`, value: 'mentions' as const},
		],
		[t],
	);

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<h1 className={styles.title}>
					<Trans>Notifications</Trans>
				</h1>
				<div className={styles.headerActions}>
					<SelectBottomSheet
						value={filter}
						options={filterOptions}
						onChange={(value) => setFilter(value)}
						className={styles.filterTrigger}
					/>
					{filter === 'mentions' && headerActions}
					<button type="button" onClick={onBookmarksClick} className={styles.bookmarkButton}>
						<BookmarkSimpleIcon weight="fill" className={styles.bookmarkIcon} />
					</button>
				</div>
			</div>
			<div className={styles.content}>
				{filter === 'unreads' && <UnreadChannelsContent />}
				{filter === 'mentions' && <RecentMentionsContent onHeaderActionsChange={setHeaderActions} />}
			</div>
		</div>
	);
});
