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

import {MessageAttachmentFlags, MessageAttachmentFlagsDescriptions} from '@fluxer/constants/src/ChannelConstants';
import {FilenameType} from '@fluxer/schema/src/primitives/FileValidators';
import {
	coerceNumberFromString,
	createBitflagInt32Type,
	createStringType,
	Int32Type,
	SnowflakeType,
} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

const ClientAttachmentBase = z.object({
	title: createStringType(1, 1024).nullish().describe('A title for the attachment (1-1024 characters)'),
	description: createStringType(1, 4096)
		.nullish()
		.describe('An alt text description of the attachment (1-4096 characters)'),
	flags: coerceNumberFromString(
		createBitflagInt32Type(
			MessageAttachmentFlags,
			MessageAttachmentFlagsDescriptions,
			'Attachment flags',
			'MessageAttachmentFlags',
		),
	).default(0),
	duration: Int32Type.nullish().describe('The duration of the audio file in seconds'),
	waveform: createStringType(1, 4096).nullish().describe('Base64 encoded audio waveform data'),
});

export const ClientAttachmentRequest = ClientAttachmentBase.extend({
	id: coerceNumberFromString(Int32Type).describe('The client-side identifier for this attachment'),
	filename: FilenameType.describe('The name of the file being uploaded'),
});
export type ClientAttachmentRequest = z.infer<typeof ClientAttachmentRequest>;

export const ClientAttachmentReferenceRequest = ClientAttachmentBase.extend({
	id: z
		.union([Int32Type, SnowflakeType])
		.describe('The identifier of the attachment being referenced (snowflake ID or file index)'),
	filename: FilenameType.optional().describe('A new filename for the attachment'),
});
export type ClientAttachmentReferenceRequest = z.infer<typeof ClientAttachmentReferenceRequest>;
