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
import {
	ClientAttachmentReferenceRequest,
	ClientAttachmentRequest,
} from '@fluxer/schema/src/domains/message/AttachmentSchemas';
import {AllowedMentionsRequest, MessageReferenceRequest} from '@fluxer/schema/src/domains/message/SharedMessageSchemas';
import {createQueryIntegerType, DateTimeType} from '@fluxer/schema/src/primitives/QueryValidators';
import {
	ColorType,
	createBitflagInt32Type,
	createNamedStringLiteralUnion,
	createStringType,
	createUnboundedStringType,
	Int32Type,
	SnowflakeType,
	withOpenApiType,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {AttachmentURLType, URLType} from '@fluxer/schema/src/primitives/UrlValidators';
import {z} from 'zod';

export const RichEmbedAuthorRequest = z.object({
	name: createStringType().describe('Name of the embed author'),
	url: URLType.nullish().describe('URL to link from the author name'),
	icon_url: URLType.nullish().describe('URL of the author icon'),
});

export type RichEmbedAuthorRequest = z.infer<typeof RichEmbedAuthorRequest>;

export const RichEmbedMediaRequest = z.object({
	url: AttachmentURLType.describe('URL of the media (image, video, etc.)'),
	description: createStringType(1, 4096).nullish().describe('Alt text description of the media'),
});

export type RichEmbedMediaRequest = z.infer<typeof RichEmbedMediaRequest>;

export const RichEmbedFooterRequest = z.object({
	text: createStringType(1, 2048).describe('Footer text (1-2048 characters)'),
	icon_url: URLType.nullish().describe('URL of the footer icon'),
});

export type RichEmbedFooterRequest = z.infer<typeof RichEmbedFooterRequest>;

export const RichEmbedFieldRequest = z.object({
	name: createStringType().describe('Name of the field'),
	value: createStringType(1, 1024).describe('Value of the field (1-1024 characters)'),
	inline: z.boolean().default(false).describe('Whether the field should display inline'),
});

export type RichEmbedFieldRequest = z.infer<typeof RichEmbedFieldRequest>;

export const RichEmbedRequest = z.object({
	url: URLType.nullish().describe('URL of the embed'),
	title: createStringType().nullish().describe('Title of the embed'),
	color: ColorType.nullish().describe('Color code of the embed (hex integer)'),
	timestamp: DateTimeType.nullish().describe('ISO8601 timestamp for the embed'),
	description: createStringType(1, 4096).nullish().describe('Description of the embed (1-4096 characters)'),
	author: RichEmbedAuthorRequest.nullish().describe('Author information'),
	image: RichEmbedMediaRequest.nullish().describe('Image to display in the embed'),
	thumbnail: RichEmbedMediaRequest.nullish().describe('Thumbnail image for the embed'),
	footer: RichEmbedFooterRequest.nullish().describe('Footer information'),
	fields: z.array(RichEmbedFieldRequest).max(25).nullish().describe('Array of field objects (max 25)'),
});

export type RichEmbedRequest = z.infer<typeof RichEmbedRequest>;

export const MessageAuthorType = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['user', 'user', 'A regular user account'],
			['bot', 'bot', 'An automated bot account'],
			['webhook', 'webhook', 'A webhook-generated message'],
		],
		'The type of author who sent the message',
	),
	'MessageAuthorType',
);

export type MessageAuthorType = z.infer<typeof MessageAuthorType>;

export const MessageContentType = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['image', 'image', 'Message contains an image attachment'],
			['sound', 'sound', 'Message contains an audio attachment'],
			['video', 'video', 'Message contains a video attachment'],
			['file', 'file', 'Message contains a file attachment'],
			['sticker', 'sticker', 'Message contains a sticker'],
			['embed', 'embed', 'Message contains an embed'],
			['link', 'link', 'Message contains a URL link'],
			['poll', 'poll', 'Message contains a poll'],
			['snapshot', 'snapshot', 'Message contains a forwarded message snapshot'],
		],
		'The type of content contained in a message',
	),
	'MessageContentType',
);

export type MessageContentType = z.infer<typeof MessageContentType>;

export const MessageEmbedType = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['image', 'image', 'An image embed from a linked URL'],
			['video', 'video', 'A video embed from a linked URL'],
			['sound', 'sound', 'An audio embed from a linked URL'],
			['article', 'article', 'An article or webpage embed with metadata'],
		],
		'The type of embed content',
	),
	'MessageEmbedType',
);

