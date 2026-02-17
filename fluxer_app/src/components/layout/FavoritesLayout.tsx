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

import {FavoritesWelcomeSection} from '@app/components/favorites/FavoritesWelcomeSection';
import {FavoritesChannelListContent} from '@app/components/layout/FavoritesChannelListContent';
import {FavoritesGuildHeader} from '@app/components/layout/FavoritesGuildHeader';
import styles from '@app/components/layout/GuildLayout.module.css';
import {GuildSidebar} from '@app/components/layout/GuildSidebar';
import {useParams} from '@app/lib/router/React';
import FavoritesStore from '@app/stores/FavoritesStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import NavigationStore from '@app/stores/NavigationStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect} from 'react';

export const FavoritesLayout = observer(({children}: {children: React.ReactNode}) => {
	const mobileLayout = MobileLayoutStore;
	const {channelId} = useParams() as {channelId?: string};

	const hasAccessibleChannels = FavoritesStore.getFirstAccessibleChannel() !== undefined;
	const showWelcomeScreen = !channelId && !hasAccessibleChannels;
	const shouldRenderWelcomeScreen = showWelcomeScreen && !mobileLayout.enabled;

	useEffect(() => {
		if (!channelId) return;

		const isStillFavorited = FavoritesStore.getChannel(channelId);

		if (!isStillFavorited) {
			const validChannelId = SelectedChannelStore.getValidatedFavoritesChannel();

			if (validChannelId) {
				NavigationStore.navigateToFavorites(validChannelId, undefined, 'push');
			} else {
				NavigationStore.navigateToFavorites(undefined, undefined, 'push');
			}
		}
	}, [channelId, FavoritesStore.channels]);

	if (shouldRenderWelcomeScreen) {
		return (
			<div className={styles.guildLayoutContainer}>
				<div className={styles.guildLayoutContent}>
					<GuildSidebar header={<FavoritesGuildHeader />} content={<FavoritesChannelListContent />} />
					<div className={styles.guildMainContent}>
						<FavoritesWelcomeSection />
					</div>
				</div>
			</div>
		);
	}

	if (mobileLayout.enabled) {
		if (!channelId) {
			return <GuildSidebar header={<FavoritesGuildHeader />} content={<FavoritesChannelListContent />} />;
		}

		return (
			<div className={styles.guildLayoutContainer}>
				<div className={styles.guildMainContent}>{children}</div>
			</div>
		);
	}

	return (
		<div className={styles.guildLayoutContainer}>
			<div className={styles.guildLayoutContent}>
				<GuildSidebar header={<FavoritesGuildHeader />} content={<FavoritesChannelListContent />} />
				<div className={styles.guildMainContent}>{children}</div>
			</div>
		</div>
	);
});
