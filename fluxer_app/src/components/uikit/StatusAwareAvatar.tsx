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

import {Avatar} from '@app/components/uikit/Avatar';
import type {UserRecord} from '@app/records/UserRecord';
import PresenceStore from '@app/stores/PresenceStore';
import TransientPresenceStore from '@app/stores/TransientPresenceStore';
import type {StatusType} from '@fluxer/constants/src/StatusConstants';
import {StatusTypes} from '@fluxer/constants/src/StatusConstants';
import {reaction} from 'mobx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useEffect, useState} from 'react';

interface StatusAwareAvatarProps {
	user: UserRecord | null;
	size: 16 | 24 | 28 | 32 | 36 | 40 | 44 | 48 | 56 | 64 | 80 | 120;
	forceAnimate?: boolean;
	isTyping?: boolean;
	showOffline?: boolean;
	className?: string;
	isClickable?: boolean;
	disablePresence?: boolean;
	disableStatusTooltip?: boolean;
	avatarUrl?: string | null;
	hoverAvatarUrl?: string | null;
	guildId?: string | null;
	status?: string | null;
}

function getStatusWithTransientFallback(userId: string): StatusType {
	const presenceStatus = PresenceStore.getStatus(userId);
	if (presenceStatus !== StatusTypes.OFFLINE) {
		return presenceStatus;
	}
	return TransientPresenceStore.getStatus(userId);
}

export const StatusAwareAvatar: React.FC<StatusAwareAvatarProps> = observer(
	({
		user,
		size,
		forceAnimate,
		isTyping,
		showOffline,
		className,
		isClickable,
		disablePresence,
		disableStatusTooltip = false,
		avatarUrl,
		hoverAvatarUrl,
		guildId,
		status: externalStatus,
	}) => {
		const [internalStatus, setInternalStatus] = useState<string | null>(() =>
			disablePresence || !user ? null : getStatusWithTransientFallback(user.id),
		);
		const [isMobile, setIsMobile] = useState<boolean>(() =>
			disablePresence || !user ? false : PresenceStore.isMobile(user.id),
		);

		const status = externalStatus ?? internalStatus;

		useEffect(() => {
			if (disablePresence || !user || externalStatus !== undefined) {
				return;
			}

			setInternalStatus(getStatusWithTransientFallback(user.id));
			setIsMobile(PresenceStore.isMobile(user.id));

			const unsubscribePresence = PresenceStore.subscribeToUserStatus(user.id, (_, newStatus, newIsMobile) => {
				if (newStatus !== StatusTypes.OFFLINE) {
					setInternalStatus(newStatus);
				} else {
					setInternalStatus(getStatusWithTransientFallback(user.id));
				}
				setIsMobile(newIsMobile);
			});

			const disposeTransient = reaction(
				() => TransientPresenceStore.getTransientStatus(user.id),
				() => {
					const presenceStatus = PresenceStore.getStatus(user.id);
					if (presenceStatus === StatusTypes.OFFLINE) {
						setInternalStatus(getStatusWithTransientFallback(user.id));
					}
				},
			);

			return () => {
				unsubscribePresence();
				disposeTransient();
			};
		}, [user?.id, disablePresence, user, externalStatus]);

		if (!user) {
			return null;
		}

		const shouldDisablePresence = disablePresence || user.system;

		return (
			<Avatar
				user={user}
				size={size}
				status={shouldDisablePresence ? null : status}
				isMobileStatus={shouldDisablePresence ? false : isMobile}
				forceAnimate={forceAnimate}
				isTyping={isTyping}
				showOffline={showOffline}
				className={className}
				isClickable={isClickable}
				disableStatusTooltip={disableStatusTooltip}
				avatarUrl={avatarUrl}
				hoverAvatarUrl={hoverAvatarUrl}
				guildId={guildId}
			/>
		);
	},
);
