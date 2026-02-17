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

import {AllowedMentionParseTypes, MessageReferenceTypes} from '@fluxer/constants/src/ChannelConstants';
import {
	AllowedMentionParseTypeSchema,
	MessageReferenceTypeSchema,
} from '@fluxer/schema/src/primitives/MessageValidators';
import {SnowflakeType, withFieldDescription} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const ALLOWED_MENTIONS_PARSE = [
	AllowedMentionParseTypes.USERS,
	AllowedMentionParseTypes.ROLES,
	AllowedMentionParseTypes.EVERYONE,
] as const;

export const AllowedMentionsRequest = z.object({
	parse: z.array(AllowedMentionParseTypeSchema).optional().describe('Types of mentions to parse from content'),
	users: z.array(SnowflakeType).max(100).optional().describe('Array of user IDs to mention (max 100)'),
	roles: z.array(SnowflakeType).max(100).optional().describe('Array of role IDs to mention (max 100)'),
	replied_user: z.boolean().optional().describe('Whether to mention the author of the replied message'),
});

export type AllowedMentionsRequest = z.infer<typeof AllowedMentionsRequest>;

export const MessageReferenceRequest = z
	.object({
		message_id: SnowflakeType.describe('ID of the message being referenced'),
		channel_id: SnowflakeType.optional().describe('ID of the channel containing the referenced message'),
		guild_id: SnowflakeType.optional().describe('ID of the guild containing the referenced message'),
		type: withFieldDescription(MessageReferenceTypeSchema, 'Type of reference (0 = default, 1 = forward)').optional(),
	})
	.refine(
		(data) => {
			if (data.type === MessageReferenceTypes.FORWARD) {
				return data.channel_id !== undefined && data.message_id !== undefined;
			}
			return true;
		},
		{
			message: 'Forward message reference must include channel_id and message_id',
		},
	);

export type MessageReferenceRequest = z.infer<typeof MessageReferenceRequest>;
