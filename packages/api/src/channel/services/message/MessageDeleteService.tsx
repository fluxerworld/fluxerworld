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

import type {ChannelID, GuildID, MessageID, UserID} from '@fluxer/api/src/BrandedTypes';
import {createMessageID, createUserID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepositoryAggregate} from '@fluxer/api/src/channel/repositories/IChannelRepositoryAggregate';
import type {MessageChannelAuthService} from '@fluxer/api/src/channel/services/message/MessageChannelAuthService';
import type {MessageDispatchService} from '@fluxer/api/src/channel/services/message/MessageDispatchService';
import {isOperationDisabled, purgeMessageAttachments} from '@fluxer/api/src/channel/services/message/MessageHelpers';
import type {MessageSearchService} from '@fluxer/api/src/channel/services/message/MessageSearchService';
import type {MessageValidationService} from '@fluxer/api/src/channel/services/message/MessageValidationService';
import type {GuildAuditLogService} from '@fluxer/api/src/guild/GuildAuditLogService';
import type {IPurgeQueue} from '@fluxer/api/src/infrastructure/CloudflarePurgeQueue';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {Message} from '@fluxer/api/src/models/Message';
import {withBusinessSpan} from '@fluxer/api/src/telemetry/BusinessSpans';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {GuildOperations} from '@fluxer/constants/src/GuildConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {UnknownMessageError} from '@fluxer/errors/src/domains/channel/UnknownMessageError';
import {CannotExecuteOnDmError} from '@fluxer/errors/src/domains/core/CannotExecuteOnDmError';
import {FeatureTemporarilyDisabledError} from '@fluxer/errors/src/domains/core/FeatureTemporarilyDisabledError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {createSnowflakeFromTimestamp} from '@fluxer/snowflake/src/Snowflake';
import {ms} from 'itty-time';

interface MessageDeleteServiceDeps {
	channelRepository: IChannelRepositoryAggregate;
	storageService: IStorageService;
	purgeQueue: IPurgeQueue;
	validationService: MessageValidationService;
	channelAuthService: MessageChannelAuthService;
	dispatchService: MessageDispatchService;
	searchService: MessageSearchService;
	guildAuditLogService: GuildAuditLogService;
}

export class MessageDeleteService {
	private readonly guildAuditLogService: GuildAuditLogService;

	constructor(private readonly deps: MessageDeleteServiceDeps) {
		this.guildAuditLogService = deps.guildAuditLogService;
	}

	async deleteMessage({
		userId,
		channelId,
		messageId,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		requestCache: RequestCache;
	}): Promise<void> {
		try {
			const {channel, guild, hasPermission} = await this.deps.channelAuthService.getChannelAuthenticated({
				userId,
				channelId,
			});

			if (isOperationDisabled(guild, GuildOperations.SEND_MESSAGE)) {
				throw new FeatureTemporarilyDisabledError();
			}

			const message = await this.deps.channelRepository.messages.getMessage(channelId, messageId);
			if (!message) throw new UnknownMessageError();

			const canDelete = await this.deps.validationService.canDeleteMessage({message, userId, guild, hasPermission});
			if (!canDelete) throw new MissingPermissionsError();

			if (message.pinnedTimestamp) {
				await this.deps.channelRepository.messageInteractions.removeChannelPin(channelId, messageId);
			}

			await purgeMessageAttachments(message, this.deps.storageService, this.deps.purgeQueue);
			await this.deps.channelRepository.messages.deleteMessage(
				channelId,
				messageId,
				message.authorId || createUserID(0n),
				message.pinnedTimestamp || undefined,
			);

			await this.deps.dispatchService.dispatchMessageDelete({channel, messageId, message});

			if (message.pinnedTimestamp) {
				await this.deps.dispatchService.dispatchEvent({
					channel,
					event: 'CHANNEL_PINS_UPDATE',
					data: {
						channel_id: channel.id.toString(),
						last_pin_timestamp: channel.lastPinTimestamp?.toISOString() ?? null,
					},
				});
			}

			if (channel.guildId) {
				await this.guildAuditLogService
					.createBuilder(channel.guildId, userId)
					.withAction(AuditLogActionType.MESSAGE_DELETE, message.id.toString())
					.withMetadata({channel_id: channel.id.toString()})
					.withReason(null)
					.commit();
			}

			if (channel.indexedAt) {
				void this.deps.searchService.deleteMessageIndex(messageId);
			}

			getMetricsService().counter({name: 'message.delete'});
		} catch (error) {
			getMetricsService().counter({name: 'message.delete.error'});
			throw error;
		}
	}

