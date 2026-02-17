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

import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildStickerRecord} from '@app/records/GuildStickerRecord';
import PermissionStore from '@app/stores/PermissionStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {LimitResolver} from '@app/utils/limits/LimitResolverAdapter';
import {isLimitToggleEnabled} from '@app/utils/limits/LimitUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import type {I18n} from '@lingui/core';
import {msg} from '@lingui/core/macro';

export interface AvailabilityCheck {
	canUse: boolean;
	isLockedByPremium: boolean;
	isLockedByPermission: boolean;
	lockReason?: string;
}

function hasGlobalExpressionsEnabled(): boolean {
	return isLimitToggleEnabled(
		{
			feature_global_expressions: LimitResolver.resolve({key: 'feature_global_expressions', fallback: 0}),
		},
		'feature_global_expressions',
	);
}

export function checkEmojiAvailability(i18n: I18n, emoji: FlatEmoji, channel: ChannelRecord | null): AvailabilityCheck {
	return checkEmojiAvailabilityWithGuildFallback(i18n, emoji, channel, null);
}

export function checkEmojiAvailabilityWithGuildFallback(
	i18n: I18n,
	emoji: FlatEmoji,
	channel: ChannelRecord | null,
	guildIdFallback: string | null,
): AvailabilityCheck {
	if (!emoji.guildId) {
		return {
			canUse: true,
			isLockedByPremium: false,
			isLockedByPermission: false,
		};
	}

	const hasGlobalExpressions = hasGlobalExpressionsEnabled();
	const channelGuildId = channel?.guildId ?? guildIdFallback;

	if (!channelGuildId) {
		if (!hasGlobalExpressions) {
			if (!RuntimeConfigStore.isSelfHosted()) {
				return {
					canUse: false,
					isLockedByPremium: true,
					isLockedByPermission: false,
					lockReason: i18n._(msg`Unlock custom emojis in DMs with Plutonium`),
				};
			}
			return {
				canUse: false,
				isLockedByPremium: false,
				isLockedByPermission: false,
			};
		}
		return {
			canUse: true,
			isLockedByPremium: false,
			isLockedByPermission: false,
		};
	}

	const isExternalEmoji = emoji.guildId !== channelGuildId;

	if (!isExternalEmoji) {
		return {
			canUse: true,
			isLockedByPremium: false,
			isLockedByPermission: false,
		};
	}

	const hasPermission = PermissionStore.can(Permissions.USE_EXTERNAL_EMOJIS, {
		guildId: channelGuildId,
		channelId: channel?.id,
	});

	if (!hasPermission) {
		return {
			canUse: false,
			isLockedByPremium: false,
			isLockedByPermission: true,
			lockReason: i18n._(msg`You lack permission to use external emojis in this channel`),
		};
	}

	if (!hasGlobalExpressions) {
		if (!RuntimeConfigStore.isSelfHosted()) {
			return {
				canUse: false,
				isLockedByPremium: true,
				isLockedByPermission: false,
				lockReason: i18n._(msg`Unlock external custom emojis with Plutonium`),
			};
		}

		return {
			canUse: false,
			isLockedByPremium: false,
			isLockedByPermission: false,
		};
	}

	return {
		canUse: true,
		isLockedByPremium: false,
		isLockedByPermission: false,
	};
}

