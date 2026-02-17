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

import {recordCounter, recordHistogram} from '@fluxer/api/src/Telemetry';

export type MessageDeleteType = 'single' | 'bulk' | 'moderation';
export type AttachmentOperation = 'upload' | 'process' | 'delete';
export type AttachmentStatus = 'success' | 'error';

export function recordMessageSent(params: {
	channelType: string;
	hasAttachments: string;
	hasEmbeds: string;
	messageType: string;
}): void {
	recordCounter({
		name: 'fluxer.messages.sent.total',
		dimensions: {
			channel_type: params.channelType,
			has_attachments: params.hasAttachments,
			has_embeds: params.hasEmbeds,
			message_type: params.messageType,
		},
	});
}

export function recordMessageSendDuration(params: {channelType: string; durationMs: number}): void {
	recordHistogram({
		name: 'fluxer.messages.send.duration_ms',
		valueMs: params.durationMs,
		dimensions: {
			channel_type: params.channelType,
		},
	});
}

export function recordMessageEdited(params: {channelType: number}): void {
	recordCounter({
		name: 'fluxer.messages.edited.total',
		dimensions: {
			channel_type: String(params.channelType),
		},
	});
}

export function recordMessageDeleted(params: {channelType: number; deleteType: MessageDeleteType}): void {
	recordCounter({
		name: 'fluxer.messages.deleted.total',
		dimensions: {
			channel_type: String(params.channelType),
			delete_type: params.deleteType,
		},
	});
}

export function recordMessageRetrieved(params: {channelType: number; count: number}): void {
	recordCounter({
		name: 'fluxer.messages.retrieved.total',
		dimensions: {
			channel_type: String(params.channelType),
			count: String(params.count),
		},
	});
}

export function recordMessageRetrievalDuration(params: {channelType: number; durationMs: number}): void {
	recordHistogram({
		name: 'fluxer.messages.retrieval.duration_ms',
		valueMs: params.durationMs,
		dimensions: {
			channel_type: String(params.channelType),
		},
	});
}

export function recordAttachmentOperation(params: {
	operation: AttachmentOperation;
	contentType: string;
	status: AttachmentStatus;
}): void {
	recordCounter({
		name: 'fluxer.messages.attachments.total',
		dimensions: {
			operation: params.operation,
			content_type: params.contentType,
			status: params.status,
		},
	});
}

export function recordAttachmentUploadDuration(params: {contentType: string; durationMs: number}): void {
	recordHistogram({
		name: 'fluxer.messages.attachment.upload.duration_ms',
		valueMs: params.durationMs,
		dimensions: {
			content_type: params.contentType,
		},
	});
}
