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

import {splitMediaAndFileAttachments} from '@app/components/channel/MessageAttachmentUtils';
import DeveloperOptionsStore from '@app/stores/DeveloperOptionsStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import {mapAttachmentsWithExpiry} from '@app/utils/AttachmentExpiryUtils';
import type {MessageAttachment} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';

interface AttachmentRenderingState {
	enrichedAttachments: Array<MessageAttachment>;
	activeAttachments: Array<MessageAttachment>;
	mediaAttachments: Array<MessageAttachment>;
	shouldUseMosaic: boolean;
}

export const getAttachmentRenderingState = (
	snapshotAttachments?: ReadonlyArray<MessageAttachment> | null,
): AttachmentRenderingState => {
	const attachments = snapshotAttachments ?? [];
	const expiryApplied = mapAttachmentsWithExpiry(attachments, DeveloperOptionsStore.mockAttachmentStates);
	const enrichedAttachments = expiryApplied.map((entry) => entry.attachment);
	const activeAttachments = expiryApplied.filter((entry) => !entry.isExpired).map((entry) => entry.attachment);
	const {mediaAttachments} = splitMediaAndFileAttachments(activeAttachments);
	const shouldUseMosaic = mediaAttachments.length >= 2 && UserSettingsStore.getInlineAttachmentMedia();

	return {
		enrichedAttachments,
		activeAttachments,
		mediaAttachments,
		shouldUseMosaic,
	};
};
