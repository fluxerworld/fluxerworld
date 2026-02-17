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
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {UserService} from '@fluxer/api/src/user/services/UserService';
import type {ChannelResponse} from '@fluxer/schema/src/domains/channel/ChannelSchemas';
import type {CreatePrivateChannelRequest} from '@fluxer/schema/src/domains/user/UserRequestSchemas';

interface UserChannelListParams {
	userId: UserID;
	requestCache: RequestCache;
}

interface UserChannelCreateParams {
	userId: UserID;
	data: CreatePrivateChannelRequest;
	requestCache: RequestCache;
}

interface UserChannelPinParams {
	userId: UserID;
	channelId: ChannelID;
}

export class UserChannelRequestService {
	constructor(
		private readonly userService: UserService,
		private readonly userCacheService: UserCacheService,
	) {}

	async listPrivateChannels(params: UserChannelListParams): Promise<Array<ChannelResponse>> {
		const channels = await this.userService.getPrivateChannels(params.userId);
		return Promise.all(
			channels.map((channel) =>
				mapChannelToResponse({
					channel,
					currentUserId: params.userId,
					userCacheService: this.userCacheService,
					requestCache: params.requestCache,
				}),
			),
		);
	}

	async createPrivateChannel(params: UserChannelCreateParams): Promise<ChannelResponse> {
		const channel = await this.userService.createOrOpenDMChannel({
			userId: params.userId,
			data: params.data,
			userCacheService: this.userCacheService,
			requestCache: params.requestCache,
		});
		return mapChannelToResponse({
			channel,
			currentUserId: params.userId,
			userCacheService: this.userCacheService,
			requestCache: params.requestCache,
		});
	}

	async pinChannel(params: UserChannelPinParams): Promise<void> {
		await this.userService.pinDmChannel({userId: params.userId, channelId: params.channelId});
	}

	async unpinChannel(params: UserChannelPinParams): Promise<void> {
		await this.userService.unpinDmChannel({userId: params.userId, channelId: params.channelId});
	}
}
