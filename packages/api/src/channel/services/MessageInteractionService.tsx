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

import type {ChannelID, MessageID, UserID} from '@fluxer/api/src/BrandedTypes';
import {channelIdToUserId} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import {mapMessageToResponse} from '@fluxer/api/src/channel/MessageMappers';
import {MessageInteractionAuthService} from '@fluxer/api/src/channel/services/interaction/MessageInteractionAuthService';
import {MessagePinService} from '@fluxer/api/src/channel/services/interaction/MessagePinService';
import {MessageReactionService} from '@fluxer/api/src/channel/services/interaction/MessageReactionService';
import {MessageReadStateService} from '@fluxer/api/src/channel/services/interaction/MessageReadStateService';
import type {MessagePersistenceService} from '@fluxer/api/src/channel/services/message/MessagePersistenceService';
import type {GatewayDispatchEvent} from '@fluxer/api/src/constants/Gateway';
import type {GuildAuditLogService} from '@fluxer/api/src/guild/GuildAuditLogService';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {Message} from '@fluxer/api/src/models/Message';
import type {MessageReaction} from '@fluxer/api/src/models/MessageReaction';
import type {ReadStateService} from '@fluxer/api/src/read_state/ReadStateService';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import type {ChannelPinResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import type {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';

export class MessageInteractionService {
	private authService: MessageInteractionAuthService;
	private readStateService: MessageReadStateService;
	private pinService: MessagePinService;
	private reactionService: MessageReactionService;

	constructor(
		channelRepository: IChannelRepository,
		userRepository: IUserRepository,
		guildRepository: IGuildRepositoryAggregate,
		private userCacheService: UserCacheService,
		readStateService: ReadStateService,
		private gatewayService: IGatewayService,
		private mediaService: IMediaService,
		snowflakeService: SnowflakeService,
		messagePersistenceService: MessagePersistenceService,
		guildAuditLogService: GuildAuditLogService,
		limitConfigService: LimitConfigService,
	) {
		this.authService = new MessageInteractionAuthService(
			channelRepository,
			userRepository,
			guildRepository,
			gatewayService,
		);

		this.readStateService = new MessageReadStateService(gatewayService, readStateService);

		this.pinService = new MessagePinService(
			gatewayService,
			channelRepository,
			userCacheService,
			mediaService,
			snowflakeService,
			messagePersistenceService,
			guildAuditLogService,
		);

		this.reactionService = new MessageReactionService(
			gatewayService,
			channelRepository,
			userRepository,
			guildRepository,
			limitConfigService,
		);
	}

	async startTyping({userId, channelId}: {userId: UserID; channelId: ChannelID}): Promise<void> {
		const authChannel = await this.authService.getChannelAuthenticated({userId, channelId});
		await authChannel.checkPermission(Permissions.SEND_MESSAGES);
		await this.readStateService.startTyping({authChannel, userId});
	}

	async ackMessage({
		userId,
		channelId,
		messageId,
		mentionCount,
		manual,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		mentionCount: number;
		manual?: boolean;
	}): Promise<void> {
		await this.authService.getChannelAuthenticated({userId, channelId});
		await this.readStateService.ackMessage({userId, channelId, messageId, mentionCount, manual});
	}

	async deleteReadState({userId, channelId}: {userId: UserID; channelId: ChannelID}): Promise<void> {
		await this.readStateService.deleteReadState({userId, channelId});
	}

	async ackPins({
		userId,
		channelId,
		timestamp,
	}: {
		userId: UserID;
		channelId: ChannelID;
		timestamp: Date;
	}): Promise<void> {
		await this.authService.getChannelAuthenticated({userId, channelId});
		await this.readStateService.ackPins({userId, channelId, timestamp});
	}

	async getChannelPins({
		userId,
		channelId,
		requestCache,
		beforeTimestamp,
		limit,
	}: {
		userId: UserID;
		channelId: ChannelID;
		requestCache: RequestCache;
		beforeTimestamp?: Date;
		limit?: number;
	}): Promise<{items: Array<ChannelPinResponse>; has_more: boolean}> {
		const authChannel = await this.authService.getChannelAuthenticated({userId, channelId});
		return this.pinService.getChannelPins({authChannel, requestCache, beforeTimestamp, limit});
	}

	async pinMessage({
		userId,
		channelId,
		messageId,
		requestCache,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		requestCache: RequestCache;
	}): Promise<void> {
		const authChannel = await this.authService.getChannelAuthenticated({userId, channelId});
		if (!authChannel.guild && authChannel.channel.type !== ChannelTypes.DM_PERSONAL_NOTES) {
			await this.authService.validateDMSendPermissions({channelId, userId});
		}
		await this.pinService.pinMessage({authChannel, messageId, userId, requestCache});
	}

	async unpinMessage({
		userId,
		channelId,
		messageId,
		requestCache,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		requestCache: RequestCache;
	}): Promise<void> {
		const authChannel = await this.authService.getChannelAuthenticated({userId, channelId});
		if (!authChannel.guild && authChannel.channel.type !== ChannelTypes.DM_PERSONAL_NOTES) {
			await this.authService.validateDMSendPermissions({channelId, userId});
		}
		await this.pinService.unpinMessage({authChannel, messageId, userId, requestCache});
	}

	async getUsersForReaction({
		userId,
		channelId,
		messageId,
		emoji,
		limit,
		after,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		emoji: string;
		limit?: number;
		after?: UserID;
	}): Promise<Array<UserPartialResponse>> {
		const authChannel = await this.authService.getChannelAuthenticated({userId, channelId});
		return this.reactionService.getUsersForReaction({authChannel, messageId, emoji, limit, after, userId});
	}

	async addReaction({
		userId,
		sessionId,
		channelId,
		messageId,
		emoji,
	}: {
		userId: UserID;
		sessionId?: string;
		channelId: ChannelID;
		messageId: MessageID;
		emoji: string;
		requestCache: RequestCache;
	}): Promise<void> {
		const authChannel = await this.authService.getChannelAuthenticated({userId, channelId});
		await this.reactionService.addReaction({authChannel, messageId, emoji, userId, sessionId});
	}

	async removeReaction({
		userId,
		sessionId,
		channelId,
		messageId,
		emoji,
		targetId,
	}: {
		userId: UserID;
		sessionId?: string;
		channelId: ChannelID;
		messageId: MessageID;
		emoji: string;
		targetId: UserID;
		requestCache: RequestCache;
	}): Promise<void> {
		const authChannel = await this.authService.getChannelAuthenticated({userId, channelId});
		await this.reactionService.removeReaction({authChannel, messageId, emoji, targetId, sessionId, actorId: userId});
	}

	async removeOwnReaction({
		userId,
		sessionId,
		channelId,
		messageId,
		emoji,
		requestCache,
	}: {
		userId: UserID;
		sessionId?: string;
		channelId: ChannelID;
		messageId: MessageID;
		emoji: string;
		requestCache: RequestCache;
	}): Promise<void> {
		await this.removeReaction({userId, sessionId, channelId, messageId, emoji, targetId: userId, requestCache});
	}

	async removeAllReactionsForEmoji({
		userId,
		channelId,
		messageId,
		emoji,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		emoji: string;
	}): Promise<void> {
		const authChannel = await this.authService.getChannelAuthenticated({userId, channelId});
		await this.reactionService.removeAllReactionsForEmoji({authChannel, messageId, emoji, actorId: userId});
	}

	async removeAllReactions({
		userId,
		channelId,
		messageId,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
	}): Promise<void> {
		const authChannel = await this.authService.getChannelAuthenticated({userId, channelId});
		await this.reactionService.removeAllReactions({authChannel, messageId, actorId: userId});
	}

	async getMessageReactions({
		userId,
		channelId,
		messageId,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
	}): Promise<Array<MessageReaction>> {
		const authChannel = await this.authService.getChannelAuthenticated({userId, channelId});
		return this.reactionService.getMessageReactions({authChannel, messageId});
	}

	async setHasReaction(channelId: ChannelID, messageId: MessageID, hasReaction: boolean): Promise<void> {
		return this.reactionService.setHasReaction(channelId, messageId, hasReaction);
	}

	async getChannelAuthenticated({userId, channelId}: {userId: UserID; channelId: ChannelID}) {
		return this.authService.getChannelAuthenticated({userId, channelId});
	}

	async dispatchMessageUpdate({
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

	private async dispatchEvent(params: {channel: Channel; event: GatewayDispatchEvent; data: unknown}): Promise<void> {
		const {channel, event, data} = params;

		if (channel.type === ChannelTypes.DM_PERSONAL_NOTES) {
			return this.gatewayService.dispatchPresence({
				userId: channelIdToUserId(channel.id),
				event,
				data,
			});
		}

		if (channel.guildId) {
			return this.gatewayService.dispatchGuild({guildId: channel.guildId, event, data});
		} else {
			for (const recipientId of channel.recipientIds) {
				await this.gatewayService.dispatchPresence({userId: recipientId, event, data});
			}
		}
	}
}
