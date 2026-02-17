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

import * as InviteActionCreators from '@app/actions/InviteActionCreators';
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import i18n from '@app/I18n';
import {Logger} from '@app/lib/Logger';
import ChannelStore from '@app/stores/ChannelStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import {getGroupDmRemainingSlots} from '@app/utils/GroupDmUtils';
import {MS_PER_DAY} from '@fluxer/date_utils/src/DateConstants';
import {msg} from '@lingui/core/macro';
import {useCallback, useMemo, useRef, useState} from 'react';

const logger = new Logger('AddFriendsToGroupModalUtils');

interface InviteCacheEntry {
	code: string;
	expiresAt: number;
}

interface State {
	selectedUserIds: Array<string>;
	searchQuery: string;
	inviteLink: string | null;
	isAdding: boolean;
	isGeneratingInvite: boolean;
	currentMemberIds: Array<string>;
	remainingSlotsCount: number;
	availableFriendsCount: number;
}

interface Handlers {
	handleToggle: (userId: string) => void;
	handleAddFriends: () => Promise<void>;
	handleGenerateInvite: () => Promise<string | null>;
	handleGenerateOrCopyInvite: () => Promise<boolean>;
	setSearchQuery: (query: string) => void;
}

export function useAddFriendsToGroupModalLogic(channelId: string): State & Handlers {
	const [selectedUserIds, setSelectedUserIds] = useState<Array<string>>([]);
	const [searchQuery, setSearchQuery] = useState('');
	const [inviteLink, setInviteLink] = useState<string | null>(null);
	const [isAdding, setIsAdding] = useState(false);
	const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

	const inviteCacheRef = useRef<Map<string, InviteCacheEntry>>(new Map());

	const channel = ChannelStore.getChannel(channelId);
	const currentMemberIds = useMemo(() => Array.from(channel?.recipientIds ?? []), [channel?.recipientIds]);

	const remainingSlotsCount = getGroupDmRemainingSlots(channel);

	const availableFriendsCount = 0;

	const handleToggle = useCallback(
		(userId: string) => {
			setSelectedUserIds((prev) => {
				if (prev.includes(userId)) {
					return prev.filter((id) => id !== userId);
				}

				if (prev.length >= remainingSlotsCount) {
					return prev;
				}

				return [...prev, userId];
			});
		},
		[remainingSlotsCount],
	);

	const handleAddFriends = useCallback(async () => {
		setIsAdding(true);
		try {
			const promises = selectedUserIds.map((userId) =>
				PrivateChannelActionCreators.addRecipient(channelId, userId).catch((error) => {
					logger.error(`Failed to add recipient ${userId}:`, error);
					ToastActionCreators.error(i18n._(msg`Failed to add friend to group`));
				}),
			);

			await Promise.all(promises);

			setSelectedUserIds([]);
		} finally {
			setIsAdding(false);
		}
	}, [selectedUserIds, channelId]);

	const handleGenerateInvite = useCallback(async (): Promise<string | null> => {
		setIsGeneratingInvite(true);
		try {
			const cached = inviteCacheRef.current.get(channelId);
			const now = Date.now();
			const EXPIRATION_TIME = MS_PER_DAY;

			if (cached && cached.expiresAt > now) {
				const cachedLink = `${RuntimeConfigStore.inviteEndpoint}/${cached.code}`;
				setInviteLink(cachedLink);
				return cachedLink;
			}

			const invite = await InviteActionCreators.create(channelId, {max_age: 86400});
			const fullUrl = `${RuntimeConfigStore.inviteEndpoint}/${invite.code}`;

			inviteCacheRef.current.set(channelId, {
				code: invite.code,
				expiresAt: now + EXPIRATION_TIME,
			});

			setInviteLink(fullUrl);
			return fullUrl;
		} catch (error) {
			logger.error('Failed to generate invite:', error);
			ToastActionCreators.error(i18n._(msg`Failed to generate invite link`));
			return null;
		} finally {
			setIsGeneratingInvite(false);
		}
	}, [channelId]);

	const handleGenerateOrCopyInvite = useCallback(async (): Promise<boolean> => {
		const linkToCopy = inviteLink ?? (await handleGenerateInvite());
		if (!linkToCopy) {
			return false;
		}
		const copied = await TextCopyActionCreators.copy(i18n, linkToCopy, true);
		if (!copied) {
			ToastActionCreators.error(i18n._(msg`Failed to copy invite link`));
		}
		return copied;
	}, [inviteLink, handleGenerateInvite]);

	return {
		selectedUserIds,
		searchQuery,
		inviteLink,
		isAdding,
		isGeneratingInvite,
		currentMemberIds,
		remainingSlotsCount,
		availableFriendsCount,
		handleToggle,
		handleAddFriends,
		handleGenerateInvite,
		handleGenerateOrCopyInvite,
		setSearchQuery,
	};
}
