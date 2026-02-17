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

import {MessageFlags, MessageFlagsDescriptions} from '@fluxer/constants/src/ChannelConstants';
import {MessageEmbedResponse} from '@fluxer/schema/src/domains/message/EmbedSchemas';
import {
	MessageAttachmentResponse,
	MessageStickerResponse,
} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {
	AllowedMentionParseTypeSchema,
	MessageReferenceTypeSchema,
} from '@fluxer/schema/src/primitives/MessageValidators';
import {
	createBitflagInt32Type,
	createNamedStringLiteralUnion,
	SnowflakeStringType,
	withFieldDescription,
	withOpenApiType,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const ScheduledMessageAllowedMentionsSchema = z.object({
	parse: z.array(AllowedMentionParseTypeSchema).optional().describe('Types of mentions to parse from content'),
	users: z.array(SnowflakeStringType).optional().describe('Array of user IDs to mention'),
	roles: z.array(SnowflakeStringType).optional().describe('Array of role IDs to mention'),
	replied_user: z.boolean().optional().describe('Whether to mention the author of the replied message'),
});

export type ScheduledMessageAllowedMentionsSchema = z.infer<typeof ScheduledMessageAllowedMentionsSchema>;

export const ScheduledMessageReferenceSchema = z.object({
	message_id: SnowflakeStringType.describe('ID of the message being referenced'),
	channel_id: SnowflakeStringType.optional().describe('ID of the channel containing the referenced message'),
	guild_id: SnowflakeStringType.optional().describe('ID of the guild containing the referenced message'),
	type: withFieldDescription(MessageReferenceTypeSchema, 'The type of message reference').optional(),
});

export type ScheduledMessageReferenceSchema = z.infer<typeof ScheduledMessageReferenceSchema>;

export const ScheduledMessagePayloadResponseSchema = z.object({
	content: z.string().nullish().describe('The text content of the scheduled message'),
	tts: z.boolean().optional().describe('Whether this is a text-to-speech message'),
	embeds: z.array(MessageEmbedResponse).max(10).optional().describe('Array of embed objects attached to the message'),
	attachments: z
		.array(MessageAttachmentResponse)
		.max(10)
		.optional()
		.describe('Array of attachment objects for the message'),
	stickers: z
		.array(MessageStickerResponse)
		.max(3)
		.optional()
		.describe('Array of sticker objects attached to the message'),
	sticker_ids: z
		.array(SnowflakeStringType)
		.max(3)
		.optional()
		.describe('Array of sticker IDs to include in the message'),
	allowed_mentions: ScheduledMessageAllowedMentionsSchema.optional().describe(
		'Controls which mentions trigger notifications',
	),
	message_reference: ScheduledMessageReferenceSchema.optional().describe(
		'Reference to another message (for replies or forwards)',
	),
	flags: createBitflagInt32Type(MessageFlags, MessageFlagsDescriptions, 'Message flags', 'MessageFlags').optional(),
	nonce: z.string().optional().describe('Client-generated identifier for the message'),
	favorite_meme_id: SnowflakeStringType.optional().describe('ID of a favorite meme to attach'),
});

export type ScheduledMessagePayloadResponseSchema = z.infer<typeof ScheduledMessagePayloadResponseSchema>;

export const ScheduledMessageStatus = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['pending', 'pending', 'The message is pending validation and has not yet been scheduled'],
			['invalid', 'invalid', 'The message failed validation and cannot be sent'],
			['scheduled', 'scheduled', 'The message has been validated and is scheduled for delivery'],
			['sent', 'sent', 'The message has been successfully sent'],
			['failed', 'failed', 'The message failed to send after being scheduled'],
			['cancelled', 'cancelled', 'The scheduled message was cancelled by the user'],
		],
		'The current status of the scheduled message',
	),
	'ScheduledMessageStatus',
);

export type ScheduledMessageStatus = z.infer<typeof ScheduledMessageStatus>;

export const ScheduledMessageResponseSchema = z.object({
	id: SnowflakeStringType.describe('The unique identifier for this scheduled message'),
	channel_id: SnowflakeStringType.describe('The ID of the channel this message will be sent to'),
	scheduled_at: z.string().describe('The ISO 8601 UTC timestamp when the message is scheduled to be sent'),
	scheduled_local_at: z.string().describe('The ISO 8601 timestamp in the user local timezone'),
	timezone: z.string().describe('The IANA timezone identifier used for scheduling'),
	status: ScheduledMessageStatus.describe('The current status of the scheduled message'),
	status_reason: z.string().nullable().describe('A human-readable reason for the current status, if applicable'),
	payload: ScheduledMessagePayloadResponseSchema.describe('The message content and metadata to be sent'),
	created_at: z.string().describe('The ISO 8601 timestamp when this scheduled message was created'),
	invalidated_at: z.string().nullable().describe('The ISO 8601 timestamp when the message was marked invalid'),
});

export type ScheduledMessageResponseSchema = z.infer<typeof ScheduledMessageResponseSchema>;

export const ScheduledMessageListResponse = z
	.array(ScheduledMessageResponseSchema)
	.max(100)
	.describe('A list of scheduled messages');
export type ScheduledMessageListResponse = z.infer<typeof ScheduledMessageListResponse>;
