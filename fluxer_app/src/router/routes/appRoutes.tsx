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

import {observer} from 'mobx-react-lite';
import React from 'react';
import {ChannelTypes, ME} from '~/Constants';
import {AppBadge} from '~/components/AppBadge';
import {ChannelIndexPage} from '~/components/channel/ChannelIndexPage';
import {ChannelLayout} from '~/components/channel/ChannelLayout';
import {DMLayout} from '~/components/channel/dm/DMLayout';
import {AppLayout} from '~/components/layout/AppLayout';
import {FavoritesLayout} from '~/components/layout/FavoritesLayout';
import {GuildsLayout} from '~/components/layout/GuildsLayout';
import {BookmarksBottomSheet} from '~/components/modals/BookmarksBottomSheet';
import {StatusChangeBottomSheet} from '~/components/modals/StatusChangeBottomSheet';
import {NotificationsPage} from '~/components/pages/NotificationsPage';
import PremiumCallbackPage from '~/components/pages/PremiumCallbackPage';
import {YouPage} from '~/components/pages/YouPage';
import {createRoute, Redirect, useParams} from '~/lib/router';
import SessionManager from '~/lib/SessionManager';
import {Routes} from '~/Routes';
import {GuildChannelRouter} from '~/router/components/GuildChannelRouter';
import {rootRoute} from '~/router/routes/rootRoutes';
import AuthenticationStore from '~/stores/AuthenticationStore';
import ChannelStore from '~/stores/ChannelStore';
import MobileLayoutStore from '~/stores/MobileLayoutStore';
import SelectedChannelStore from '~/stores/SelectedChannelStore';

const appLayoutRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'appLayout',
	onEnter: () => {
		if (!SessionManager.isInitialized) {
			return undefined;
		}
		if (!AuthenticationStore.isAuthenticated) {
			const current = window.location.pathname + window.location.search;
			return new Redirect(`${Routes.LOGIN}?redirect_to=${encodeURIComponent(current)}`);
		}
		return undefined;
	},
	layout: ({children}) => (
		<>
			<AppBadge />
			<AppLayout>{children}</AppLayout>
		</>
	),
});

const guildsLayoutRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	id: 'guildsLayout',
	layout: ({children}) => <GuildsLayout>{children}</GuildsLayout>,
});

const notificationsRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	id: 'notifications',
	path: Routes.NOTIFICATIONS,
	component: () => {
		const [bookmarksSheetOpen, setBookmarksSheetOpen] = React.useState(false);

		return (
			<>
				<NotificationsPage onBookmarksClick={() => setBookmarksSheetOpen(true)} />
				<BookmarksBottomSheet isOpen={bookmarksSheetOpen} onClose={() => setBookmarksSheetOpen(false)} />
			</>
		);
	},
});

const youRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	id: 'you',
	path: Routes.YOU,
	component: () => {
		const [statusSheetOpen, setStatusSheetOpen] = React.useState(false);

		return (
			<>
				<YouPage onAvatarClick={() => setStatusSheetOpen(true)} />
				<StatusChangeBottomSheet isOpen={statusSheetOpen} onClose={() => setStatusSheetOpen(false)} />
			</>
		);
	},
});

const premiumCallbackRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	id: 'premiumCallback',
	path: Routes.PREMIUM_CALLBACK,
	component: () => <PremiumCallbackPage />,
});

const bookmarksRoute = createRoute({
	getParentRoute: () => guildsLayoutRoute,
	id: 'bookmarks',
	path: Routes.BOOKMARKS,
	component: () => <DMLayout />,
});

const mentionsRoute = createRoute({
	getParentRoute: () => guildsLayoutRoute,
	id: 'mentions',
	path: Routes.MENTIONS,
	component: () => <DMLayout />,
});

const meRoute = createRoute({
	getParentRoute: () => guildsLayoutRoute,
	id: 'me',
	path: '/channels/@me',
	component: observer(() => {
		const isMobileLayout = MobileLayoutStore.enabled;

		React.useEffect(() => {
			if (!isMobileLayout && SelectedChannelStore.selectedChannelIds.has(ME)) {
				SelectedChannelStore.clearGuildSelection(ME);
			}
		}, [isMobileLayout]);

		return <DMLayout />;
	}),
});

const favoritesRoute = createRoute({
	getParentRoute: () => guildsLayoutRoute,
	id: 'favorites',
	path: '/channels/@favorites',
	layout: ({children}) => <FavoritesLayout>{children}</FavoritesLayout>,
});

const favoritesChannelRoute = createRoute({
	getParentRoute: () => favoritesRoute,
	id: 'favoritesChannel',
	path: '/channels/@favorites/:channelId',
	component: () => (
		<ChannelLayout>
			<ChannelIndexPage />
		</ChannelLayout>
	),
});

const channelsRoute = createRoute({
	getParentRoute: () => guildsLayoutRoute,
	id: 'channels',
	path: '/channels/:guildId',
	layout: ({children}) => {
		const params = useParams() as {guildId: string};
		const {guildId} = params;

		if (guildId === ME) {
			return <DMLayout>{children}</DMLayout>;
		}

		return guildId ? <GuildChannelRouter guildId={guildId}>{children}</GuildChannelRouter> : null;
	},
});

const channelRoute = createRoute({
	getParentRoute: () => channelsRoute,
	id: 'channel',
	path: '/channels/:guildId/:channelId',
	onEnter: (ctx) => {
		const {guildId, channelId} = ctx.params;
		const channel = ChannelStore.getChannel(channelId);
		if (channel && (channel.type === ChannelTypes.GUILD_CATEGORY || channel.type === ChannelTypes.GUILD_LINK)) {
			return new Redirect(Routes.guildChannel(guildId));
		}
		return undefined;
	},
	component: () => (
		<ChannelLayout>
			<ChannelIndexPage />
		</ChannelLayout>
	),
});

const messageRoute = createRoute({
	getParentRoute: () => channelRoute,
	id: 'message',
	path: '/channels/:guildId/:channelId/:messageId',
	onEnter: (ctx) => {
		const {guildId, channelId} = ctx.params;
		const channel = ChannelStore.getChannel(channelId);
		if (channel && (channel.type === ChannelTypes.GUILD_CATEGORY || channel.type === ChannelTypes.GUILD_LINK)) {
			return new Redirect(Routes.guildChannel(guildId));
		}
		return undefined;
	},
	component: () => (
		<ChannelLayout>
			<ChannelIndexPage />
		</ChannelLayout>
	),
});

export const appRouteTree = appLayoutRoute.addChildren([
	notificationsRoute,
	youRoute,
	premiumCallbackRoute,
	guildsLayoutRoute.addChildren([
		bookmarksRoute,
		mentionsRoute,
		meRoute,
		favoritesRoute.addChildren([favoritesChannelRoute]),
		channelsRoute.addChildren([channelRoute.addChildren([messageRoute])]),
	]),
]);
