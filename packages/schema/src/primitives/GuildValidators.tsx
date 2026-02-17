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
	GuildExplicitContentFilterTypes,
	GuildMFALevel,
	GuildNSFWLevel,
	GuildSplashCardAlignment,
	GuildVerificationLevel,
	JoinSourceTypes,
} from '@fluxer/constants/src/GuildConstants';
import {MessageNotifications} from '@fluxer/constants/src/NotificationConstants';
import {
	createInt32EnumType,
	createNamedLiteralUnion,
	withOpenApiType,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';

export const GuildVerificationLevelSchema = createInt32EnumType(
	[
		[GuildVerificationLevel.NONE, 'NONE', 'Unrestricted'],
		[GuildVerificationLevel.LOW, 'LOW', 'Must have verified email'],
		[GuildVerificationLevel.MEDIUM, 'MEDIUM', 'Registered for more than 5 minutes'],
		[GuildVerificationLevel.HIGH, 'HIGH', 'Member of the server for more than 10 minutes'],
		[GuildVerificationLevel.VERY_HIGH, 'VERY_HIGH', 'Must have a verified phone number'],
	],
	'Required verification level for members',
	'GuildVerificationLevel',
);

export const GuildMFALevelSchema = createInt32EnumType(
	[
		[GuildMFALevel.NONE, 'NONE', 'Guild has no MFA requirement'],
		[GuildMFALevel.ELEVATED, 'ELEVATED', 'Guild requires 2FA for moderation actions'],
	],
	'Required MFA level for moderation actions',
	'GuildMFALevel',
);

export const GuildExplicitContentFilterSchema = createInt32EnumType(
	[
		[GuildExplicitContentFilterTypes.DISABLED, 'DISABLED', 'Media content will not be scanned'],
		[
			GuildExplicitContentFilterTypes.MEMBERS_WITHOUT_ROLES,
			'MEMBERS_WITHOUT_ROLES',
			'Media content from members without roles will be scanned',
		],
		[GuildExplicitContentFilterTypes.ALL_MEMBERS, 'ALL_MEMBERS', 'Media content from all members will be scanned'],
	],
	'Level of content filtering for explicit media',
	'GuildExplicitContentFilter',
);

export const DefaultMessageNotificationsSchema = createInt32EnumType(
	[
		[MessageNotifications.ALL_MESSAGES, 'ALL_MESSAGES', 'Notify on all messages'],
		[MessageNotifications.ONLY_MENTIONS, 'ONLY_MENTIONS', 'Notify only on mentions'],
	],
	'Default notification level for new members',
	'DefaultMessageNotifications',
);

export const NSFWLevelSchema = createInt32EnumType(
	[
		[GuildNSFWLevel.DEFAULT, 'DEFAULT', 'Default NSFW level'],
		[GuildNSFWLevel.EXPLICIT, 'EXPLICIT', 'Guild has explicit content'],
		[GuildNSFWLevel.SAFE, 'SAFE', 'Guild is safe'],
		[GuildNSFWLevel.AGE_RESTRICTED, 'AGE_RESTRICTED', 'Guild is age-restricted'],
	],
	'The NSFW level of the guild',
	'NSFWLevel',
);

export const SplashCardAlignmentSchema = createNamedLiteralUnion(
	[
		[GuildSplashCardAlignment.CENTER, 'CENTER', 'Splash card is centred'],
		[GuildSplashCardAlignment.LEFT, 'LEFT', 'Splash card is aligned to the left'],
		[GuildSplashCardAlignment.RIGHT, 'RIGHT', 'Splash card is aligned to the right'],
	] as const,
	'Alignment of the guild splash card',
);

export const JoinSourceTypeSchema = withOpenApiType(
	createInt32EnumType(
		[
			[JoinSourceTypes.CREATOR, 'CREATOR', 'Member created the guild'],
			[JoinSourceTypes.INSTANT_INVITE, 'INSTANT_INVITE', 'Member joined via an instant invite'],
			[JoinSourceTypes.VANITY_URL, 'VANITY_URL', 'Member joined via the vanity URL'],
			[JoinSourceTypes.BOT_INVITE, 'BOT_INVITE', 'Member was added via a bot invite'],
			[JoinSourceTypes.ADMIN_FORCE_ADD, 'ADMIN_FORCE_ADD', 'Member was force-added by a platform administrator'],
		],
		'How the member joined the guild',
		'JoinSourceType',
	),
	'JoinSourceType',
);
