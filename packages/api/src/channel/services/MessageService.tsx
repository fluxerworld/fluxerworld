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
import type {MessageRequest, MessageUpdateRequest} from '@fluxer/api/src/channel/MessageTypes';
import type {IChannelRepositoryAggregate} from '@fluxer/api/src/channel/repositories/IChannelRepositoryAggregate';
import {MessageAnonymizationService} from '@fluxer/api/src/channel/services/message/MessageAnonymizationService';
import {MessageChannelAuthService} from '@fluxer/api/src/channel/services/message/MessageChannelAuthService';
import {MessageDispatchService} from '@fluxer/api/src/channel/services/message/MessageDispatchService';
import {MessageMentionService} from '@fluxer/api/src/channel/services/message/MessageMentionService';
import {MessageOperationsService} from '@fluxer/api/src/channel/services/message/MessageOperationsService';
import type {MessagePersistenceService} from '@fluxer/api/src/channel/services/message/MessagePersistenceService';
import {MessageProcessingService} from '@fluxer/api/src/channel/services/message/MessageProcessingService';
import {MessageRetrievalService} from '@fluxer/api/src/channel/services/message/MessageRetrievalService';
import {MessageSearchService} from '@fluxer/api/src/channel/services/message/MessageSearchService';
import {MessageSystemService} from '@fluxer/api/src/channel/services/message/MessageSystemService';
import {MessageValidationService} from '@fluxer/api/src/channel/services/message/MessageValidationService';
import type {IFavoriteMemeRepository} from '@fluxer/api/src/favorite_meme/IFavoriteMemeRepository';
import type {GuildAuditLogService} from '@fluxer/api/src/guild/GuildAuditLogService';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {IPurgeQueue} from '@fluxer/api/src/infrastructure/CloudflarePurgeQueue';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Message} from '@fluxer/api/src/models/Message';
import type {User} from '@fluxer/api/src/models/User';
import type {Webhook} from '@fluxer/api/src/models/Webhook';
import type {ReadStateService} from '@fluxer/api/src/read_state/ReadStateService';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import type {MessageSearchRequest} from '@fluxer/schema/src/domains/message/MessageRequestSchemas';
import type {MessageSearchResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';

export class MessageService {
	private validationService: MessageValidationService;
	private mentionService: MessageMentionService;
	private searchService: MessageSearchService;
	private persistenceService: MessagePersistenceService;
	private channelAuthService: MessageChannelAuthService;
	private dispatchService: MessageDispatchService;
	private processingService: MessageProcessingService;
	private systemService: MessageSystemService;
	private operationsService: MessageOperationsService;
	private retrievalService: MessageRetrievalService;
	private anonymizationService: MessageAnonymizationService;

	constructor(
		channelRepository: IChannelRepositoryAggregate,
		userRepository: IUserRepository,
		guildRepository: IGuildRepositoryAggregate,
		userCacheService: UserCacheService,
		readStateService: ReadStateService,
		cacheService: ICacheService,
		storageService: IStorageService,
		gatewayService: IGatewayService,
		mediaService: IMediaService,
		workerService: IWorkerService,
		snowflakeService: SnowflakeService,
		rateLimitService: IRateLimitService,
		purgeQueue: IPurgeQueue,
		favoriteMemeRepository: IFavoriteMemeRepository,
		guildAuditLogService: GuildAuditLogService,
		persistenceService: MessagePersistenceService,
		limitConfigService: LimitConfigService,
	) {
		this.validationService = new MessageValidationService(cacheService, limitConfigService);
		this.mentionService = new MessageMentionService(userRepository, guildRepository, workerService);
		this.searchService = new MessageSearchService(userRepository, workerService);
		this.persistenceService = persistenceService;
		this.channelAuthService = new MessageChannelAuthService(
			channelRepository,
			userRepository,
			guildRepository,
			gatewayService,
		);
		this.dispatchService = new MessageDispatchService(
			gatewayService,
			userCacheService,
			mediaService,
			channelRepository,
		);
		this.processingService = new MessageProcessingService(
			channelRepository,
			userRepository,
			userCacheService,
			gatewayService,
			readStateService,
			this.mentionService,
		);
		this.systemService = new MessageSystemService(
			channelRepository,
			guildRepository,
			snowflakeService,
			this.persistenceService,
		);
		this.operationsService = new MessageOperationsService(
			channelRepository,
			userRepository,
			cacheService,
			storageService,
			gatewayService,
			snowflakeService,
			rateLimitService,
			purgeQueue,
			favoriteMemeRepository,
			this.validationService,
			this.mentionService,
			this.searchService,
			this.persistenceService,
			this.channelAuthService,
			this.processingService,
			guildAuditLogService,
			this.dispatchService,
			limitConfigService,
		);
		this.retrievalService = new MessageRetrievalService(
			channelRepository,
			userCacheService,
			mediaService,
			this.channelAuthService,
			this.processingService,
			this.searchService,
			userRepository,
		);
		this.anonymizationService = new MessageAnonymizationService(channelRepository);
	}

	async sendMessage({
		user,
		channelId,
		data,
		requestCache,
	}: {
		user: User;
		channelId: ChannelID;
		data: MessageRequest;
		requestCache: RequestCache;
	}): Promise<Message> {
		return this.operationsService.sendMessage({user, channelId, data, requestCache});
	}

	async sendWebhookMessage({
		webhook,
		data,
		username,
		avatar,
		requestCache,
	}: {
		webhook: Webhook;
		data: MessageRequest;
		username?: string | null;
		avatar?: string | null;
		requestCache: RequestCache;
	}): Promise<Message> {
		return this.operationsService.sendWebhookMessage({webhook, data, username, avatar, requestCache});
	}

	async validateMessageCanBeSent({
		user,
		channelId,
		data,
	}: {
		user: User;
		channelId: ChannelID;
		data: MessageRequest;
	}): Promise<void> {
		return this.operationsService.validateMessageCanBeSent({user, channelId, data});
	}

	async editMessage({
		userId,
		channelId,
		messageId,
		data,
		requestCache,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
		data: MessageUpdateRequest;
		requestCache: RequestCache;
	}): Promise<Message> {
		return this.operationsService.editMessage({userId, channelId, messageId, data, requestCache});
	}

	async deleteMessage({
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
		return this.operationsService.deleteMessage({userId, channelId, messageId, requestCache});
	}

	async getMessage({
		userId,
		channelId,
		messageId,
	}: {
		userId: UserID;
		channelId: ChannelID;
		messageId: MessageID;
	}): Promise<Message> {
		return this.retrievalService.getMessage({userId, channelId, messageId});
	}

	async getMessages({
		userId,
		channelId,
		limit,
		before,
		after,
		around,
	}: {
		userId: UserID;
		channelId: ChannelID;
		limit: number;
		before?: MessageID;
		after?: MessageID;
		around?: MessageID;
	}): Promise<Array<Message>> {
		return this.retrievalService.getMessages({userId, channelId, limit, before, after, around});
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
		return this.operationsService.bulkDeleteMessages({userId, channelId, messageIds});
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
		return this.operationsService.deleteUserMessagesInGuild({userId, guildId, days});
	}

	async sendJoinSystemMessage({
		guildId,
		userId,
		requestCache,
	}: {
		guildId: GuildID;
		userId: UserID;
		requestCache: RequestCache;
	}): Promise<void> {
		return this.systemService.sendJoinSystemMessage({
			guildId,
			userId,
			requestCache,
			dispatchMessageCreate: this.dispatchService.dispatchMessageCreate.bind(this.dispatchService),
		});
	}

	async searchMessages({
		userId,
		channelId,
		searchParams,
		requestCache,
	}: {
		userId: UserID;
		channelId: ChannelID;
		searchParams: MessageSearchRequest;
		requestCache: RequestCache;
	}): Promise<MessageSearchResponse> {
		return this.retrievalService.searchMessages({userId, channelId, searchParams, requestCache});
	}

	async anonymizeMessagesByAuthor(originalAuthorId: UserID, newAuthorId: UserID): Promise<void> {
		return this.anonymizationService.anonymizeMessagesByAuthor(originalAuthorId, newAuthorId);
	}

	getMessagePersistenceService(): MessagePersistenceService {
		return this.persistenceService;
	}
}
