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
import type {MessageChannelAuthService} from '@fluxer/api/src/channel/services/message/MessageChannelAuthService';
import {MessageDeleteService} from '@fluxer/api/src/channel/services/message/MessageDeleteService';
import type {MessageDispatchService} from '@fluxer/api/src/channel/services/message/MessageDispatchService';
import {MessageEditService} from '@fluxer/api/src/channel/services/message/MessageEditService';
import type {MessageMentionService} from '@fluxer/api/src/channel/services/message/MessageMentionService';
import {MessageOperationsHelpers} from '@fluxer/api/src/channel/services/message/MessageOperationsHelpers';
import type {MessagePersistenceService} from '@fluxer/api/src/channel/services/message/MessagePersistenceService';
import type {MessageProcessingService} from '@fluxer/api/src/channel/services/message/MessageProcessingService';
import type {MessageSearchService} from '@fluxer/api/src/channel/services/message/MessageSearchService';
import {MessageSendService} from '@fluxer/api/src/channel/services/message/MessageSendService';
import type {MessageValidationService} from '@fluxer/api/src/channel/services/message/MessageValidationService';
import type {IFavoriteMemeRepository} from '@fluxer/api/src/favorite_meme/IFavoriteMemeRepository';
import type {GuildAuditLogService} from '@fluxer/api/src/guild/GuildAuditLogService';
import type {IPurgeQueue} from '@fluxer/api/src/infrastructure/CloudflarePurgeQueue';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Message} from '@fluxer/api/src/models/Message';
import type {User} from '@fluxer/api/src/models/User';
import type {Webhook} from '@fluxer/api/src/models/Webhook';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';

export class MessageOperationsService {
	private readonly sendService: MessageSendService;
	private readonly editService: MessageEditService;
	private readonly deleteService: MessageDeleteService;
	private readonly operationsHelpers: MessageOperationsHelpers;

	constructor(
		channelRepository: IChannelRepositoryAggregate,
		userRepository: IUserRepository,
		cacheService: ICacheService,
		storageService: IStorageService,
		gatewayService: IGatewayService,
		snowflakeService: SnowflakeService,
		rateLimitService: IRateLimitService,
		purgeQueue: IPurgeQueue,
		favoriteMemeRepository: IFavoriteMemeRepository,
		validationService: MessageValidationService,
		mentionService: MessageMentionService,
		searchService: MessageSearchService,
		persistenceService: MessagePersistenceService,
		channelAuthService: MessageChannelAuthService,
		processingService: MessageProcessingService,
		guildAuditLogService: GuildAuditLogService,
		dispatchService: MessageDispatchService,
		limitConfigService: LimitConfigService,
	) {
		this.operationsHelpers = new MessageOperationsHelpers({
			channelRepository,
			cacheService,
			storageService,
			snowflakeService,
			favoriteMemeRepository,
		});

		this.sendService = new MessageSendService({
			channelRepository,
			storageService,
			gatewayService,
			snowflakeService,
			rateLimitService,
			favoriteMemeRepository,
			validationService,
			mentionService,
			searchService,
			persistenceService,
			channelAuthService,
			processingService,
			dispatchService,
			embedAttachmentResolver: persistenceService.getEmbedAttachmentResolver(),
			operationsHelpers: this.operationsHelpers,
			limitConfigService,
		});

		this.editService = new MessageEditService({
			channelRepository,
			userRepository,
			validationService,
			persistenceService,
			channelAuthService,
			processingService,
			dispatchService,
			searchService,
			embedAttachmentResolver: persistenceService.getEmbedAttachmentResolver(),
			mentionService,
		});

		this.deleteService = new MessageDeleteService({
			channelRepository,
			storageService,
			purgeQueue,
			validationService,
			channelAuthService,
			dispatchService,
			searchService,
			guildAuditLogService,
		});
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
		return this.sendService.sendMessage({user, channelId, data, requestCache});
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
		return this.sendService.sendWebhookMessage({webhook, data, username, avatar, requestCache});
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
		return this.sendService.validateMessageCanBeSent({user, channelId, data});
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
		return this.editService.editMessage({userId, channelId, messageId, data, requestCache});
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
		return this.deleteService.deleteMessage({userId, channelId, messageId, requestCache});
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
		return this.deleteService.bulkDeleteMessages({userId, channelId, messageIds});
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
		return this.deleteService.deleteUserMessagesInGuild({userId, guildId, days});
	}
}
