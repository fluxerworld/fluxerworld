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

import type {ChannelID, GuildID, UserID} from '@fluxer/api/src/BrandedTypes';
import type {IChannelRepository} from '@fluxer/api/src/channel/IChannelRepository';
import type {ChannelService} from '@fluxer/api/src/channel/services/ChannelService';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {Channel} from '@fluxer/api/src/models/Channel';
import {getMessageSearchService} from '@fluxer/api/src/SearchFactory';
import {buildMessageSearchFilters} from '@fluxer/api/src/search/BuildMessageSearchFilters';
import {channelNeedsReindexing} from '@fluxer/api/src/search/ChannelIndexingUtils';
import {MessageSearchResponseMapper} from '@fluxer/api/src/search/MessageSearchResponseMapper';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {isUserAdult} from '@fluxer/api/src/utils/AgeUtils';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {GuildNSFWLevel} from '@fluxer/constants/src/GuildConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {FeatureTemporarilyDisabledError} from '@fluxer/errors/src/domains/core/FeatureTemporarilyDisabledError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {MissingPermissionsError} from '@fluxer/errors/src/domains/core/MissingPermissionsError';
import {NsfwContentRequiresAgeVerificationError} from '@fluxer/errors/src/domains/moderation/NsfwContentRequiresAgeVerificationError';
import {UnknownUserError} from '@fluxer/errors/src/domains/user/UnknownUserError';
import type {MessageSearchRequest} from '@fluxer/schema/src/domains/message/MessageRequestSchemas';
import type {MessageSearchResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import type {IWorkerService} from '@fluxer/worker/src/contracts/IWorkerService';

export class GuildSearchService {
	private readonly responseMapper: MessageSearchResponseMapper;

	constructor(
		private readonly channelRepository: IChannelRepository,
		private readonly channelService: ChannelService,
		private readonly userCacheService: UserCacheService,
		private readonly gatewayService: IGatewayService,
		private readonly userRepository: IUserRepository,
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

	async searchMessages(params: {
		userId: UserID;
		guildId: GuildID;
		channelIds: Array<ChannelID>;
		searchParams: MessageSearchRequest;
		requestCache: RequestCache;
	}): Promise<MessageSearchResponse> {
		const {userId, guildId, searchParams, requestCache} = params;
		let {channelIds} = params;

		const guildData = await this.gatewayService.getGuildData({guildId, userId});
		const guildIsAgeRestricted = guildData?.nsfw_level === GuildNSFWLevel.AGE_RESTRICTED;

		const searchService = getMessageSearchService();
		if (!searchService) {
			throw new FeatureTemporarilyDisabledError();
		}

		const explicitChannelIds = channelIds.length > 0;

		if (!explicitChannelIds) {
			const channels = await this.channelRepository.listGuildChannels(guildId);
			channelIds = channels.map((c) => c.id);
		}

		const includeNsfwRequested = searchParams.include_nsfw ?? false;
		let userIsAdultResult: boolean | null = null;
		const getIsUserAdult = async (): Promise<boolean> => {
			if (userIsAdultResult !== null) {
				return userIsAdultResult;
			}
			const user = await this.userRepository.findUnique(userId);
			if (!user) {
				throw new UnknownUserError();
			}
			userIsAdultResult = isUserAdult(user.dateOfBirth);
			return userIsAdultResult;
		};

		if (guildIsAgeRestricted) {
			if (!(await getIsUserAdult())) {
				throw new NsfwContentRequiresAgeVerificationError();
			}

			// Searching an age-restricted community requires an explicit NSFW opt-in.
			if (!includeNsfwRequested) {
				const hitsPerPage = searchParams.hits_per_page ?? 25;
				const page = searchParams.page ?? 1;
				return {
					messages: [],
					total: 0,
					hits_per_page: hitsPerPage,
					page,
				};
			}
		}

		const canIncludeNsfw = includeNsfwRequested ? await getIsUserAdult() : false;
		const validChannelIds: Array<ChannelID> = [];
		for (const channelId of channelIds) {
			const channel = await this.channelRepository.findUnique(channelId);
			if (!channel || channel.guildId !== guildId) {
				throw InputValidationError.fromCode('channel_ids', ValidationErrorCodes.ALL_CHANNELS_MUST_BELONG_TO_GUILD);
			}

			if (channel.isNsfw && !canIncludeNsfw) {
				continue;
			}

			const canSearch = await this.gatewayService.checkPermission({
				guildId,
				userId,
				channelId,
				permission: Permissions.VIEW_CHANNEL | Permissions.READ_MESSAGE_HISTORY,
			});

			if (!canSearch) {
				if (explicitChannelIds) {
					throw new MissingPermissionsError();
				}
				continue;
			}

			validChannelIds.push(channelId);
		}

		if (validChannelIds.length === 0) {
			const hitsPerPage = searchParams.hits_per_page ?? 25;
			const page = searchParams.page ?? 1;
			return {
				messages: [],
				total: 0,
				hits_per_page: hitsPerPage,
				page,
			};
		}

		const channelsNeedingIndex = await Promise.all(
			validChannelIds.map(async (channelId) => {
				const channel = await this.channelRepository.findUnique(channelId);
				return channel && channelNeedsReindexing(channel.indexedAt) ? channelId : null;
			}),
		);

		const unindexedChannels = channelsNeedingIndex.filter((id): id is ChannelID => id !== null);

		if (unindexedChannels.length > 0) {
			await Promise.all(
				unindexedChannels.map((channelId) =>
					this.workerService.addJob(
						'indexChannelMessages',
						{channelId: channelId.toString()},
						{
							jobKey: `indexChannelMessages-${channelId}`,
							maxAttempts: 3,
						},
					),
				),
			);
			return {indexing: true};
		}

		const filters = buildMessageSearchFilters(
			searchParams,
			validChannelIds.map((id) => id.toString()),
		);

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

	async searchAllGuilds(params: {
		userId: UserID;
		channelIds: Array<ChannelID>;
		searchParams: MessageSearchRequest;
		requestCache: RequestCache;
	}): Promise<MessageSearchResponse> {
		const {userId, channelIds, searchParams, requestCache} = params;

		const searchService = getMessageSearchService();
		if (!searchService) {
			throw new FeatureTemporarilyDisabledError();
		}

		const {accessibleChannels, unindexedChannelIds, guildNsfwLevels} =
			await this.collectAccessibleGuildChannels(userId);

		if (unindexedChannelIds.size > 0) {
			await this.queueIndexingChannels(unindexedChannelIds);
			return {indexing: true};
		}

		let searchChannelIds = Array.from(accessibleChannels.keys());

		if (channelIds.length > 0) {
			const requestedChannelStrings = channelIds.map((id) => id.toString());
			for (const requested of requestedChannelStrings) {
				if (!accessibleChannels.has(requested)) {
					throw new MissingPermissionsError();
				}
			}
			searchChannelIds = requestedChannelStrings;
		}

		const includeNsfwRequested = searchParams.include_nsfw ?? false;
		let canIncludeNsfw = false;
		if (includeNsfwRequested) {
			const user = await this.userRepository.findUnique(userId);
			if (!user) {
				throw new UnknownUserError();
			}
			canIncludeNsfw = isUserAdult(user.dateOfBirth);
		}

		searchChannelIds = searchChannelIds.filter((channelIdStr) => {
			const channel = accessibleChannels.get(channelIdStr);
			if (!channel) {
				return false;
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

		if (searchChannelIds.length === 0) {
			const hitsPerPage = searchParams.hits_per_page ?? 25;
			const page = searchParams.page ?? 1;
			return {
				messages: [],
				total: 0,
				hits_per_page: hitsPerPage,
				page,
			};
		}

		const filters = buildMessageSearchFilters(searchParams, searchChannelIds);

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

	async collectAccessibleGuildChannels(userId: UserID): Promise<{
		accessibleChannels: Map<string, Channel>;
		unindexedChannelIds: Set<string>;
		guildNsfwLevels: Map<string, number>;
	}> {
		const guildIds = await this.userRepository.getUserGuildIds(userId);
		const accessibleChannels = new Map<string, Channel>();
		const unindexedChannelIds = new Set<string>();
		const guildNsfwLevels = new Map<string, number>();

		for (const guildId of guildIds) {
			const guildData = await this.gatewayService.getGuildData({guildId, userId});
			if (guildData) {
				guildNsfwLevels.set(guildId.toString(), guildData.nsfw_level);
			}

			const guildChannels = await this.channelRepository.listGuildChannels(guildId);
			if (guildChannels.length === 0) {
				continue;
			}

			const viewableChannelIds = new Set(
				(
					await this.gatewayService.getViewableChannels({
						guildId,
						userId,
					})
				).map((channelId) => channelId.toString()),
			);

			for (const channel of guildChannels) {
				const channelIdStr = channel.id.toString();
				if (!viewableChannelIds.has(channelIdStr)) {
					continue;
				}

				const hasPermission = await this.gatewayService.checkPermission({
					guildId,
					userId,
					channelId: channel.id,
					permission: Permissions.VIEW_CHANNEL | Permissions.READ_MESSAGE_HISTORY,
				});

				if (!hasPermission) {
					continue;
				}

				accessibleChannels.set(channelIdStr, channel);
				if (channelNeedsReindexing(channel.indexedAt)) {
					unindexedChannelIds.add(channelIdStr);
				}
			}
		}

		return {accessibleChannels, unindexedChannelIds, guildNsfwLevels};
	}
}
