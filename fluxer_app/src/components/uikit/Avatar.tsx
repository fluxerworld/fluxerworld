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

import {getStatusTypeLabel} from '@app/AppConstants';
import {BaseAvatar} from '@app/components/uikit/BaseAvatar';
import {useHover} from '@app/hooks/useHover';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import type {UserRecord} from '@app/records/UserRecord';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import * as ImageCacheUtils from '@app/utils/ImageCacheUtils';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import React, {type CSSProperties, useEffect, useMemo, useState} from 'react';

interface AvatarProps {
	user: UserRecord;
	size: number;
	status?: string | null;
	isMobileStatus?: boolean;
	forceAnimate?: boolean;
	isTyping?: boolean;
	showOffline?: boolean;
	className?: string;
	style?: CSSProperties;
	isClickable?: boolean;
	disableStatusTooltip?: boolean;
	avatarUrl?: string | null;
	hoverAvatarUrl?: string | null;
	guildId?: string | null;
}

const AvatarComponent = React.forwardRef<HTMLDivElement, AvatarProps>(
	(
		{
			user,
			size,
			status,
			isMobileStatus = false,
			forceAnimate = false,
			isTyping = false,
			showOffline = true,
			className,
			isClickable = false,
			disableStatusTooltip = false,
			avatarUrl: customAvatarUrl,
			hoverAvatarUrl: customHoverAvatarUrl,
			guildId,
			...props
		},
		ref,
	) => {
		const {i18n} = useLingui();
		const guildMember = GuildMemberStore.getMember(guildId || '', user.id);

		const avatarUrl = useMemo(() => {
			if (customAvatarUrl !== undefined) return customAvatarUrl;

			if (guildId && guildMember?.avatar) {
				return AvatarUtils.getGuildMemberAvatarURL({
					guildId,
					userId: user.id,
					avatar: guildMember.avatar,
					memberAvatar: guildMember.avatar,
					animated: false,
				});
			}

			return AvatarUtils.getUserAvatarURL(user, false);
		}, [user, customAvatarUrl, guildId, guildMember]);

		const hoverAvatarUrl = useMemo(() => {
			if (customHoverAvatarUrl !== undefined) return customHoverAvatarUrl;

			if (guildId && guildMember?.avatar) {
				return AvatarUtils.getGuildMemberAvatarURL({
					guildId,
					userId: user.id,
					avatar: guildMember.avatar,
					memberAvatar: guildMember.avatar,
					animated: true,
				});
			}

			return AvatarUtils.getUserAvatarURL(user, true);
		}, [user, customHoverAvatarUrl, guildId, guildMember]);

		const statusLabel = status != null ? getStatusTypeLabel(i18n, status) : null;

		const [hoverRef, isHovering] = useHover();
		const [isStaticLoaded, setIsStaticLoaded] = useState(ImageCacheUtils.hasImage(avatarUrl));
		const [isAnimatedLoaded, setIsAnimatedLoaded] = useState(ImageCacheUtils.hasImage(hoverAvatarUrl));
		const [shouldPlayAnimated, setShouldPlayAnimated] = useState(false);

		useEffect(() => {
			ImageCacheUtils.loadImage(avatarUrl, () => setIsStaticLoaded(true));
			if (isHovering || forceAnimate) {
				ImageCacheUtils.loadImage(hoverAvatarUrl, () => setIsAnimatedLoaded(true));
			}
		}, [avatarUrl, hoverAvatarUrl, isHovering, forceAnimate]);

		useEffect(() => {
			setShouldPlayAnimated((isHovering || forceAnimate) && isAnimatedLoaded);
		}, [isHovering, forceAnimate, isAnimatedLoaded]);

		const safeAvatarUrl = avatarUrl || AvatarUtils.getUserAvatarURL({id: user.id, avatar: null}, false);
		const safeHoverAvatarUrl = hoverAvatarUrl || undefined;

		return (
			<BaseAvatar
				ref={useMergeRefs([ref, hoverRef])}
				size={size}
				avatarUrl={safeAvatarUrl}
				hoverAvatarUrl={safeHoverAvatarUrl}
				status={status}
				isMobileStatus={isMobileStatus}
				shouldPlayAnimated={shouldPlayAnimated && isStaticLoaded}
				isTyping={isTyping}
				showOffline={showOffline}
				className={className}
				isClickable={isClickable}
				userTag={user.tag}
				statusLabel={statusLabel}
				disableStatusTooltip={disableStatusTooltip}
				{...props}
			/>
		);
	},
);

AvatarComponent.displayName = 'Avatar';

export const Avatar = observer(AvatarComponent);
