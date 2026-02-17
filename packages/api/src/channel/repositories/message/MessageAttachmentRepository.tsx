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

import type {AttachmentID, ChannelID, MessageID} from '@fluxer/api/src/BrandedTypes';
import {fetchMany, fetchOne} from '@fluxer/api/src/database/Cassandra';
import type {AttachmentLookupRow} from '@fluxer/api/src/database/types/MessageTypes';
import {AttachmentLookup} from '@fluxer/api/src/Tables';

const LOOKUP_ATTACHMENT_BY_CHANNEL_AND_FILENAME_QUERY = AttachmentLookup.selectCql({
	where: [
		AttachmentLookup.where.eq('channel_id'),
		AttachmentLookup.where.eq('attachment_id'),
		AttachmentLookup.where.eq('filename'),
	],
	limit: 1,
});

const LIST_CHANNEL_ATTACHMENTS_QUERY = AttachmentLookup.selectCql({
	where: AttachmentLookup.where.eq('channel_id'),
});

export class MessageAttachmentRepository {
	async lookupAttachmentByChannelAndFilename(
		channelId: ChannelID,
		attachmentId: AttachmentID,
		filename: string,
	): Promise<MessageID | null> {
		const result = await fetchOne<AttachmentLookupRow>(LOOKUP_ATTACHMENT_BY_CHANNEL_AND_FILENAME_QUERY, {
			channel_id: channelId,
			attachment_id: attachmentId,
			filename,
		});
		return result ? result.message_id : null;
	}

	async listChannelAttachments(channelId: ChannelID): Promise<Array<AttachmentLookupRow>> {
		const results = await fetchMany<AttachmentLookupRow>(LIST_CHANNEL_ATTACHMENTS_QUERY, {
			channel_id: channelId,
		});
		return results;
	}
}
