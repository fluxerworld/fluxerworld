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

import {
	RelationshipTypes,
	RelationshipTypesDescriptions,
	RenderSpoilers,
	RenderSpoilersDescriptions,
	StickerAnimationOptions,
	StickerAnimationOptionsDescriptions,
	TimeFormatTypes,
	TimeFormatTypesDescriptions,
	UserAuthenticatorTypes,
	UserAuthenticatorTypesDescriptions,
	UserExplicitContentFilterTypes,
	UserNotificationSettings,
	UserNotificationSettingsDescriptions,
	UserPremiumTypes,
	UserPremiumTypesDescriptions,
} from '@fluxer/constants/src/UserConstants';
import {createInt32EnumType} from '@fluxer/schema/src/primitives/SchemaPrimitives';

export const StickerAnimationOptionsSchema = createInt32EnumType(
	[
		[StickerAnimationOptions.ALWAYS_ANIMATE, 'ALWAYS_ANIMATE', StickerAnimationOptionsDescriptions.ALWAYS_ANIMATE],
		[
			StickerAnimationOptions.ANIMATE_ON_INTERACTION,
			'ANIMATE_ON_INTERACTION',
			StickerAnimationOptionsDescriptions.ANIMATE_ON_INTERACTION,
		],
		[StickerAnimationOptions.NEVER_ANIMATE, 'NEVER_ANIMATE', StickerAnimationOptionsDescriptions.NEVER_ANIMATE],
	],
	'Sticker animation preference',
	'StickerAnimationOptions',
);

export const RenderSpoilersSchema = createInt32EnumType(
	[
		[RenderSpoilers.ALWAYS, 'ALWAYS', RenderSpoilersDescriptions.ALWAYS],
		[RenderSpoilers.ON_CLICK, 'ON_CLICK', RenderSpoilersDescriptions.ON_CLICK],
		[RenderSpoilers.IF_MODERATOR, 'IF_MODERATOR', RenderSpoilersDescriptions.IF_MODERATOR],
	],
	'Spoiler rendering preference',
	'RenderSpoilers',
);

export const TimeFormatTypesSchema = createInt32EnumType(
	[
		[TimeFormatTypes.AUTO, 'AUTO', TimeFormatTypesDescriptions.AUTO],
		[TimeFormatTypes.TWELVE_HOUR, 'TWELVE_HOUR', TimeFormatTypesDescriptions.TWELVE_HOUR],
		[TimeFormatTypes.TWENTY_FOUR_HOUR, 'TWENTY_FOUR_HOUR', TimeFormatTypesDescriptions.TWENTY_FOUR_HOUR],
	],
	'Time format preference',
	'TimeFormatTypes',
);

export const UserNotificationSettingsSchema = createInt32EnumType(
	[
		[UserNotificationSettings.ALL_MESSAGES, 'ALL_MESSAGES', UserNotificationSettingsDescriptions.ALL_MESSAGES],
		[UserNotificationSettings.ONLY_MENTIONS, 'ONLY_MENTIONS', UserNotificationSettingsDescriptions.ONLY_MENTIONS],
		[UserNotificationSettings.NO_MESSAGES, 'NO_MESSAGES', UserNotificationSettingsDescriptions.NO_MESSAGES],
		[UserNotificationSettings.INHERIT, 'INHERIT', UserNotificationSettingsDescriptions.INHERIT],
	],
	'Notification level preference',
	'UserNotificationSettings',
);

export const RelationshipTypesSchema = createInt32EnumType(
	[
		[RelationshipTypes.FRIEND, 'FRIEND', RelationshipTypesDescriptions.FRIEND],
		[RelationshipTypes.BLOCKED, 'BLOCKED', RelationshipTypesDescriptions.BLOCKED],
		[RelationshipTypes.INCOMING_REQUEST, 'INCOMING_REQUEST', RelationshipTypesDescriptions.INCOMING_REQUEST],
		[RelationshipTypes.OUTGOING_REQUEST, 'OUTGOING_REQUEST', RelationshipTypesDescriptions.OUTGOING_REQUEST],
	],
	'Relationship type',
	'RelationshipTypes',
);

export const UserPremiumTypesSchema = createInt32EnumType(
	[
		[UserPremiumTypes.NONE, 'NONE', UserPremiumTypesDescriptions.NONE],
		[UserPremiumTypes.SUBSCRIPTION, 'SUBSCRIPTION', UserPremiumTypesDescriptions.SUBSCRIPTION],
		[UserPremiumTypes.LIFETIME, 'LIFETIME', UserPremiumTypesDescriptions.LIFETIME],
	],
	'Premium subscription type',
	'UserPremiumTypes',
);

export const UserAuthenticatorTypesSchema = createInt32EnumType(
	[
		[UserAuthenticatorTypes.TOTP, 'TOTP', UserAuthenticatorTypesDescriptions.TOTP],
		[UserAuthenticatorTypes.SMS, 'SMS', UserAuthenticatorTypesDescriptions.SMS],
		[UserAuthenticatorTypes.WEBAUTHN, 'WEBAUTHN', UserAuthenticatorTypesDescriptions.WEBAUTHN],
	],
	'Authenticator type',
	'UserAuthenticatorTypes',
);

export const UserExplicitContentFilterTypesSchema = createInt32EnumType(
	[
		[UserExplicitContentFilterTypes.DISABLED, 'DISABLED', 'Explicit content filter disabled'],
		[UserExplicitContentFilterTypes.NON_FRIENDS, 'NON_FRIENDS', 'Filter explicit content from non-friends only'],
		[
			UserExplicitContentFilterTypes.FRIENDS_AND_NON_FRIENDS,
			'FRIENDS_AND_NON_FRIENDS',
			'Filter explicit content from all users',
		],
	],
	'Explicit content filter level',
	'UserExplicitContentFilterTypes',
);
