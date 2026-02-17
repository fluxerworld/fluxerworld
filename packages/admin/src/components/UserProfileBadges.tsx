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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {hasBigIntFlag, parseBigIntOrZero} from '@fluxer/admin/src/utils/Bigint';
import {cn} from '@fluxer/admin/src/utils/ClassNames';
import {UserFlags, UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {getFormattedShortDate} from '@fluxer/date_utils/src/DateFormatting';
import type {UserAdminResponse} from '@fluxer/schema/src/domains/admin/AdminUserSchemas';
import {normalizeEndpoint} from '@fluxer/ui/src/utils/AvatarMediaUtils';

interface BadgeDefinition {
	key: string;
	iconUrl: string;
	tooltip: string;
}

export interface UserProfileBadgesProps {
	config: Config;
	user: UserAdminResponse;
	size?: 'sm' | 'md';
	class?: string;
}

export function UserProfileBadges({config, user, size = 'sm', class: className}: UserProfileBadgesProps) {
	const flags = parseBigIntOrZero(user.flags);
	const badges: Array<BadgeDefinition> = [];
	const isSelfHosted = config.selfHosted;
	const staticCdnEndpoint = normalizeEndpoint(config.staticCdnEndpoint);

	if (hasBigIntFlag(flags, UserFlags.STAFF)) {
		badges.push({
			key: 'staff',
			iconUrl: `${staticCdnEndpoint}/badges/staff.svg`,
			tooltip: 'Fluxer Staff',
		});
	}

	if (!isSelfHosted && hasBigIntFlag(flags, UserFlags.CTP_MEMBER)) {
		badges.push({
			key: 'ctp',
			iconUrl: `${staticCdnEndpoint}/badges/ctp.svg`,
			tooltip: 'Fluxer Community Team',
		});
	}

	if (!isSelfHosted && hasBigIntFlag(flags, UserFlags.PARTNER)) {
		badges.push({
			key: 'partner',
			iconUrl: `${staticCdnEndpoint}/badges/partner.svg`,
			tooltip: 'Fluxer Partner',
		});
	}

	if (!isSelfHosted && hasBigIntFlag(flags, UserFlags.BUG_HUNTER)) {
		badges.push({
			key: 'bug_hunter',
			iconUrl: `${staticCdnEndpoint}/badges/bug-hunter.svg`,
			tooltip: 'Fluxer Bug Hunter',
		});
	}

	if (!isSelfHosted && user.premium_type && user.premium_type !== UserPremiumTypes.NONE) {
		let tooltip = 'Fluxer Plutonium';

		if (user.premium_type === UserPremiumTypes.LIFETIME) {
			if (user.premium_since) {
				const premiumSince = getFormattedShortDate(user.premium_since);
				tooltip = `Fluxer Visionary since ${premiumSince}`;
			} else {
				tooltip = 'Fluxer Visionary';
			}
		} else if (user.premium_since) {
			const premiumSince = getFormattedShortDate(user.premium_since);
			tooltip = `Fluxer Plutonium subscriber since ${premiumSince}`;
		}

		badges.push({
			key: 'premium',
			iconUrl: `${staticCdnEndpoint}/badges/plutonium.svg`,
			tooltip,
		});
	}

	if (badges.length === 0) {
		return null;
	}

	const badgeSizeClass = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
	const containerClass = cn('flex items-center', size === 'md' ? 'gap-2' : 'gap-1.5', className);

	return (
		<div class={containerClass}>
			{badges.map((badge) => (
				<img
					key={badge.key}
					src={badge.iconUrl}
					alt={badge.tooltip}
					title={badge.tooltip}
					class={cn(badgeSizeClass, 'shrink-0')}
				/>
			))}
		</div>
	);
}