export type MessageEmbedType = z.infer<typeof MessageEmbedType>;

export const MessageSortField = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['timestamp', 'timestamp', 'Sort results by message timestamp'],
			['relevance', 'relevance', 'Sort results by search relevance score'],
		],
		'The field to sort search results by',
	),
	'MessageSortField',
);

export type MessageSortField = z.infer<typeof MessageSortField>;

export const MessageSortOrder = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['asc', 'asc', 'Sort in ascending order (oldest/lowest first)'],
			['desc', 'desc', 'Sort in descending order (newest/highest first)'],
		],
		'The order to sort search results',
	),
	'MessageSortOrder',
);

export type MessageSortOrder = z.infer<typeof MessageSortOrder>;

export const MessageSearchScope = withOpenApiType(
	createNamedStringLiteralUnion(
		[
			['current', 'current', 'Search only in the current channel or community context'],
			['open_dms', 'open_dms', 'Search across all DMs you currently have open'],
			['all_dms', 'all_dms', "Search across all DMs you've ever been in"],
			['all_guilds', 'all_guilds', "Search across all Communities you're currently in"],
			['all', 'all', "Search across all DMs you've ever been in and all Communities you're currently in"],
			[
				'open_dms_and_all_guilds',
				'open_dms_and_all_guilds',
				"Search across all DMs you currently have open and all Communities you're currently in",
			],
		],
		'Search scope for message searches',
	),
	'MessageSearchScope',
);

export type MessageSearchScope = z.infer<typeof MessageSearchScope>;

export const MessageSearchRequest = z.object({
	hits_per_page: z.number().int().min(1).max(25).default(25).describe('Number of results per page (1-25)'),
	page: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).default(1).describe('Page number for pagination'),
	max_id: SnowflakeType.optional().describe('Maximum message ID to include in results'),
	min_id: SnowflakeType.optional().describe('Minimum message ID to include in results'),

	content: createStringType(1, 1024).optional().describe('Text content to search for'),
	contents: z.array(createStringType(1, 1024)).max(100).optional().describe('Multiple content queries to search for'),
	exact_phrases: z
		.array(createStringType(1, 1024))
		.max(10)
		.optional()
		.describe('Exact phrases that must appear contiguously in message content'),

	channel_id: z.array(SnowflakeType).max(500).optional().describe('Channel IDs to search in'),
	exclude_channel_id: z.array(SnowflakeType).max(500).optional().describe('Channel IDs to exclude from search'),

	author_type: z.array(MessageAuthorType).optional().describe('Author types to filter by'),
	exclude_author_type: z.array(MessageAuthorType).optional().describe('Author types to exclude'),
	author_id: z.array(SnowflakeType).optional().describe('Author user IDs to filter by'),
	exclude_author_id: z.array(SnowflakeType).optional().describe('Author user IDs to exclude'),

	mentions: z.array(SnowflakeType).optional().describe('User IDs that must be mentioned'),
	exclude_mentions: z.array(SnowflakeType).optional().describe('User IDs that must not be mentioned'),
	mention_everyone: z.boolean().optional().describe('Filter by whether message mentions everyone'),

	pinned: z.boolean().optional().describe('Filter by pinned status'),

	has: z.array(MessageContentType).optional().describe('Content types the message must have'),
	exclude_has: z.array(MessageContentType).optional().describe('Content types the message must not have'),

	embed_type: z.array(MessageEmbedType).optional().describe('Embed types to filter by'),
	exclude_embed_type: z.array(MessageEmbedType).optional().describe('Embed types to exclude'),
	embed_provider: z.array(createStringType(1, 256)).optional().describe('Embed providers to filter by'),
	exclude_embed_provider: z.array(createStringType(1, 256)).optional().describe('Embed providers to exclude'),

	link_hostname: z.array(createStringType(1, 255)).optional().describe('Link hostnames to filter by'),
	exclude_link_hostname: z.array(createStringType(1, 255)).optional().describe('Link hostnames to exclude'),

	attachment_filename: z.array(createStringType(1, 1024)).optional().describe('Attachment filenames to filter by'),
	exclude_attachment_filename: z
		.array(createStringType(1, 1024))
		.optional()
		.describe('Attachment filenames to exclude'),
	attachment_extension: z.array(createStringType(1, 32)).optional().describe('File extensions to filter by'),
	exclude_attachment_extension: z.array(createStringType(1, 32)).optional().describe('File extensions to exclude'),

	sort_by: MessageSortField.default('timestamp').describe('Field to sort results by'),
	sort_order: MessageSortOrder.default('desc').describe('Sort order for results'),

	include_nsfw: z.boolean().default(false).describe('Whether to include NSFW channel results'),
	scope: MessageSearchScope.optional().describe('Scope to search within when querying messages'),
});

