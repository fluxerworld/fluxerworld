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
	AllowedMentionParseTypes,
	AllowedMentionParseTypesDescriptions,
	EmbedMediaFlags,
	EmbedMediaFlagsDescriptions,
	MessageAttachmentFlags,
	MessageAttachmentFlagsDescriptions,
	MessageEmbedTypes,
	MessageFlags,
	MessageFlagsDescriptions,
	MessageReferenceTypes,
	MessageReferenceTypesDescriptions,
	MessageTypes,
} from '@fluxer/constants/src/ChannelConstants';
import {
	createBitflagInt32Type,
	createInt32EnumType,
	createNamedStringLiteralUnion,
	withOpenApiType,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';

export const MessageTypeSchema = withOpenApiType(
	createInt32EnumType(
		[
			[MessageTypes.DEFAULT, 'DEFAULT', 'A regular message'],
			[MessageTypes.RECIPIENT_ADD, 'RECIPIENT_ADD', 'A system message indicating a user was added to the conversation'],
			[
				MessageTypes.RECIPIENT_REMOVE,
				'RECIPIENT_REMOVE',
				'A system message indicating a user was removed from the conversation',
			],
			[MessageTypes.CALL, 'CALL', 'A message representing a call'],
			[MessageTypes.CHANNEL_NAME_CHANGE, 'CHANNEL_NAME_CHANGE', 'A system message indicating the channel name changed'],
			[MessageTypes.CHANNEL_ICON_CHANGE, 'CHANNEL_ICON_CHANGE', 'A system message indicating the channel icon changed'],
			[
				MessageTypes.CHANNEL_PINNED_MESSAGE,
				'CHANNEL_PINNED_MESSAGE',
				'A system message indicating a message was pinned',
			],
			[MessageTypes.USER_JOIN, 'USER_JOIN', 'A system message indicating a user joined'],
			[MessageTypes.REPLY, 'REPLY', 'A reply message'],
		],
		'The type of message',
	),
	'MessageType',
);

export const MessageReferenceTypeSchema = createInt32EnumType(
	[
		[MessageReferenceTypes.DEFAULT, 'DEFAULT', MessageReferenceTypesDescriptions.DEFAULT],
		[MessageReferenceTypes.FORWARD, 'FORWARD', MessageReferenceTypesDescriptions.FORWARD],
	],
	'The type of message reference',
	'MessageReferenceType',
);

export const AllowedMentionParseTypeSchema = createNamedStringLiteralUnion(
	[
		[AllowedMentionParseTypes.USERS, 'USERS', AllowedMentionParseTypesDescriptions.USERS],
		[AllowedMentionParseTypes.ROLES, 'ROLES', AllowedMentionParseTypesDescriptions.ROLES],
		[AllowedMentionParseTypes.EVERYONE, 'EVERYONE', AllowedMentionParseTypesDescriptions.EVERYONE],
	],
	'Types of mentions to parse from content',
);

export const MessageFlagsSchema = withOpenApiType(
	createBitflagInt32Type(MessageFlags, MessageFlagsDescriptions, 'Message bitflags', 'MessageFlags'),
	'MessageFlags',
);

export const MessageAttachmentFlagsSchema = withOpenApiType(
	createBitflagInt32Type(
		MessageAttachmentFlags,
		MessageAttachmentFlagsDescriptions,
		'Message attachment bitflags',
		'MessageAttachmentFlags',
	),
	'MessageAttachmentFlags',
);

export const EmbedMediaFlagsSchema = withOpenApiType(
	createBitflagInt32Type(EmbedMediaFlags, EmbedMediaFlagsDescriptions, 'Embed media bitflags', 'EmbedMediaFlags'),
	'EmbedMediaFlags',
);

export const MessageEmbedTypeSchema = createNamedStringLiteralUnion(
	[
		[MessageEmbedTypes.RICH, 'RICH', 'Rich embed with custom content'],
		[MessageEmbedTypes.ARTICLE, 'ARTICLE', 'Article embed from a link'],
		[MessageEmbedTypes.LINK, 'LINK', 'Link embed'],
		[MessageEmbedTypes.IMAGE, 'IMAGE', 'Image embed'],
		[MessageEmbedTypes.VIDEO, 'VIDEO', 'Video embed'],
		[MessageEmbedTypes.AUDIO, 'AUDIO', 'Audio embed'],
		[MessageEmbedTypes.GIFV, 'GIFV', 'Animated GIF video embed'],
	],
	'The type of embed',
);
