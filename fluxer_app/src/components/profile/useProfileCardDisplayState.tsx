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

import type {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import type {ProfileRecord} from '@app/records/ProfileRecord';
import type {UserRecord} from '@app/records/UserRecord';
import {getUserAccentColor} from '@app/utils/AccentColorUtils';
import * as ProfileDisplayUtils from '@app/utils/ProfileDisplayUtils';
import {MEDIA_PROXY_PROFILE_BANNER_SIZE_POPOUT} from '@fluxer/constants/src/MediaProxyAssetSizes';
import type {MediaProxyImageSize} from '@fluxer/constants/src/MediaProxyImageSizes';
import type {UserProfile} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {useMemo} from 'react';

export interface ProfileCardDisplayStateParams {
	user: UserRecord;
	profile: ProfileRecord | null;
	guildId?: string | null;
	guildMember?: GuildMemberRecord | null;
	guildMemberProfile?: UserProfile | null;
	previewOverrides?: ProfileDisplayUtils.ProfilePreviewOverrides;
	accentUser?: UserRecord;
	bannerSize?: MediaProxyImageSize;
	shouldAutoplayProfileAnimations: boolean;
}

export interface ProfileCardDisplayState {
	profileContext: ProfileDisplayUtils.ProfileDisplayContext;
	avatarUrl: string | null;
	hoverAvatarUrl: string | null;
	bannerUrl: string | null;
	accentColor: string;
	profileData: Readonly<UserProfile> | null;
}

export function useProfileCardDisplayState({
	user,
	profile,
	guildId,
	guildMember,
	guildMemberProfile,
	previewOverrides,
	accentUser,
	bannerSize,
	shouldAutoplayProfileAnimations,
}: ProfileCardDisplayStateParams): ProfileCardDisplayState {
	const profileContext = useMemo<ProfileDisplayUtils.ProfileDisplayContext>(
		() => ({
			user,
			profile,
			guildId,
			guildMember,
			guildMemberProfile,
		}),
		[user, profile, guildId, guildMember, guildMemberProfile],
	);

	const avatarUrls = useMemo(
		() => ProfileDisplayUtils.getProfileAvatarUrls(profileContext, previewOverrides),
		[profileContext, previewOverrides],
	);

	const resolvedBannerSize: MediaProxyImageSize = bannerSize ?? MEDIA_PROXY_PROFILE_BANNER_SIZE_POPOUT;
	const bannerUrl = useMemo(
		() =>
			ProfileDisplayUtils.getProfileBannerUrl(
				profileContext,
				previewOverrides,
				shouldAutoplayProfileAnimations,
				resolvedBannerSize,
			),
		[profileContext, previewOverrides, shouldAutoplayProfileAnimations, resolvedBannerSize],
	);

	const profileData = useMemo(() => profile?.getEffectiveProfile() ?? null, [profile]);
	const accentColor = useMemo(
		() => getUserAccentColor(accentUser ?? user, profileData?.accent_color),
		[accentUser ?? user, profileData?.accent_color],
	);

	return {
		profileContext,
		avatarUrl: avatarUrls.avatarUrl,
		hoverAvatarUrl: avatarUrls.hoverAvatarUrl,
		bannerUrl,
		accentColor,
		profileData,
	};
}
