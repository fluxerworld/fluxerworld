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

import type {MessageID, UserID} from '@fluxer/api/src/BrandedTypes';
import {createMessageID} from '@fluxer/api/src/BrandedTypes';
import {mapMessageToResponse} from '@fluxer/api/src/channel/MessageMappers';
import type {IChannelRepositoryAggregate} from '@fluxer/api/src/channel/repositories/IChannelRepositoryAggregate';
import type {AuthenticatedChannel} from '@fluxer/api/src/channel/services/AuthenticatedChannel';
import {MessageInteractionBase} from '@fluxer/api/src/channel/services/interaction/MessageInteractionBase';
import type {MessagePersistenceService} from '@fluxer/api/src/channel/services/message/MessagePersistenceService';
import type {GuildAuditLogService} from '@fluxer/api/src/guild/GuildAuditLogService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {Message} from '@fluxer/api/src/models/Message';
import {withBusinessSpan} from '@fluxer/api/src/telemetry/BusinessSpans';
import {AuditLogActionType} from '@fluxer/constants/src/AuditLogActionType';
import {MessageTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {GuildOperations} from '@fluxer/constants/src/GuildConstants';
import {CannotEditSystemMessageError} from '@fluxer/errors/src/domains/channel/CannotEditSystemMessageError';
import {UnknownMessageError} from '@fluxer/errors/src/domains/channel/UnknownMessageError';
import {FeatureTemporarilyDisabledError} from '@fluxer/errors/src/domains/core/FeatureTemporarilyDisabledError';
import type {ChannelPinResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {snowflakeToDate} from '@fluxer/snowflake/src/Snowflake';

export class MessagePinService extends MessageInteractionBase {
	constructor(
		gatewayService: IGatewayService,
		private channelRepository: IChannelRepositoryAggregate,
		private userCacheService: UserCacheService,
		private mediaService: IMediaService,
		private snowflakeService: SnowflakeService,
		private messagePersistenceService: MessagePersistenceService,
		private readonly guildAuditLogService: GuildAuditLogService,
	) {
		super(gatewayService);
	}

	private async assertMessageHistoryAccess({
		authChannel,
		messageId,
	}: {
		authChannel: AuthenticatedChannel;
		messageId: MessageID;
	}): Promise<void> {
		if (!authChannel.guild) {
			return;
		}

		if (await authChannel.hasPermission(Permissions.READ_MESSAGE_HISTORY)) {
			return;
		}

		const cutoff = authChannel.guild.message_history_cutoff;
		if (!cutoff || snowflakeToDate(messageId).getTime() < new Date(cutoff).getTime()) {
			throw new UnknownMessageError();
		}
	}

	async getChannelPins({
		authChannel,
		requestCache,
		beforeTimestamp,
		limit,
	}: {
		authChannel: AuthenticatedChannel;
		requestCache: RequestCache;
		beforeTimestamp?: Date;
		limit?: number;
	}): Promise<{items: Array<ChannelPinResponse>; has_more: boolean}> {
		const {channel} = authChannel;
		this.ensureTextChannel(channel);

		const hasReadHistory = !authChannel.guild || (await authChannel.hasPermission(Permissions.READ_MESSAGE_HISTORY));

		if (!hasReadHistory) {
			const cutoff = authChannel.guild?.message_history_cutoff;
			if (!cutoff) {
				return {items: [], has_more: false};
			}
		}

		const pageSize = Math.min(limit ?? 50, 50);
		const effectiveBefore = beforeTimestamp ?? new Date();
		const messages = await this.channelRepository.messageInteractions.listChannelPins(
			channel.id,
			effectiveBefore,
			pageSize + 1,
		);
		const sorted = messages.sort((a, b) => (b.pinnedTimestamp?.getTime() ?? 0) - (a.pinnedTimestamp?.getTime() ?? 0));

		let filtered = sorted;
		if (!hasReadHistory) {
			const cutoff = authChannel.guild!.message_history_cutoff!;
			const cutoffTimestamp = new Date(cutoff).getTime();
			filtered = sorted.filter((message) => snowflakeToDate(message.id).getTime() >= cutoffTimestamp);
		}

		const hasMore = filtered.length > pageSize;
		const trimmed = hasMore ? filtered.slice(0, pageSize) : filtered;

		const items = await Promise.all(
			trimmed.map(async (message: Message) => ({
				message: await mapMessageToResponse({
					message,
					userCacheService: this.userCacheService,
					requestCache,
					mediaService: this.mediaService,
				}),
				pinned_at: message.pinnedTimestamp!.toISOString(),
			})),
		);

		return {
			items,
			has_more: hasMore,
		};
	}

	async pinMessage({
		authChannel,
		messageId,
		userId,
		requestCache,
	}: {
		authChannel: AuthenticatedChannel;
		messageId: MessageID;
		userId: UserID;
		requestCache: RequestCache;
	}): Promise<void> {
		return await withBusinessSpan(
			'fluxer.message.pin',
			'fluxer.messages.pinned',
			{
				channel_id: authChannel.channel.id.toString(),
				message_id: messageId.toString(),
				channel_type: authChannel.channel.type.toString(),
			},
			() => this.performPin({authChannel, messageId, userId, requestCache}),
		);
	}

	private async performPin({
		authChannel,
		messageId,
		userId,
		requestCache,
	}: {
		authChannel: AuthenticatedChannel;
		messageId: MessageID;
		userId: UserID;
		requestCache: RequestCache;
	}): Promise<void> {
		const {channel, guild, checkPermission} = authChannel;

		if (guild) {
			await checkPermission(Permissions.PIN_MESSAGES);

			if (this.isOperationDisabled(guild, GuildOperations.SEND_MESSAGE)) {
				throw new FeatureTemporarilyDisabledError();
			}
		}

		this.ensureTextChannel(channel);
		await this.assertMessageHistoryAccess({authChannel, messageId});

		const message = await this.channelRepository.messages.getMessage(channel.id, messageId);
		if (!message) throw new UnknownMessageError();

		this.validateMessagePinnable(message);

		if (message.pinnedTimestamp) return;

		const now = new Date();
		const updatedMessageData = {...message.toRow(), pinned_timestamp: now};
		const updatedMessage = await this.channelRepository.messages.upsertMessage(updatedMessageData, message.toRow());

		await this.channelRepository.messageInteractions.addChannelPin(channel.id, messageId, now);

		const updatedChannelData = {...channel.toRow(), last_pin_timestamp: now};
		const updatedChannel = await this.channelRepository.channelData.upsert(updatedChannelData);

		await this.dispatchChannelPinsUpdate(updatedChannel);
		await this.sendPinSystemMessage({channel, message, userId, requestCache});

		await this.dispatchMessageUpdate({channel, message: updatedMessage, requestCache});

		if (channel.guildId) {
			await this.guildAuditLogService
				.createBuilder(channel.guildId, userId)
				.withAction(AuditLogActionType.MESSAGE_PIN, messageId.toString())
				.withMetadata({
					channel_id: channel.id.toString(),
					message_id: messageId.toString(),
				})
				.withReason(null)
				.commit();
		}
	}

	async unpinMessage({
		authChannel,
		messageId,
		userId,
		requestCache,
	}: {
		authChannel: AuthenticatedChannel;
		messageId: MessageID;
		userId: UserID;
		requestCache: RequestCache;
	}): Promise<void> {
		return await withBusinessSpan(
			'fluxer.message.unpin',
			'fluxer.messages.unpinned',
			{
				channel_id: authChannel.channel.id.toString(),
				message_id: messageId.toString(),
				channel_type: authChannel.channel.type.toString(),
			},
			() => this.performUnpin({authChannel, messageId, userId, requestCache}),
		);
	}

	private async performUnpin({
		authChannel,
		messageId,
		userId,
		requestCache,
	}: {
		authChannel: AuthenticatedChannel;
		messageId: MessageID;
		userId: UserID;
		requestCache: RequestCache;
	}): Promise<void> {
		const {channel, guild, checkPermission} = authChannel;

		if (guild) {
			await checkPermission(Permissions.PIN_MESSAGES);

			if (this.isOperationDisabled(guild, GuildOperations.SEND_MESSAGE)) {
				throw new FeatureTemporarilyDisabledError();
			}
		}

		this.ensureTextChannel(channel);
		await this.assertMessageHistoryAccess({authChannel, messageId});

		const message = await this.channelRepository.messages.getMessage(channel.id, messageId);
		if (!message) throw new UnknownMessageError();

		this.validateMessagePinnable(message);

		if (!message.pinnedTimestamp) return;

		const updatedMessageData = {...message.toRow(), pinned_timestamp: null};
		const updatedMessage = await this.channelRepository.messages.upsertMessage(updatedMessageData, message.toRow());

		await this.channelRepository.messageInteractions.removeChannelPin(channel.id, messageId);

		await this.dispatchChannelPinsUpdate(channel);

		await this.dispatchMessageUpdate({channel, message: updatedMessage, requestCache});

		if (channel.guildId) {
			await this.guildAuditLogService
				.createBuilder(channel.guildId, userId)
				.withAction(AuditLogActionType.MESSAGE_UNPIN, messageId.toString())
				.withMetadata({
					channel_id: channel.id.toString(),
					message_id: messageId.toString(),
				})
				.withReason(null)
				.commit();
		}
	}

	private validateMessagePinnable(message: Message): void {
		const pinnableTypes: ReadonlySet<Message['type']> = new Set([MessageTypes.DEFAULT, MessageTypes.REPLY]);
		if (!pinnableTypes.has(message.type)) {
			throw new CannotEditSystemMessageError();
		}
	}

	private async sendPinSystemMessage({
		channel,
		message,
		userId,
		requestCache,
	}: {
		channel: Channel;
		message: Message;
		userId: UserID;
		requestCache: RequestCache;
	}): Promise<void> {
		const messageId = createMessageID(await this.snowflakeService.generate());
		const systemMessage = await this.messagePersistenceService.createSystemMessage({
			messageId,
			channelId: channel.id,
			userId,
			type: MessageTypes.CHANNEL_PINNED_MESSAGE,
			guildId: channel.guildId,
			messageReference: {
				channel_id: channel.id,
				message_id: message.id,
				guild_id: null,
				type: 0,
			},
		});

		await this.dispatchMessageCreate({channel, message: systemMessage, requestCache});
	}

	private async dispatchChannelPinsUpdate(channel: Channel): Promise<void> {
		await this.dispatchEvent({
			channel,
			event: 'CHANNEL_PINS_UPDATE',
			data: {
				channel_id: channel.id.toString(),
				last_pin_timestamp: channel.lastPinTimestamp?.toISOString() ?? null,
			},
		});
	}

	private async dispatchMessageCreate({
		channel,
		message,
		requestCache,
		currentUserId,
		nonce,
	}: {
		channel: Channel;
		message: Message;
		requestCache: RequestCache;
		currentUserId?: UserID;
		nonce?: string;
	}): Promise<void> {
		const messageResponse = await mapMessageToResponse({
			message,
			currentUserId,
			nonce,
			userCacheService: this.userCacheService,
			requestCache,
			mediaService: this.mediaService,
		});

		await this.dispatchEvent({
			channel,
			event: 'MESSAGE_CREATE',
			data: {...messageResponse, channel_type: channel.type},
		});
	}

	private async dispatchMessageUpdate({
		channel,
		message,
		requestCache,
		currentUserId,
	}: {
		channel: Channel;
		message: Message;
		requestCache: RequestCache;
		currentUserId?: UserID;
	}): Promise<void> {
		const messageResponse = await mapMessageToResponse({
			message,
			currentUserId,
			userCacheService: this.userCacheService,
			requestCache,
			mediaService: this.mediaService,
		});

		await this.dispatchEvent({
			channel,
			event: 'MESSAGE_UPDATE',
			data: messageResponse,
		});
	}
}
