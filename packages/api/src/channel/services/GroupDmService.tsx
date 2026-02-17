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

import type {ChannelID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import type {GroupDmUpdateService} from '@fluxer/api/src/channel/services/channel_data/GroupDmUpdateService';
import {GroupDmOperationsService} from '@fluxer/api/src/channel/services/group_dm/GroupDmOperationsService';
import type {MessagePersistenceService} from '@fluxer/api/src/channel/services/message/MessagePersistenceService';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';

export class GroupDmService {
	private operationsService: GroupDmOperationsService;

	constructor(
		channelRepository: IChannelRepository,
		userRepository: IUserRepository,
		guildRepository: IGuildRepositoryAggregate,
		userCacheService: UserCacheService,
		gatewayService: IGatewayService,
		mediaService: IMediaService,
		snowflakeService: SnowflakeService,
		groupDmUpdateService: GroupDmUpdateService,
		messagePersistenceService: MessagePersistenceService,
		limitConfigService: LimitConfigService,
	) {
		this.operationsService = new GroupDmOperationsService(
			channelRepository,
			userRepository,
			guildRepository,
			userCacheService,
			gatewayService,
			mediaService,
			snowflakeService,
			groupDmUpdateService,
			messagePersistenceService,
			limitConfigService,
		);
	}

	async addRecipientToChannel(params: {
		userId: UserID;
		channelId: ChannelID;
		recipientId: UserID;
		requestCache: RequestCache;
	}): Promise<Channel> {
		return this.operationsService.addRecipientToChannel(params);
	}

	async addRecipientViaInvite(params: {
		channelId: ChannelID;
		recipientId: UserID;
		inviterId?: UserID | null;
		requestCache: RequestCache;
	}): Promise<Channel> {
		return this.operationsService.addRecipientViaInvite(params);
	}

	async removeRecipientFromChannel(params: {
		userId: UserID;
		channelId: ChannelID;
		recipientId: UserID;
		requestCache: RequestCache;
		silent?: boolean;
	}): Promise<void> {
		return this.operationsService.removeRecipientFromChannel(params);
	}

	async updateGroupDmChannel(params: {
		userId: UserID;
		channelId: ChannelID;
		name?: string;
		icon?: string | null;
		ownerId?: UserID;
		nicks?: Record<string, string | null> | null;
		requestCache: RequestCache;
	}): Promise<Channel> {
		return this.operationsService.updateGroupDmChannel(params);
	}
}
