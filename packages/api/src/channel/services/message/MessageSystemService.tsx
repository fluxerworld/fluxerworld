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

import type {GuildID, UserID} from '@fluxer/api/src/BrandedTypes';
import {createMessageID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepositoryAggregate} from '@fluxer/api/src/channel/repositories/IChannelRepositoryAggregate';
import type {MessagePersistenceService} from '@fluxer/api/src/channel/services/message/MessagePersistenceService';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {SnowflakeService} from '@fluxer/api/src/infrastructure/SnowflakeService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Channel} from '@fluxer/api/src/models/Channel';
import type {Message} from '@fluxer/api/src/models/Message';
import {MessageTypes} from '@fluxer/constants/src/ChannelConstants';

export class MessageSystemService {
	constructor(
		private channelRepository: IChannelRepositoryAggregate,
		private guildRepository: IGuildRepositoryAggregate,
		private snowflakeService: SnowflakeService,
		private persistenceService: MessagePersistenceService,
	) {}

	async sendJoinSystemMessage({
		guildId,
		userId,
		requestCache,
		dispatchMessageCreate,
	}: {
		guildId: GuildID;
		userId: UserID;
		requestCache: RequestCache;
		dispatchMessageCreate: (params: {channel: Channel; message: Message; requestCache: RequestCache}) => Promise<void>;
	}): Promise<void> {
		const guild = await this.guildRepository.findUnique(guildId);
		if (!guild?.systemChannelId) return;

		const systemChannel = await this.channelRepository.channelData.findUnique(guild.systemChannelId);
		if (!systemChannel) return;

		const messageId = createMessageID(await this.snowflakeService.generate());
		const message = await this.persistenceService.createMessage({
			messageId,
			channelId: systemChannel.id,
			userId,
			type: MessageTypes.USER_JOIN,
			content: null,
			flags: 0,
			guildId,
			channel: systemChannel,
		});

		await dispatchMessageCreate({channel: systemChannel, message, requestCache});
	}
}
