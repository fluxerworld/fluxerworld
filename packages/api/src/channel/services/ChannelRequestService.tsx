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
import {mapChannelToResponse} from '@fluxer/api/src/channel/ChannelMappers';
import type {ChannelService} from '@fluxer/api/src/channel/services/ChannelService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import type {ChannelUpdateRequest} from '@fluxer/schema/src/domains/channel/ChannelRequestSchemas';
import type {ChannelResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';

export class ChannelRequestService {
	constructor(
		private readonly channelService: ChannelService,
		private readonly userCacheService: UserCacheService,
	) {}

	async getChannelResponse(params: {
		userId: UserID;
		channelId: ChannelID;
		requestCache: RequestCache;
	}): Promise<ChannelResponse> {
		const channel = await this.channelService.getChannel({
			userId: params.userId,
			channelId: params.channelId,
		});
		return mapChannelToResponse({
			channel,
			currentUserId: params.userId,
			userCacheService: this.userCacheService,
			requestCache: params.requestCache,
		});
	}

	async listRtcRegions(params: {userId: UserID; channelId: ChannelID}) {
		const regions = await this.channelService.getAvailableRtcRegions({
			userId: params.userId,
			channelId: params.channelId,
		});

		return regions.map((region) => ({
			id: region.id,
			name: region.name,
			emoji: region.emoji,
		}));
	}

	async updateChannel(params: {
		userId: UserID;
		channelId: ChannelID;
		data: ChannelUpdateRequest;
		requestCache: RequestCache;
	}): Promise<ChannelResponse> {
		const channel = await this.channelService.editChannel({
			userId: params.userId,
			channelId: params.channelId,
			data: params.data,
			requestCache: params.requestCache,
		});

		return mapChannelToResponse({
			channel,
			currentUserId: params.userId,
			userCacheService: this.userCacheService,
			requestCache: params.requestCache,
		});
	}

	async deleteChannel(params: {
		userId: UserID;
		channelId: ChannelID;
		requestCache: RequestCache;
		silent?: boolean;
	}): Promise<void> {
		const channel = await this.channelService.getChannel({
			userId: params.userId,
			channelId: params.channelId,
		});

		if (channel.type === ChannelTypes.GROUP_DM) {
			await this.channelService.removeRecipientFromChannel({
				userId: params.userId,
				channelId: params.channelId,
				recipientId: params.userId,
				requestCache: params.requestCache,
				silent: params.silent,
			});
			return;
		}

		await this.channelService.deleteChannel({
			userId: params.userId,
			channelId: params.channelId,
			requestCache: params.requestCache,
		});
	}
}
