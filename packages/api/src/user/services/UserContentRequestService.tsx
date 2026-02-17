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
import {mapMessageToResponse} from '@fluxer/api/src/channel/MessageMappers';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {IStorageService} from '@fluxer/api/src/infrastructure/IStorageService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {SavedMessageEntry} from '@fluxer/api/src/user/services/UserContentService';
import type {UserService} from '@fluxer/api/src/user/services/UserService';
import type {MessageListResponse} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import type {
	HarvestCreationResponseSchema,
	HarvestDownloadUrlResponse,
	HarvestStatusResponseSchema,
} from '@fluxer/schema/src/domains/user/UserHarvestSchemas';
import type {
	SavedMessageEntryListResponse,
	SavedMessageEntryResponse,
} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import type {z} from 'zod';

type HarvestCreationResponse = z.infer<typeof HarvestCreationResponseSchema>;
type HarvestStatusResponse = z.infer<typeof HarvestStatusResponseSchema>;
type HarvestLatestResponse = HarvestStatusResponse | null;

interface UserMentionsParams {
	userId: UserID;
	limit: number;
	roles: boolean;
	everyone: boolean;
	guilds: boolean;
	before?: MessageID;
	requestCache: RequestCache;
}

interface UserMentionDeleteParams {
	userId: UserID;
	messageId: MessageID;
}

interface SavedMessagesParams {
	userId: UserID;
	limit: number;
	requestCache: RequestCache;
}

interface SaveMessageParams {
	userId: UserID;
	channelId: ChannelID;
	messageId: MessageID;
	requestCache: RequestCache;
}

interface UnsaveMessageParams {
	userId: UserID;
	messageId: MessageID;
}

interface HarvestRequestParams {
	userId: UserID;
}

interface HarvestStatusParams {
	userId: UserID;
	harvestId: bigint;
}

interface HarvestDownloadParams {
	userId: UserID;
	harvestId: bigint;
	storageService: IStorageService;
}

export class UserContentRequestService {
	constructor(
		private readonly userService: UserService,
		private readonly userCacheService: UserCacheService,
		private readonly mediaService: IMediaService,
	) {}

	async listMentions(params: UserMentionsParams): Promise<MessageListResponse> {
		const messages = await this.userService.getRecentMentions({
			userId: params.userId,
			limit: params.limit,
			everyone: params.everyone,
			roles: params.roles,
			guilds: params.guilds,
			before: params.before,
		});
		return Promise.all(
			messages.map((message) =>
				mapMessageToResponse({
					message,
					currentUserId: params.userId,
					userCacheService: this.userCacheService,
					requestCache: params.requestCache,
					mediaService: this.mediaService,
				}),
			),
		);
	}

	async deleteMention(params: UserMentionDeleteParams): Promise<void> {
		await this.userService.deleteRecentMention({userId: params.userId, messageId: params.messageId});
	}

	async listSavedMessages(params: SavedMessagesParams): Promise<SavedMessageEntryListResponse> {
		const entries = await this.userService.getSavedMessages({userId: params.userId, limit: params.limit});
		return Promise.all(entries.map((entry) => this.mapSavedMessageEntry(params.userId, entry, params.requestCache)));
	}

	async saveMessage(params: SaveMessageParams): Promise<void> {
		await this.userService.saveMessage({
			userId: params.userId,
			channelId: params.channelId,
			messageId: params.messageId,
			userCacheService: this.userCacheService,
			requestCache: params.requestCache,
		});
	}

	async unsaveMessage(params: UnsaveMessageParams): Promise<void> {
		await this.userService.unsaveMessage({userId: params.userId, messageId: params.messageId});
	}

	async requestHarvest(params: HarvestRequestParams): Promise<HarvestCreationResponse> {
		return this.userService.requestDataHarvest(params.userId);
	}

	async getLatestHarvest(params: HarvestRequestParams): Promise<HarvestLatestResponse> {
		return this.userService.getLatestHarvest(params.userId);
	}

	async getHarvestStatus(params: HarvestStatusParams): Promise<HarvestStatusResponse> {
		return this.userService.getHarvestStatus(params.userId, params.harvestId);
	}

	async getHarvestDownloadUrl(params: HarvestDownloadParams): Promise<HarvestDownloadUrlResponse> {
		return this.userService.getHarvestDownloadUrl(params.userId, params.harvestId, params.storageService);
	}

	private async mapSavedMessageEntry(
		userId: UserID,
		entry: SavedMessageEntry,
		requestCache: RequestCache,
	): Promise<SavedMessageEntryResponse> {
		return {
			id: entry.messageId.toString(),
			channel_id: entry.channelId.toString(),
			message_id: entry.messageId.toString(),
			status: entry.status,
			message: entry.message
				? await mapMessageToResponse({
						message: entry.message,
						currentUserId: userId,
						userCacheService: this.userCacheService,
						requestCache,
						mediaService: this.mediaService,
					})
				: null,
		};
	}
}
