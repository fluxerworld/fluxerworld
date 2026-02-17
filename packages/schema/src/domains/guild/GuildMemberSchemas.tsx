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

import {GuildMemberProfileFlags, GuildMemberProfileFlagsDescriptions} from '@fluxer/constants/src/GuildConstants';
import {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {createBitflagInt32Type, Int32Type, SnowflakeStringType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const GuildMemberResponse = z.object({
	user: z.lazy(() => UserPartialResponse).describe('The user this guild member represents'),
	nick: z.string().nullish().describe('The nickname of the member in this guild'),
	avatar: z.string().nullish().describe('The hash of the member guild-specific avatar'),
	banner: z.string().nullish().describe('The hash of the member guild-specific banner'),
	accent_color: Int32Type.nullish().describe('The accent colour of the member guild profile as an integer'),
	roles: z.array(z.string()).max(250).describe('Array of role IDs the member has'),
	joined_at: z.iso.datetime().describe('ISO8601 timestamp of when the user joined the guild'),
	mute: z.boolean().describe('Whether the member is muted in voice channels'),
	deaf: z.boolean().describe('Whether the member is deafened in voice channels'),
	communication_disabled_until: z.iso
		.datetime()
		.nullish()
		.describe('ISO8601 timestamp until which the member is timed out'),
	profile_flags: createBitflagInt32Type(
		GuildMemberProfileFlags,
		GuildMemberProfileFlagsDescriptions,
		'Member profile flags',
		'GuildMemberProfileFlags',
	).nullish(),
});

export type GuildMemberResponse = z.infer<typeof GuildMemberResponse>;

export const GuildBanResponse = z.object({
	user: z.lazy(() => UserPartialResponse).describe('The banned user'),
	reason: z.string().nullish().describe('The reason for the ban'),
	moderator_id: SnowflakeStringType.describe('The ID of the moderator who issued the ban'),
	banned_at: z.iso.datetime().describe('ISO8601 timestamp of when the ban was issued'),
	expires_at: z.iso.datetime().nullish().describe('ISO8601 timestamp of when the ban expires (null if permanent)'),
});

export type GuildBanResponse = z.infer<typeof GuildBanResponse>;

export const GuildMemberListResponse = z.array(GuildMemberResponse).max(1000).describe('A list of guild members');
export type GuildMemberListResponse = z.infer<typeof GuildMemberListResponse>;

export const GuildBanListResponse = z.array(GuildBanResponse).max(1000).describe('A list of guild bans');
export type GuildBanListResponse = z.infer<typeof GuildBanListResponse>;

export interface GuildMemberData {
	readonly user: UserPartialResponse;
	readonly nick?: string | null;
	readonly avatar?: string | null;
	readonly banner?: string | null;
	readonly accent_color?: number | null;
	readonly roles: ReadonlyArray<string>;
	readonly joined_at: string;
	readonly mute?: boolean;
	readonly deaf?: boolean;
	readonly communication_disabled_until?: string | null;
	readonly profile_flags?: number | null;
}
