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

import MemberSidebarStore from '@app/stores/MemberSidebarStore';
import PresenceStore from '@app/stores/PresenceStore';
import TransientPresenceStore from '@app/stores/TransientPresenceStore';
import type {StatusType} from '@fluxer/constants/src/StatusConstants';
import {isOfflineStatus, StatusTypes} from '@fluxer/constants/src/StatusConstants';
import {reaction} from 'mobx';
import {useCallback, useEffect, useState} from 'react';

interface UseMemberListPresenceOptions {
	guildId: string;
	channelId: string;
	userId: string;
	enabled?: boolean;
}

export function resolveMemberListPresence({
	guildId,
	channelId,
	userId,
	enabled = true,
}: UseMemberListPresenceOptions): StatusType {
	const memberListPresence = enabled ? MemberSidebarStore.getPresence(guildId, channelId, userId) : null;

	const presenceStatus = PresenceStore.getStatus(userId);
	if (!isOfflineStatus(presenceStatus)) {
		return presenceStatus;
	}

	const transientStatus = TransientPresenceStore.getTransientStatus(userId);
	if (transientStatus !== null && !isOfflineStatus(transientStatus)) {
		return transientStatus;
	}

	if (memberListPresence !== null) {
		return memberListPresence;
	}

	return transientStatus ?? StatusTypes.OFFLINE;
}

export function useMemberListPresence({
	guildId,
	channelId,
	userId,
	enabled = true,
}: UseMemberListPresenceOptions): StatusType {
	const computeStatus = useCallback(
		() =>
			resolveMemberListPresence({
				guildId,
				channelId,
				userId,
				enabled,
			}),
		[channelId, enabled, guildId, userId],
	);

	const [status, setStatus] = useState<StatusType>(() => computeStatus());

	useEffect(() => {
		setStatus(computeStatus());

		let disposeMemberListReaction: (() => void) | undefined;
		if (enabled) {
			disposeMemberListReaction = reaction(
				() => MemberSidebarStore.getPresence(guildId, channelId, userId),
				() => setStatus(computeStatus()),
				{fireImmediately: false},
			);
		}

		const unsubscribePresence = PresenceStore.subscribeToUserStatus(userId, () => {
			setStatus(computeStatus());
		});

		const disposeTransient = reaction(
			() => TransientPresenceStore.getTransientStatus(userId),
			() => setStatus(computeStatus()),
			{fireImmediately: false},
		);

		return () => {
			unsubscribePresence();
			disposeTransient();
			disposeMemberListReaction?.();
		};
	}, [computeStatus, enabled, guildId, channelId, userId]);

	return status;
}