export function checkStickerAvailability(
	i18n: I18n,
	sticker: GuildStickerRecord,
	channel: ChannelRecord | null,
): AvailabilityCheck {
	if (!sticker.guildId) {
		return {
			canUse: true,
			isLockedByPremium: false,
			isLockedByPermission: false,
		};
	}

	const hasGlobalExpressions = isLimitToggleEnabled(
		{
			feature_global_expressions: LimitResolver.resolve({key: 'feature_global_expressions', fallback: 0}),
		},
		'feature_global_expressions',
	);

	if (!channel?.guildId) {
		if (!hasGlobalExpressions) {
			if (!RuntimeConfigStore.isSelfHosted()) {
				return {
					canUse: false,
					isLockedByPremium: true,
					isLockedByPermission: false,
					lockReason: i18n._(msg`Unlock stickers in DMs with Plutonium`),
				};
			}
			return {
				canUse: false,
				isLockedByPremium: false,
				isLockedByPermission: false,
			};
		}
		return {
			canUse: true,
			isLockedByPremium: false,
			isLockedByPermission: false,
		};
	}

	const isExternalSticker = sticker.guildId !== channel.guildId;

	if (!isExternalSticker) {
		return {
			canUse: true,
			isLockedByPremium: false,
			isLockedByPermission: false,
		};
	}

	const hasPermission = PermissionStore.can(Permissions.USE_EXTERNAL_STICKERS, {
		guildId: channel.guildId,
		channelId: channel.id,
	});

	if (!hasPermission) {
		if (!hasGlobalExpressions) {
			return {
				canUse: false,
				isLockedByPremium: false,
				isLockedByPermission: true,
				lockReason: i18n._(msg`You lack permission to use external stickers in this channel`),
			};
		}
		return {
			canUse: false,
			isLockedByPremium: false,
			isLockedByPermission: true,
			lockReason: i18n._(msg`You lack permission to use external stickers in this channel`),
		};
	}

	if (!hasGlobalExpressions) {
		if (!RuntimeConfigStore.isSelfHosted()) {
			return {
				canUse: false,
				isLockedByPremium: true,
				isLockedByPermission: false,
				lockReason: i18n._(msg`Unlock external stickers with Plutonium`),
			};
		}
		return {
			canUse: false,
			isLockedByPremium: false,
			isLockedByPermission: false,
		};
	}

	return {
		canUse: true,
		isLockedByPremium: false,
		isLockedByPermission: false,
	};
}

export function filterEmojisForAutocomplete(
	i18n: I18n,
	emojis: ReadonlyArray<FlatEmoji>,
	channel: ChannelRecord | null,
): ReadonlyArray<FlatEmoji> {
	return emojis.filter((emoji) => {
		const check = checkEmojiAvailability(i18n, emoji, channel);
		return check.canUse;
	});
}

export function filterStickersForAutocomplete(
	i18n: I18n,
	stickers: ReadonlyArray<GuildStickerRecord>,
	channel: ChannelRecord | null,
): ReadonlyArray<GuildStickerRecord> {
	return stickers.filter((sticker) => {
		const check = checkStickerAvailability(i18n, sticker, channel);
		return check.canUse;
	});
}

export function shouldShowEmojiPremiumUpsell(channel: ChannelRecord | null): boolean {
	if (RuntimeConfigStore.isSelfHosted()) {
		return false;
	}

	const hasGlobalExpressions = hasGlobalExpressionsEnabled();

	if (hasGlobalExpressions) {
		return false;
	}

	if (!channel?.guildId) {
		return true;
	}

	const hasPermission = PermissionStore.can(Permissions.USE_EXTERNAL_EMOJIS, {
		guildId: channel.guildId,
		channelId: channel.id,
	});

	return hasPermission;
}

export function shouldShowStickerPremiumUpsell(channel: ChannelRecord | null): boolean {
	if (RuntimeConfigStore.isSelfHosted()) {
		return false;
	}

	const hasGlobalExpressions = isLimitToggleEnabled(
		{
			feature_global_expressions: LimitResolver.resolve({key: 'feature_global_expressions', fallback: 0}),
		},
		'feature_global_expressions',
	);

	if (hasGlobalExpressions) {
		return false;
	}

	if (!channel?.guildId) {
		return true;
	}

	const hasPermission = PermissionStore.can(Permissions.USE_EXTERNAL_STICKERS, {
		guildId: channel.guildId,
		channelId: channel.id,
	});

	return hasPermission;
}
