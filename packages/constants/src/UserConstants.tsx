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

import type {ValueOf} from '@fluxer/constants/src/ValueOf';

export const UNCATEGORIZED_FOLDER_ID = -1;

export const GuildFolderFlags = {
	SHOW_ICON_WHEN_COLLAPSED: 1 << 0,
} as const;

export const GuildFolderFlagsDescriptions: Record<keyof typeof GuildFolderFlags, string> = {
	SHOW_ICON_WHEN_COLLAPSED: 'Show the selected icon instead of guild previews when the folder is collapsed',
};

export const GuildFolderIcons = {
	FOLDER: 'folder',
	STAR: 'star',
	HEART: 'heart',
	BOOKMARK: 'bookmark',
	GAME_CONTROLLER: 'game_controller',
	SHIELD: 'shield',
	MUSIC_NOTE: 'music_note',
} as const;

export type GuildFolderIcon = ValueOf<typeof GuildFolderIcons>;

export const DEFAULT_GUILD_FOLDER_ICON: GuildFolderIcon = GuildFolderIcons.FOLDER;

export const UserAuthenticatorTypes = {
	TOTP: 0,
	SMS: 1,
	WEBAUTHN: 2,
} as const;

export const UserAuthenticatorTypesDescriptions: Record<keyof typeof UserAuthenticatorTypes, string> = {
	TOTP: 'Time-based one-time password authenticator',
	SMS: 'SMS-based authenticator',
	WEBAUTHN: 'WebAuthn authenticator',
};

export const UserPremiumTypes = {
	NONE: 0,
	SUBSCRIPTION: 1,
	LIFETIME: 2,
} as const;

export const UserPremiumTypesDescriptions: Record<keyof typeof UserPremiumTypes, string> = {
	NONE: 'No premium subscription',
	SUBSCRIPTION: 'Active premium subscription',
	LIFETIME: 'Lifetime premium subscription',
};

export const UserFlags = {
	STAFF: 1n << 0n,
	CTP_MEMBER: 1n << 1n,
	PARTNER: 1n << 2n,
	BUG_HUNTER: 1n << 3n,
	HIGH_GLOBAL_RATE_LIMIT: 1n << 33n,
	FRIENDLY_BOT: 1n << 4n,
	FRIENDLY_BOT_MANUAL_APPROVAL: 1n << 5n,
	DELETED: 1n << 34n,
	DISABLED_SUSPICIOUS_ACTIVITY: 1n << 35n,
	SELF_DELETED: 1n << 36n,
	PREMIUM_DISCRIMINATOR: 1n << 37n,
	DISABLED: 1n << 38n,
	HAS_SESSION_STARTED: 1n << 39n,
	PREMIUM_BADGE_HIDDEN: 1n << 40n,
	PREMIUM_BADGE_MASKED: 1n << 41n,
	PREMIUM_BADGE_TIMESTAMP_HIDDEN: 1n << 42n,
	PREMIUM_BADGE_SEQUENCE_HIDDEN: 1n << 43n,
	PREMIUM_PERKS_SANITIZED: 1n << 44n,
	PREMIUM_PURCHASE_DISABLED: 1n << 45n,
	PREMIUM_ENABLED_OVERRIDE: 1n << 46n,
	RATE_LIMIT_BYPASS: 1n << 47n,
	REPORT_BANNED: 1n << 48n,
	VERIFIED_NOT_UNDERAGE: 1n << 49n,
	HAS_DISMISSED_PREMIUM_ONBOARDING: 1n << 51n,
	USED_MOBILE_CLIENT: 1n << 52n,
	APP_STORE_REVIEWER: 1n << 53n,
	DM_HISTORY_BACKFILLED: 1n << 54n,
	HAS_RELATIONSHIPS_INDEXED: 1n << 55n,
	MESSAGES_BY_AUTHOR_BACKFILLED: 1n << 56n,
	STAFF_HIDDEN: 1n << 57n,
	BOT_SANITIZED: 1n << 58n,
} as const;

