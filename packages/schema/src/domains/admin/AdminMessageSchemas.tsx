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

import {FilenameType} from '@fluxer/schema/src/primitives/FileValidators';
import {Int32Type, SnowflakeType} from '@fluxer/schema/src/primitives/SchemaPrimitives';
import {z} from 'zod';

export const LookupMessageRequest = z.object({
	channel_id: SnowflakeType,
	message_id: SnowflakeType,
	context_limit: z.number().int().min(1).max(100).default(50),
});

export type LookupMessageRequest = z.infer<typeof LookupMessageRequest>;

export const LookupMessageByAttachmentRequest = z.object({
	channel_id: SnowflakeType,
	attachment_id: SnowflakeType,
	filename: FilenameType,
	context_limit: z.number().int().min(1).max(100).default(50),
});

export type LookupMessageByAttachmentRequest = z.infer<typeof LookupMessageByAttachmentRequest>;

export const DeleteMessageRequest = z.object({
	channel_id: SnowflakeType,
	message_id: SnowflakeType,
});

export type DeleteMessageRequest = z.infer<typeof DeleteMessageRequest>;

const MessageShredEntryType = z.object({
	channel_id: SnowflakeType,
	message_id: SnowflakeType,
});

export const MessageShredRequest = z.object({
	user_id: SnowflakeType,
	entries: z.array(MessageShredEntryType).min(1).max(1000),
});

export type MessageShredRequest = z.infer<typeof MessageShredRequest>;

export const MessageShredResponse = z.object({
	success: z.literal(true),
	job_id: z.string(),
	requested: z.number().int().min(0).optional(),
});

export type MessageShredResponse = z.infer<typeof MessageShredResponse>;

export const MessageShredStatusRequest = z.object({
	job_id: z.string(),
});

export type MessageShredStatusRequest = z.infer<typeof MessageShredStatusRequest>;

export const DeleteAllUserMessagesRequest = z.object({
	user_id: SnowflakeType,
	dry_run: z.boolean().default(true),
});

export type DeleteAllUserMessagesRequest = z.infer<typeof DeleteAllUserMessagesRequest>;

export const DeleteAllUserMessagesResponse = z.object({
	success: z.literal(true),
	dry_run: z.boolean(),
	channel_count: Int32Type,
	message_count: Int32Type,
	job_id: z.string().optional(),
});

export type DeleteAllUserMessagesResponse = z.infer<typeof DeleteAllUserMessagesResponse>;
