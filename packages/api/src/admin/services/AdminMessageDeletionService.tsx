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

import type {AdminAuditService} from '@fluxer/api/src/admin/services/AdminAuditService';
import type {AdminMessageShredService} from '@fluxer/api/src/admin/services/AdminMessageShredService';
import type {ChannelID, MessageID, UserID} from '@fluxer/api/src/BrandedTypes';
import {createUserID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import {Logger} from '@fluxer/api/src/Logger';
import {withBusinessSpan} from '@fluxer/api/src/telemetry/BusinessSpans';
import type {
	DeleteAllUserMessagesRequest,
	DeleteAllUserMessagesResponse,
} from '@fluxer/schema/src/domains/admin/AdminMessageSchemas';
import {recordCounter} from '@fluxer/telemetry/src/Metrics';

interface AdminMessageDeletionServiceDeps {
	channelRepository: IChannelRepository;
	messageShredService: AdminMessageShredService;
	auditService: AdminAuditService;
}

const FETCH_CHUNK_SIZE = 200;

export class AdminMessageDeletionService {
	constructor(private readonly deps: AdminMessageDeletionServiceDeps) {}

	async deleteAllUserMessages(
		data: DeleteAllUserMessagesRequest,
		adminUserId: UserID,
		auditLogReason: string | null,
	): Promise<DeleteAllUserMessagesResponse> {
		const authorId = createUserID(data.user_id);

		return await withBusinessSpan(
			'fluxer.admin.message_bulk_delete',
			'fluxer.admin.messages.bulk_deleted',
			{
				user_id: data.user_id.toString(),
				dry_run: data.dry_run ? 'true' : 'false',
			},
			async () => {
				const {entries, channelCount, messageCount} = await this.collectMessageRefs(authorId, !data.dry_run);

				const metadata = new Map<string, string>([
					['user_id', data.user_id.toString()],
					['channel_count', channelCount.toString()],
					['message_count', messageCount.toString()],
					['dry_run', data.dry_run ? 'true' : 'false'],
				]);

				const action = data.dry_run ? 'delete_all_user_messages_dry_run' : 'delete_all_user_messages';

				await this.deps.auditService.createAuditLog({
					adminUserId,
					targetType: 'message_deletion',
					targetId: data.user_id,
					action,
					auditLogReason,
					metadata,
				});

				Logger.debug(
					{user_id: data.user_id, channel_count: channelCount, message_count: messageCount, dry_run: data.dry_run},
					'Computed delete-all-messages stats',
				);

				const response: DeleteAllUserMessagesResponse = {
					success: true,
					dry_run: data.dry_run,
					channel_count: channelCount,
					message_count: messageCount,
				};

				if (data.dry_run || messageCount === 0) {
					return response;
				}

				const shredResult = await this.deps.messageShredService.queueMessageShred(
					{
						user_id: data.user_id,
						entries,
					},
					adminUserId,
					auditLogReason,
				);

				response.job_id = shredResult.job_id;

				recordCounter({
					name: 'fluxer.admin.messages.bulk_deleted_count',
					value: messageCount,
					dimensions: {
						user_id: data.user_id.toString(),
					},
				});

				return response;
			},
		);
	}

	private async collectMessageRefs(authorId: UserID, includeEntries: boolean) {
		let lastMessageId: MessageID | undefined;
		const entries: Array<{channel_id: ChannelID; message_id: MessageID}> = [];
		let messageCount = 0;
		let channelCount = 0;

		while (true) {
			const messageRefs = await this.deps.channelRepository.listMessagesByAuthor(
				authorId,
				FETCH_CHUNK_SIZE,
				lastMessageId,
			);

			if (messageRefs.length === 0) {
				break;
			}

			const channelsInChunk = new Set<string>();

			for (const {channelId, messageId} of messageRefs) {
				channelsInChunk.add(channelId.toString());
				messageCount += 1;

				if (includeEntries) {
					entries.push({
						channel_id: channelId,
						message_id: messageId,
					});
				}
			}

			channelCount += channelsInChunk.size;

			lastMessageId = messageRefs[messageRefs.length - 1].messageId;

			if (messageRefs.length < FETCH_CHUNK_SIZE) {
				break;
			}
		}

		return {
			entries,
			channelCount,
			messageCount,
		};
	}
}