export const UserFlagsDescriptions: Record<keyof typeof UserFlags, string> = {
	STAFF: 'User is a staff member',
	CTP_MEMBER: 'User is a community test program member',
	PARTNER: 'User is a partner',
	BUG_HUNTER: 'User is a bug hunter',
	HIGH_GLOBAL_RATE_LIMIT: 'User has elevated global rate limits',
	FRIENDLY_BOT: 'Bot accepts friend requests from users',
	FRIENDLY_BOT_MANUAL_APPROVAL: 'Bot requires manual approval for friend requests',
	DELETED: 'User account has been deleted',
	DISABLED_SUSPICIOUS_ACTIVITY: 'User account disabled due to suspicious activity',
	SELF_DELETED: 'User account was self-deleted',
	PREMIUM_DISCRIMINATOR: 'User has a premium discriminator',
	DISABLED: 'User account is disabled',
	HAS_SESSION_STARTED: 'User has started a session',
	PREMIUM_BADGE_HIDDEN: 'User has hidden their premium badge',
	PREMIUM_BADGE_MASKED: 'User has masked their premium badge',
	PREMIUM_BADGE_TIMESTAMP_HIDDEN: 'User has hidden their premium badge timestamp',
	PREMIUM_BADGE_SEQUENCE_HIDDEN: 'User has hidden their premium badge sequence',
	PREMIUM_PERKS_SANITIZED: 'User premium perks are sanitized',
	PREMIUM_PURCHASE_DISABLED: 'Premium purchase is disabled for this user',
	PREMIUM_ENABLED_OVERRIDE: 'Premium status is enabled via override',
	RATE_LIMIT_BYPASS: 'User can bypass rate limits',
	REPORT_BANNED: 'User is banned from reporting',
	VERIFIED_NOT_UNDERAGE: 'User is verified as not underage',
	HAS_DISMISSED_PREMIUM_ONBOARDING: 'User has dismissed premium onboarding',
	USED_MOBILE_CLIENT: 'User has used a mobile client',
	APP_STORE_REVIEWER: 'User is an app store reviewer',
	DM_HISTORY_BACKFILLED: 'User DM history has been backfilled',
	HAS_RELATIONSHIPS_INDEXED: 'User relationships have been indexed',
	MESSAGES_BY_AUTHOR_BACKFILLED: 'Messages by this author have been backfilled',
	STAFF_HIDDEN: 'User staff status is hidden from public flags',
	BOT_SANITIZED: "User's owned bot discriminators have been sanitized",
};

export const PUBLIC_USER_FLAGS =
	UserFlags.STAFF |
	UserFlags.CTP_MEMBER |
	UserFlags.PARTNER |
	UserFlags.BUG_HUNTER |
	UserFlags.FRIENDLY_BOT |
	UserFlags.FRIENDLY_BOT_MANUAL_APPROVAL;

export const DELETED_USER_USERNAME = 'DeletedUser';
export const DELETED_USER_GLOBAL_NAME = 'Deleted User';
export const DELETED_USER_DISCRIMINATOR = 0;

export const PublicUserFlags = {
	STAFF: Number(UserFlags.STAFF),
	CTP_MEMBER: Number(UserFlags.CTP_MEMBER),
	PARTNER: Number(UserFlags.PARTNER),
	BUG_HUNTER: Number(UserFlags.BUG_HUNTER),
	FRIENDLY_BOT: Number(UserFlags.FRIENDLY_BOT),
	FRIENDLY_BOT_MANUAL_APPROVAL: Number(UserFlags.FRIENDLY_BOT_MANUAL_APPROVAL),
} as const;

export const PublicUserFlagsDescriptions: Record<keyof typeof PublicUserFlags, string> = {
	STAFF: 'User is a staff member',
	CTP_MEMBER: 'User is a community test program member',
	PARTNER: 'User is a partner',
	BUG_HUNTER: 'User is a bug hunter',
	FRIENDLY_BOT: 'Bot accepts friend requests from users',
	FRIENDLY_BOT_MANUAL_APPROVAL: 'Bot requires manual approval for friend requests',
};

export const SuspiciousActivityFlags = {
	REQUIRE_VERIFIED_EMAIL: 1 << 0,
	REQUIRE_REVERIFIED_EMAIL: 1 << 1,
	REQUIRE_VERIFIED_PHONE: 1 << 2,
	REQUIRE_REVERIFIED_PHONE: 1 << 3,
	REQUIRE_VERIFIED_EMAIL_OR_VERIFIED_PHONE: 1 << 4,
	REQUIRE_REVERIFIED_EMAIL_OR_VERIFIED_PHONE: 1 << 5,
	REQUIRE_VERIFIED_EMAIL_OR_REVERIFIED_PHONE: 1 << 6,
	REQUIRE_REVERIFIED_EMAIL_OR_REVERIFIED_PHONE: 1 << 7,
} as const;

export const SuspiciousActivityFlagsDescriptions: Record<keyof typeof SuspiciousActivityFlags, string> = {
	REQUIRE_VERIFIED_EMAIL: 'Requires verified email address',
	REQUIRE_REVERIFIED_EMAIL: 'Requires re-verified email address',
	REQUIRE_VERIFIED_PHONE: 'Requires verified phone number',
	REQUIRE_REVERIFIED_PHONE: 'Requires re-verified phone number',
	REQUIRE_VERIFIED_EMAIL_OR_VERIFIED_PHONE: 'Requires verified email or verified phone',
	REQUIRE_REVERIFIED_EMAIL_OR_VERIFIED_PHONE: 'Requires re-verified email or re-verified phone',
	REQUIRE_VERIFIED_EMAIL_OR_REVERIFIED_PHONE: 'Requires verified email or re-verified phone',
	REQUIRE_REVERIFIED_EMAIL_OR_REVERIFIED_PHONE: 'Requires re-verified email or re-verified phone',
};

export const ThemeTypes = {
	DARK: 'dark',
	COAL: 'coal',
	LIGHT: 'light',
	SYSTEM: 'system',
} as const;

