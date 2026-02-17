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

import type {MediaViewerItem} from '@app/stores/MediaViewerStore';
import {MessageAttachmentFlags} from '@fluxer/constants/src/ChannelConstants';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';

export function determineMediaType(attachment: MessageAttachment): 'audio' | 'video' | 'gifv' | 'gif' | 'image' {
	if (attachment.content_type?.startsWith('audio/')) {
		return 'audio';
	}
	if (attachment.content_type?.startsWith('video/') && (attachment.flags & MessageAttachmentFlags.IS_ANIMATED) !== 0) {
		return 'gifv';
	}
	if ((attachment.flags & MessageAttachmentFlags.IS_ANIMATED) !== 0 || attachment.content_type === 'image/gif') {
		return 'gif';
	}
	if (attachment.content_type?.startsWith('video/')) {
		return 'video';
	}
	return 'image';
}

export function attachmentToViewerItem(
	attachment: MessageAttachment,
	overrides?: Partial<MediaViewerItem>,
): MediaViewerItem {
	const type = determineMediaType(attachment);
	return {
		src: attachment.proxy_url ?? attachment.url ?? '',
		originalSrc: attachment.url ?? '',
		naturalWidth: attachment.width || 0,
		naturalHeight: attachment.height || 0,
		type,
		contentHash: attachment.content_hash,
		attachmentId: attachment.id,
		filename: attachment.filename,
		fileSize: attachment.size,
		duration: attachment.duration,
		expiresAt: attachment.expires_at ?? null,
		expired: attachment.expired ?? false,
		animated: type === 'gif' || type === 'gifv',
		...overrides,
	};
}

interface AttachmentsToViewerItemsOptions {
	filterType?: 'video';
	initialTimeForId?: {attachmentId: string; time: number};
}

export function attachmentsToViewerItems(
	attachments: ReadonlyArray<MessageAttachment>,
	options?: AttachmentsToViewerItemsOptions,
): Array<MediaViewerItem> {
	const filtered = options?.filterType
		? attachments.filter((att) => att.content_type?.startsWith(`${options.filterType}/`))
		: attachments;

	return filtered.map((att) => {
		const initialTimeMatch = options?.initialTimeForId?.attachmentId === att.id;
		return attachmentToViewerItem(att, initialTimeMatch ? {initialTime: options!.initialTimeForId!.time} : undefined);
	});
}

export function findViewerItemIndex(items: ReadonlyArray<MediaViewerItem>, attachmentId?: string): number {
	return Math.max(
		0,
		items.findIndex((item) => item.attachmentId === attachmentId),
	);
}
