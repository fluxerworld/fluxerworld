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

import {createChannelID, createGuildID, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import type {ChannelService} from '@fluxer/api/src/channel/services/ChannelService';
import type {GuildService} from '@fluxer/api/src/guild/services/GuildService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import {GlobalSearchService} from '@fluxer/api/src/search/GlobalSearchService';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import type {GlobalSearchMessagesRequest} from '@fluxer/schema/src/domains/message/MessageRequestSchemas';
import type {MessageSearchResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';

export class SearchService {
	private readonly globalSearch: GlobalSearchService;
	private readonly channelService: ChannelService;
	private readonly guildService: GuildService;

	constructor(params: {
		channelRepository: IChannelRepository;
		channelService: ChannelService;
		guildService: GuildService;
		userRepository: IUserRepository;
		userCacheService: UserCacheService;
		mediaService: IMediaService;
		workerService: IWorkerService;
	}) {
		this.channelService = params.channelService;
		this.guildService = params.guildService;
		this.globalSearch = new GlobalSearchService(
			params.channelRepository,
			params.channelService,
			params.guildService,
			params.userRepository,
			params.userCacheService,
			params.mediaService,
			params.workerService,
		);
	}

	async searchMessages(params: {
		userId: UserID;
		requestCache: RequestCache;
		data: GlobalSearchMessagesRequest;
	}): Promise<MessageSearchResponse> {
		const startTime = Date.now();
		const {userId, requestCache, data} = params;
		const {channel_id, channel_ids, context_channel_id, context_guild_id, ...searchParams} = data;
		const contextChannelId = context_channel_id ? createChannelID(context_channel_id) : null;
		const contextGuildId = context_guild_id ? createGuildID(context_guild_id) : null;
		const channelIds = channel_ids?.map((id) => createChannelID(id)) ?? [];
		const scope = searchParams.scope ?? 'current';

		let result: MessageSearchResponse;
		switch (scope) {
			case 'all_guilds':
				result = await this.guildService.searchAllGuilds({
					userId,
					channelIds,
					searchParams,
					requestCache,
				});
				break;
			case 'all_dms':
			case 'open_dms':
				result = await this.globalSearch.searchAcrossDms({
					userId,
					scope,
					searchParams,
					requestCache,
					includeChannelId: contextChannelId,
					requestedChannelIds: channelIds,
				});
				break;
			case 'all':
				result = await this.globalSearch.searchAcrossGuildsAndDms({
					userId,
					dmScope: 'all_dms',
					searchParams,
					requestCache,
					includeChannelId: contextChannelId,
					requestedChannelIds: channelIds,
				});
				break;
			case 'open_dms_and_all_guilds':
				result = await this.globalSearch.searchAcrossGuildsAndDms({
					userId,
					dmScope: 'open_dms',
					searchParams,
					requestCache,
					includeChannelId: contextChannelId,
					requestedChannelIds: channelIds,
				});
				break;
			default:
				if (contextGuildId) {
					result = await this.guildService.searchMessages({
						userId,
						guildId: contextGuildId,
						channelIds,
						searchParams,
						requestCache,
					});
				} else if (contextChannelId) {
					result = await this.channelService.searchMessages({
						userId,
						channelId: contextChannelId,
						searchParams,
						requestCache,
					});
				} else {
					throw InputValidationError.fromCode('context', ValidationErrorCodes.CONTEXT_CHANNEL_OR_GUILD_ID_REQUIRED);
				}
				break;
		}

		const durationMs = Date.now() - startTime;
		const resultCount = 'messages' in result ? result.messages.length : 0;

		getMetricsService().counter({
			name: 'fluxer.search.messages',
			dimensions: {
				result_count: resultCount.toString(),
			},
		});

		getMetricsService().histogram({
			name: 'fluxer.search.latency',
			valueMs: durationMs,
			dimensions: {
				search_type: scope,
			},
		});

		return result;
	}
}
