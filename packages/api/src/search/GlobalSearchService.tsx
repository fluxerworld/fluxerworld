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
import {createChannelID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import type {ChannelService} from '@fluxer/api/src/channel/services/ChannelService';
import {type DmSearchScope, getDmChannelIdsForScope} from '@fluxer/api/src/channel/services/message/DmScopeUtils';
import type {GuildService} from '@fluxer/api/src/guild/services/GuildService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import {getMessageSearchService} from '@fluxer/api/src/SearchFactory';
import {buildMessageSearchFilters} from '@fluxer/api/src/search/BuildMessageSearchFilters';
import {channelNeedsReindexing} from '@fluxer/api/src/search/ChannelIndexingUtils';
import type {IMessageSearchService} from '@fluxer/api/src/search/IMessageSearchService';
import {MessageSearchResponseMapper} from '@fluxer/api/src/search/MessageSearchResponseMapper';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {isUserAdult} from '@fluxer/api/src/utils/AgeUtils';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {GuildNSFWLevel} from '@fluxer/constants/src/GuildConstants';
import {FeatureTemporarilyDisabledError} from '@fluxer/errors/src/domains/core/FeatureTemporarilyDisabledError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import type {MessageSearchRequest} from '@fluxer/schema/src/domains/message/MessageRequestSchemas';
import type {MessageSearchResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';

export class GlobalSearchService {
	private readonly responseMapper: MessageSearchResponseMapper;

	constructor(
		private readonly channelRepository: IChannelRepository,
		private readonly channelService: ChannelService,
		private readonly guildService: GuildService,
		private readonly userRepository: IUserRepository,
		private readonly userCacheService: UserCacheService,
		private readonly mediaService: IMediaService,
		private readonly workerService: IWorkerService,
	) {
		this.responseMapper = new MessageSearchResponseMapper(
			this.channelRepository,
			this.channelService,
			this.userCacheService,
			this.mediaService,
		);
	}

	private getMessageSearchService(): IMessageSearchService {
		const searchService = getMessageSearchService();
		if (!searchService) {
			throw new FeatureTemporarilyDisabledError();
		}
		return searchService;
	}

	async searchAcrossDms(params: {
		userId: UserID;
		scope: DmSearchScope;
		searchParams: MessageSearchRequest;
		requestCache: RequestCache;
		includeChannelId?: ChannelID | null;
		requestedChannelIds?: Array<ChannelID>;
	}): Promise<MessageSearchResponse> {
		const dmChannelIds = await getDmChannelIdsForScope({
			scope: params.scope,
			userId: params.userId,
			userRepository: this.userRepository,
			includeChannelId: params.includeChannelId,
		});

		const finalChannelIds = this.filterRequestedChannelIds(dmChannelIds, params.requestedChannelIds);
		if (finalChannelIds.length === 0) {
			const hitsPerPage = params.searchParams.hits_per_page ?? 25;
			const page = params.searchParams.page ?? 1;
			return {
				messages: [],
				total: 0,
				hits_per_page: hitsPerPage,
				page,
			};
		}

		const needsIndexing = await this.ensureChannelsIndexed(finalChannelIds);
		if (needsIndexing) {
			return {indexing: true};
		}

		return this.runSearch(finalChannelIds, params.userId, params.searchParams, params.requestCache);
	}

	async searchAcrossGuildsAndDms(params: {
		userId: UserID;
		dmScope: DmSearchScope;
		searchParams: MessageSearchRequest;
		requestCache: RequestCache;
		includeChannelId?: ChannelID | null;
		requestedChannelIds?: Array<ChannelID>;
	}): Promise<MessageSearchResponse> {
		const {accessibleChannels, unindexedChannelIds, guildNsfwLevels} =
			await this.guildService.collectAccessibleGuildChannels(params.userId);

		if (unindexedChannelIds.size > 0) {
			await this.queueIndexingChannels(unindexedChannelIds);
			return {indexing: true};
		}

		const guildChannelIds = Array.from(accessibleChannels.keys());
		const dmChannelIds = await getDmChannelIdsForScope({
			scope: params.dmScope,
			userId: params.userId,
			userRepository: this.userRepository,
			includeChannelId: params.includeChannelId,
		});

		const combinedChannelSet = new Set<string>([...guildChannelIds, ...dmChannelIds]);
		const validatedChannelIds = this.filterRequestedChannelIds(
			Array.from(combinedChannelSet),
			params.requestedChannelIds,
		);

		const includeNsfwRequested = params.searchParams.include_nsfw ?? false;
		let canIncludeNsfw = false;
		if (includeNsfwRequested) {
			const user = await this.userRepository.findUnique(params.userId);
			if (!user) {
				throw new UnknownUserError();
			}
			canIncludeNsfw = isUserAdult(user.dateOfBirth);
		}

		const finalChannelIds = validatedChannelIds.filter((channelIdStr) => {
			// DMs are not stored in `accessibleChannels`.
			const channel = accessibleChannels.get(channelIdStr);
			if (!channel) {
				return true;
			}

			const guildId = channel.guildId?.toString();
			const guildIsAgeRestricted = guildId != null && guildNsfwLevels.get(guildId) === GuildNSFWLevel.AGE_RESTRICTED;

			if (guildIsAgeRestricted) {
				return canIncludeNsfw;
			}

			if (channel.isNsfw) {
				return canIncludeNsfw;
			}

			return true;
		});
		if (finalChannelIds.length === 0) {
			const hitsPerPage = params.searchParams.hits_per_page ?? 25;
			const page = params.searchParams.page ?? 1;
			return {
				messages: [],
				total: 0,
				hits_per_page: hitsPerPage,
				page,
			};
		}

		const needsIndexing = await this.ensureChannelsIndexed(finalChannelIds);
		if (needsIndexing) {
			return {indexing: true};
		}

		return this.runSearch(finalChannelIds, params.userId, params.searchParams, params.requestCache);
	}

	private filterRequestedChannelIds(available: Array<string>, requested?: Array<ChannelID>): Array<string> {
		if (!requested || requested.length === 0) {
			return available;
		}

		const availableSet = new Set(available);
		const requestedStrings = requested.map((id) => id.toString());
		for (const channelId of requestedStrings) {
			if (!availableSet.has(channelId)) {
				throw new MissingPermissionsError();
			}
		}

		return requestedStrings;
	}

	private async ensureChannelsIndexed(channelIds: Array<string>): Promise<boolean> {
		const unindexed = new Set<string>();
		for (const channelId of channelIds) {
			const channel = await this.channelRepository.findUnique(createChannelID(BigInt(channelId)));
			if (!channel) {
				continue;
			}

			let indexedAt = channel.indexedAt;
			if (channel.type === ChannelTypes.DM_PERSONAL_NOTES) {
				const persisted = await this.channelRepository.channelData.findUnique(createChannelID(BigInt(channelId)));
				if (persisted?.indexedAt) {
					indexedAt = persisted.indexedAt;
				}
			}

			if (channelNeedsReindexing(indexedAt)) {
				unindexed.add(channelId);
			}
		}

		if (unindexed.size === 0) {
			return false;
		}

		await this.queueIndexingChannels(unindexed);
		return true;
	}

	private async queueIndexingChannels(channelIds: Iterable<string>): Promise<void> {
		await Promise.all(
			Array.from(channelIds).map((channelId) =>
				this.workerService.addJob(
					'indexChannelMessages',
					{channelId},
					{
						jobKey: `indexChannelMessages-${channelId}`,
						maxAttempts: 3,
					},
				),
			),
		);
	}

	private async runSearch(
		channelIds: Array<string>,
		userId: UserID,
		searchParams: MessageSearchRequest,
		requestCache: RequestCache,
	): Promise<MessageSearchResponse> {
		const searchService = this.getMessageSearchService();
		const normalizedSearchParams = {...searchParams, channel_id: undefined};
		const filters = buildMessageSearchFilters(normalizedSearchParams, channelIds);
		const hitsPerPage = searchParams.hits_per_page ?? 25;
		const page = searchParams.page ?? 1;
		const result = await searchService.searchMessages(searchParams.content ?? '', filters, {
			hitsPerPage,
			page,
		});
		const messageResponses = await this.responseMapper.mapSearchResultToResponses(result, userId, requestCache);
		return {
			messages: messageResponses,
			total: result.total,
			hits_per_page: hitsPerPage,
			page,
		};
	}
}