export type ThemeType = ValueOf<typeof ThemeTypes>;

export const TimeFormatTypes = {
	AUTO: 0,
	TWELVE_HOUR: 1,
	TWENTY_FOUR_HOUR: 2,
} as const;

export const TimeFormatTypesDescriptions: Record<keyof typeof TimeFormatTypes, string> = {
	AUTO: 'Automatically detect time format based on locale',
	TWELVE_HOUR: 'Use 12-hour time format (AM/PM)',
	TWENTY_FOUR_HOUR: 'Use 24-hour time format',
};

export const StickerAnimationOptions = {
	ALWAYS_ANIMATE: 0,
	ANIMATE_ON_INTERACTION: 1,
	NEVER_ANIMATE: 2,
} as const;

export const StickerAnimationOptionsDescriptions: Record<keyof typeof StickerAnimationOptions, string> = {
	ALWAYS_ANIMATE: 'Always animate stickers',
	ANIMATE_ON_INTERACTION: 'Animate stickers on hover/interaction',
	NEVER_ANIMATE: 'Never animate stickers',
};

export const RenderSpoilers = {
	ALWAYS: 0,
	ON_CLICK: 1,
	IF_MODERATOR: 2,
} as const;

export const RenderSpoilersDescriptions: Record<keyof typeof RenderSpoilers, string> = {
	ALWAYS: 'Always reveal spoiler content',
	ON_CLICK: 'Reveal spoiler content on click',
	IF_MODERATOR: 'Reveal spoiler content if moderator',
};

export const UserExplicitContentFilterTypes = {
	DISABLED: 0,
	NON_FRIENDS: 1,
	FRIENDS_AND_NON_FRIENDS: 2,
} as const;

export const FriendSourceFlags = {
	MUTUAL_FRIENDS: 1 << 0,
	MUTUAL_GUILDS: 1 << 1,
	NO_RELATION: 1 << 2,
} as const;

export const FriendSourceFlagsDescriptions: Record<keyof typeof FriendSourceFlags, string> = {
	MUTUAL_FRIENDS: 'Allow friend requests from users who share mutual friends',
	MUTUAL_GUILDS: 'Allow friend requests from users in mutual guilds',
	NO_RELATION: 'Allow friend requests from users with no existing relation',
};

export const IncomingCallFlags = {
	FRIENDS_OF_FRIENDS: 1 << 0,
	GUILD_MEMBERS: 1 << 1,
	EVERYONE: 1 << 2,
	FRIENDS_ONLY: 1 << 3,
	NOBODY: 1 << 4,
	SILENT_EVERYONE: 1 << 5,
} as const;

export const IncomingCallFlagsDescriptions: Record<keyof typeof IncomingCallFlags, string> = {
	FRIENDS_OF_FRIENDS: 'Allow incoming calls from friends of friends',
	GUILD_MEMBERS: 'Allow incoming calls from guild members',
	EVERYONE: 'Allow incoming calls from everyone',
	FRIENDS_ONLY: 'Allow incoming calls only from friends',
	NOBODY: 'Block all incoming calls',
	SILENT_EVERYONE: 'Allow calls from everyone but receive them silently',
};

export const GroupDmAddPermissionFlags = {
	FRIENDS_OF_FRIENDS: 1 << 0,
	GUILD_MEMBERS: 1 << 1,
	EVERYONE: 1 << 2,
	FRIENDS_ONLY: 1 << 3,
	NOBODY: 1 << 4,
} as const;

export const GroupDmAddPermissionFlagsDescriptions: Record<keyof typeof GroupDmAddPermissionFlags, string> = {
	FRIENDS_OF_FRIENDS: 'Allow friends of friends to add user to group DMs',
	GUILD_MEMBERS: 'Allow guild members to add user to group DMs',
	EVERYONE: 'Allow everyone to add user to group DMs',
	FRIENDS_ONLY: 'Allow only friends to add user to group DMs',
	NOBODY: 'Block everyone from adding user to group DMs',
};

export const UserNotificationSettings = {
	ALL_MESSAGES: 0,
	ONLY_MENTIONS: 1,
	NO_MESSAGES: 2,
	INHERIT: 3,
} as const;

export const UserNotificationSettingsDescriptions: Record<keyof typeof UserNotificationSettings, string> = {
	ALL_MESSAGES: 'Receive notifications for all messages',
	ONLY_MENTIONS: 'Only receive notifications for mentions',
	NO_MESSAGES: 'Do not receive any notifications',
	INHERIT: 'Inherit notification settings from parent',
};

export const RelationshipTypes = {
	FRIEND: 1,
	BLOCKED: 2,
	INCOMING_REQUEST: 3,
	OUTGOING_REQUEST: 4,
} as const;

export const RelationshipTypesDescriptions: Record<keyof typeof RelationshipTypes, string> = {
	FRIEND: 'User is a friend',
	BLOCKED: 'User is blocked',
	INCOMING_REQUEST: 'Pending incoming friend request',
	OUTGOING_REQUEST: 'Pending outgoing friend request',
};