	async bulkDeleteMessages({
		userId,
		channelId,
		messageIds,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageIds: Array<MessageID>;
	}): Promise<void> {
		return await withBusinessSpan(
			'fluxer.message.bulk_delete',
			'fluxer.messages.bulk_deleted',
			{
				channel_id: channelId.toString(),
				message_count: messageIds.length.toString(),
			},
			() => this.performBulkDelete({userId, channelId, messageIds}),
		);
	}

	private async performBulkDelete({
		userId,
		channelId,
		messageIds,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageIds: Array<MessageID>;
	}): Promise<void> {
		if (messageIds.length === 0) {
			throw InputValidationError.fromCode('message_ids', ValidationErrorCodes.MESSAGE_IDS_CANNOT_BE_EMPTY);
		}

		if (messageIds.length > 100) {
			throw InputValidationError.fromCode('message_ids', ValidationErrorCodes.CANNOT_DELETE_MORE_THAN_100_MESSAGES);
		}

		const {channel, guild, checkPermission} = await this.deps.channelAuthService.getChannelAuthenticated({
			userId,
			channelId,
		});

		if (!guild) throw new CannotExecuteOnDmError();
		await checkPermission(Permissions.MANAGE_MESSAGES);

		const messages = await Promise.all(
			messageIds.map((id) => this.deps.channelRepository.messages.getMessage(channelId, id)),
		);
		const existingMessages = messages.filter((m: Message | null) => m && m.channelId === channelId) as Array<Message>;

		if (existingMessages.length === 0) return;

		await Promise.all(
			existingMessages.map((message) =>
				purgeMessageAttachments(message, this.deps.storageService, this.deps.purgeQueue),
			),
		);
		await this.deps.channelRepository.messages.bulkDeleteMessages(channelId, messageIds);

		await this.deps.dispatchService.dispatchMessageDeleteBulk({channel, messageIds});

		if (channel.guildId && existingMessages.length > 0) {
			await this.guildAuditLogService
				.createBuilder(channel.guildId, userId)
				.withAction(AuditLogActionType.MESSAGE_BULK_DELETE, null)
				.withMetadata({
					channel_id: channel.id.toString(),
					count: existingMessages.length.toString(),
				})
				.withReason(null)
				.commit();
		}
	}

	async deleteUserMessagesInGuild({
		userId,
		guildId,
		days,
	}: {
		userId: UserID;
		guildId: GuildID;
		days: number;
	}): Promise<void> {
		const channels = await this.deps.channelRepository.channelData.listGuildChannels(guildId);

		const cutoffTimestamp = Date.now() - days * ms('1 day');
		const afterSnowflake = createMessageID(createSnowflakeFromTimestamp(cutoffTimestamp));

		await Promise.all(
			channels.map(async (channel: Channel) => {
				const batchSize = 100;
				let beforeMessageId: MessageID | undefined;
				let hasMore = true;

				while (hasMore) {
					const messages = await this.deps.channelRepository.messages.listMessages(
						channel.id,
						beforeMessageId,
						batchSize,
						afterSnowflake,
					);

					if (messages.length === 0) {
						hasMore = false;
						break;
					}

					const userMessages = messages.filter((msg: Message) => msg.authorId === userId);

					if (userMessages.length > 0) {
						const messageIds = userMessages.map((msg: Message) => msg.id);

						await Promise.all(
							userMessages.map((message: Message) =>
								purgeMessageAttachments(message, this.deps.storageService, this.deps.purgeQueue),
							),
						);

						await this.deps.channelRepository.messages.bulkDeleteMessages(channel.id, messageIds);

						await this.deps.dispatchService.dispatchMessageDeleteBulk({channel, messageIds});
					}

					if (messages.length < batchSize) {
						hasMore = false;
					} else {
						beforeMessageId = messages[messages.length - 1].id;
					}
				}
			}),
		);
	}
}