export type MessageSearchRequest = z.infer<typeof MessageSearchRequest>;

export const GlobalSearchMessagesRequest = MessageSearchRequest.extend({
	context_channel_id: SnowflakeType.optional().describe(
		'Channel ID for context when searching across multiple channels',
	),
	context_guild_id: SnowflakeType.optional().describe('Guild ID for context when searching across multiple guilds'),
	channel_ids: z.array(SnowflakeType).max(500).optional().describe('Specific channel IDs to search in'),
});

export type GlobalSearchMessagesRequest = z.infer<typeof GlobalSearchMessagesRequest>;

export const MessageRequestSchema = z
	.object({
		content: createUnboundedStringType().nullish().describe('The message content (up to 2000 characters)'),
		embeds: z.array(RichEmbedRequest).describe('Array of embed objects to include in the message'),
		attachments: z.array(ClientAttachmentRequest).describe('Array of attachment objects'),
		message_reference: MessageReferenceRequest.nullish().describe(
			'Reference to another message (for replies or forwards)',
		),
		allowed_mentions: AllowedMentionsRequest.nullish().describe('Controls which mentions trigger notifications'),
		flags: createBitflagInt32Type(
			MessageFlags,
			MessageFlagsDescriptions,
			'Message flags bitfield',
			'MessageFlags',
		).default(0),
		nonce: createStringType(1, 32).describe('Client-generated identifier for the message'),
		favorite_meme_id: SnowflakeType.nullish().describe('ID of a favorite meme to attach'),
		sticker_ids: z.array(SnowflakeType).max(3).nullish().describe('Array of sticker IDs to include (max 3)'),
		tts: z.boolean().optional().describe('Whether this is a text-to-speech message'),
	})
	.partial();

export type MessageRequestSchemaType = z.infer<typeof MessageRequestSchema>;

export const MessageUpdateRequestSchema = MessageRequestSchema.pick({
	content: true,
	embeds: true,
	allowed_mentions: true,
}).extend({
	flags: createBitflagInt32Type(
		MessageFlags,
		MessageFlagsDescriptions,
		'Message flags bitfield',
		'MessageFlags',
	).optional(),
	attachments: z
		.array(ClientAttachmentReferenceRequest)
		.optional()
		.describe('Array of attachment objects to keep or add'),
});

export type MessageUpdateRequestSchemaType = z.infer<typeof MessageUpdateRequestSchema>;

export const MessagesQuery = z.object({
	limit: createQueryIntegerType({defaultValue: 50, minValue: 1, maxValue: 100}).describe(
		'Number of messages to return (1-100, default 50)',
	),
	before: SnowflakeType.optional().describe('Get messages before this message ID'),
	after: SnowflakeType.optional().describe('Get messages after this message ID'),
	around: SnowflakeType.optional().describe('Get messages around this message ID'),
});

export type MessagesQuery = z.infer<typeof MessagesQuery>;

export const BulkDeleteMessagesRequest = z.object({
	message_ids: z.array(SnowflakeType).describe('Array of message IDs to delete'),
});

export type BulkDeleteMessagesRequest = z.infer<typeof BulkDeleteMessagesRequest>;

export const MessageAckRequest = z.object({
	mention_count: Int32Type.optional().describe('Number of mentions to acknowledge'),
	manual: z.boolean().optional().describe('Whether this is a manual acknowledgement'),
});

export type MessageAckRequest = z.infer<typeof MessageAckRequest>;

export const ChannelPinsQuerySchema = z.object({
	limit: z.coerce
		.number()
		.int()
		.min(1)
		.max(50)
		.optional()
		.describe('Maximum number of pinned messages to return (1-50)'),
	before: z.coerce.date().optional().describe('Get pinned messages before this timestamp'),
});
export type ChannelPinsQuerySchema = z.infer<typeof ChannelPinsQuerySchema>;

export const ReactionUsersQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).optional().describe('Maximum number of users to return (1-100)'),
	after: SnowflakeType.optional().describe('Get users after this user ID'),
});
export type ReactionUsersQuerySchema = z.infer<typeof ReactionUsersQuerySchema>;
