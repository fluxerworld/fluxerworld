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

import {StatusTypes} from '@fluxer/constants/src/StatusConstants';
import type {ValueOf} from '@fluxer/constants/src/ValueOf';
import {GuildMemberResponse} from '@fluxer/schema/src/domains/guild/GuildMemberSchemas';
import {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import {Int32Type, SnowflakeStringType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

const StatusTypeValues = Object.values(StatusTypes) as Array<ValueOf<typeof StatusTypes>>;

export const StatusTypeSchema = z.enum(
	StatusTypeValues as [ValueOf<typeof StatusTypes>, ...Array<ValueOf<typeof StatusTypes>>],
);

export const CustomStatusResponse = z.object({
	text: z.string().describe('The custom status text'),
	emoji_id: SnowflakeStringType.nullable().describe('The ID of the custom emoji used in the status'),
	emoji_name: z.string().nullable().describe('The name of the emoji used in the status'),
	expires_at: z.string().nullable().describe('ISO8601 timestamp when the custom status expires'),
});

export type CustomStatusResponse = z.infer<typeof CustomStatusResponse>;

export const PresenceResponse = z.object({
	user: UserPartialResponse.describe('The user this presence is for'),
	status: StatusTypeSchema.describe('The current online status of the user'),
	mobile: z.boolean().describe('Whether the user is on a mobile device'),
	afk: z.boolean().describe('Whether the user is marked as AFK'),
	custom_status: CustomStatusResponse.nullable().describe('The custom status set by the user'),
});

export type PresenceResponse = z.infer<typeof PresenceResponse>;

export const SessionResponse = z.object({
	session_id: z.string().describe('The session identifier, or "all" for the aggregate session'),
	status: StatusTypeSchema.describe('The status for this session'),
	mobile: z.boolean().describe('Whether this session is on a mobile device'),
	afk: z.boolean().describe('Whether this session is marked as AFK'),
});

export type SessionResponse = z.infer<typeof SessionResponse>;

export const VoiceStateResponse = z.object({
	guild_id: SnowflakeStringType.nullable().describe('The guild ID this voice state is for, null if in a DM call'),
	channel_id: SnowflakeStringType.nullable().describe('The channel ID the user is connected to, null if disconnected'),
	user_id: SnowflakeStringType.describe('The user ID this voice state is for'),
	connection_id: z.string().nullable().optional().describe('The unique connection identifier'),
	session_id: z.string().optional().describe('The session ID for this voice state'),
	member: GuildMemberResponse.optional().describe('The guild member data, if in a guild voice channel'),
	mute: z.boolean().describe('Whether the user is server muted'),
	deaf: z.boolean().describe('Whether the user is server deafened'),
	self_mute: z.boolean().describe('Whether the user has muted themselves'),
	self_deaf: z.boolean().describe('Whether the user has deafened themselves'),
	self_video: z.boolean().optional().describe('Whether the user has their camera enabled'),
	self_stream: z.boolean().optional().describe('Whether the user is streaming'),
	is_mobile: z.boolean().optional().describe('Whether the user is connected from a mobile device'),
	viewer_stream_keys: z
		.array(z.string())
		.nullable()
		.optional()
		.describe('The stream keys the user is currently viewing'),
	version: Int32Type.optional().describe('The voice state version for ordering updates'),
});

export type VoiceStateResponse = z.infer<typeof VoiceStateResponse>;

export const ReadStateResponse = z.object({
	id: SnowflakeStringType.describe('The channel ID for this read state'),
	mention_count: Int32Type.describe('Number of unread mentions in the channel'),
	last_message_id: SnowflakeStringType.nullable().describe('The ID of the last message read'),
	last_pin_timestamp: z.string().nullable().describe('ISO8601 timestamp of the last pinned message acknowledged'),
});

export type ReadStateResponse = z.infer<typeof ReadStateResponse>;

export const GuildReadyResponse = z.object({
	id: SnowflakeStringType.describe('The unique identifier for this guild'),
	unavailable: z.boolean().optional().describe('Whether the guild is unavailable due to an outage'),
	name: z.string().optional().describe('The name of the guild'),
	icon: z.string().nullish().describe('The hash of the guild icon'),
	owner_id: SnowflakeStringType.optional().describe('The ID of the guild owner'),
	member_count: Int32Type.optional().describe('Total number of members in the guild'),
	lazy: z.boolean().optional().describe('Whether this guild uses lazy loading'),
	large: z.boolean().optional().describe('Whether this guild is considered large'),
	joined_at: z.string().optional().describe('ISO8601 timestamp of when the user joined'),
});

export type GuildReadyResponse = z.infer<typeof GuildReadyResponse>;

export const GatewayBotResponse = z.object({
	url: z.string().describe('WebSocket URL to connect to the gateway'),
	shards: z.number().int().describe('Recommended number of shards to use when connecting'),
	session_start_limit: z
		.object({
			total: z.number().int().describe('Total number of session starts allowed'),
			remaining: z.number().int().describe('Remaining number of session starts'),
			reset_after: z.number().int().describe('Milliseconds until the limit resets'),
			max_concurrency: z.number().int().describe('Maximum number of concurrent IDENTIFY requests'),
		})
		.describe('Session start rate limit information'),
});

export type GatewayBotResponse = z.infer<typeof GatewayBotResponse>;
