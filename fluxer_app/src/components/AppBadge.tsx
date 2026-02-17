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

import {updateDocumentTitleBadge} from '@app/hooks/useFluxerDocumentTitle';
import {Logger} from '@app/lib/Logger';
import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import NotificationStore from '@app/stores/NotificationStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import {getElectronAPI} from '@app/utils/NativeUtils';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import Favico from 'favico.js';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect} from 'react';

const logger = new Logger('AppBadge');

const UNREAD_INDICATOR = -1;

let favico: Favico | null = null;

const initFavico = (): Favico | null => {
	if (favico) return favico;

	try {
		favico = new Favico({animation: 'none'});
		return favico;
	} catch (e) {
		logger.warn('Failed to initialize Favico', e);
		return null;
	}
};

const setElectronBadge = (badge: number): void => {
	const electronApi = getElectronAPI();
	if (!electronApi?.setBadgeCount) return;

	const electronBadge = badge > 0 ? badge : 0;
	try {
		electronApi.setBadgeCount(electronBadge);
	} catch (e) {
		logger.warn('Failed to set Electron badge', e);
	}
};

const setFaviconBadge = (badge: number): void => {
	const fav = initFavico();
	if (!fav) return;

	try {
		if (badge === UNREAD_INDICATOR) {
			fav.badge('•');
		} else {
			fav.badge(badge);
		}
	} catch (e) {
		logger.warn('Failed to set favicon badge', e);
	}
};

const setPwaBadge = (badge: number): void => {
	if (!navigator.setAppBadge || !navigator.clearAppBadge) {
		return;
	}

	try {
		if (badge > 0) {
			void navigator.setAppBadge(badge);
		} else if (badge === UNREAD_INDICATOR) {
			void navigator.setAppBadge();
		} else {
			void navigator.clearAppBadge();
		}
	} catch (e) {
		logger.warn('Failed to set PWA badge', e);
	}
};

const setBadge = (badge: number): void => {
	setElectronBadge(badge);
	setFaviconBadge(badge);
	setPwaBadge(badge);
};

export const AppBadge: React.FC = observer(() => {
	const relationships = RelationshipStore.getRelationships();
	const unreadMessageBadgeEnabled = NotificationStore.unreadMessageBadgeEnabled;

	const mentionCount = GuildReadStateStore.getTotalMentionCount();
	const hasUnread = GuildReadStateStore.hasAnyUnread;

	const pendingCount = relationships.filter(
		(relationship) => relationship.type === RelationshipTypes.INCOMING_REQUEST,
	).length;

	const totalCount = mentionCount + pendingCount;

	let badge: number = 0;
	if (totalCount > 0) {
		badge = totalCount;
	} else if (hasUnread && unreadMessageBadgeEnabled) {
		badge = UNREAD_INDICATOR;
	}

	useEffect(() => {
		setBadge(badge);
	}, [badge]);

	useEffect(() => {
		updateDocumentTitleBadge(totalCount, hasUnread && unreadMessageBadgeEnabled);
	}, [totalCount, hasUnread, unreadMessageBadgeEnabled]);

	useEffect(() => {
		return () => {
			setBadge(0);
			updateDocumentTitleBadge(0, false);
		};
	}, []);

	return null;
});
