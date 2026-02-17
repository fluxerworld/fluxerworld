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

import {DMChannelView} from '@app/components/channel/channel_view/DMChannelView';
import {DMFriendsView} from '@app/components/channel/direct_message/DMFriendsView';
import styles from '@app/components/channel/direct_message/DMLayout.module.css';
import {DMList} from '@app/components/channel/direct_message/DMList';
import {RecentMentionsPage} from '@app/components/pages/RecentMentionsPage';
import {SavedMessagesPage} from '@app/components/pages/SavedMessagesPage';
import {useLocation, useParams} from '@app/lib/router/React';
import {Routes} from '@app/Routes';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import {observer} from 'mobx-react-lite';
import type {ReactNode} from 'react';

interface DMLayoutProps {
	children?: ReactNode;
}

export const DMLayout = observer(({children}: DMLayoutProps) => {
	const {channelId} = useParams() as {channelId?: string};
	const location = useLocation();
	const mobileLayout = MobileLayoutStore;

	const renderContent = () => {
		if (location.pathname === Routes.BOOKMARKS) {
			return <SavedMessagesPage />;
		}
		if (location.pathname === Routes.MENTIONS) {
			return <RecentMentionsPage />;
		}
		if (channelId) {
			return <DMChannelView channelId={channelId} />;
		}
		if (children) {
			return children;
		}
		return <DMFriendsView />;
	};

	if (mobileLayout.enabled) {
		if (!channelId && !children) {
			return (
				<div className={styles.dmListColumn}>
					<DMList />
				</div>
			);
		}
		return (
			<div className={styles.contentColumn}>
				<div className={styles.contentInner}>{renderContent()}</div>
			</div>
		);
	}

	return (
		<div className={styles.dmLayoutContainer}>
			<div className={styles.dmListColumn}>
				<DMList />
			</div>
			<div className={styles.contentColumn}>
				<div className={styles.contentInner}>{renderContent()}</div>
			</div>
		</div>
	);
});
