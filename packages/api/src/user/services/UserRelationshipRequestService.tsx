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

import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {UserService} from '@fluxer/api/src/user/services/UserService';
import {getCachedUserPartialResponse} from '@fluxer/api/src/user/UserCacheHelpers';
import {mapRelationshipToResponse} from '@fluxer/api/src/user/UserMappers';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import type {
	FriendRequestByTagRequest,
	RelationshipNicknameUpdateRequest,
	RelationshipTypePutRequest,
} from '@fluxer/schema/src/domains/user/UserRequestSchemas';
import type {RelationshipResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';

interface RelationshipListParams {
	userId: UserID;
	requestCache: RequestCache;
}

interface RelationshipSendByTagParams {
	userId: UserID;
	data: FriendRequestByTagRequest;
	requestCache: RequestCache;
}

interface RelationshipSendParams {
	userId: UserID;
	targetId: UserID;
	requestCache: RequestCache;
}

interface RelationshipUpdateTypeParams {
	userId: UserID;
	targetId: UserID;
	data: RelationshipTypePutRequest;
	requestCache: RequestCache;
}

interface RelationshipDeleteParams {
	userId: UserID;
	targetId: UserID;
}

interface RelationshipNicknameParams {
	userId: UserID;
	targetId: UserID;
	data: RelationshipNicknameUpdateRequest;
	requestCache: RequestCache;
}

export class UserRelationshipRequestService {
	constructor(
		private readonly userService: UserService,
		private readonly userCacheService: UserCacheService,
	) {}

	async listRelationships(params: RelationshipListParams): Promise<Array<RelationshipResponse>> {
		const userPartialResolver = this.createUserPartialResolver(params.requestCache);
		const relationships = await this.userService.getRelationships(params.userId);
		return Promise.all(
			relationships.map((relationship) => mapRelationshipToResponse({relationship, userPartialResolver})),
		);
	}

	async sendFriendRequestByTag(params: RelationshipSendByTagParams): Promise<RelationshipResponse> {
		const userPartialResolver = this.createUserPartialResolver(params.requestCache);
		const relationship = await this.userService.sendFriendRequestByTag({
			userId: params.userId,
			data: params.data,
			userCacheService: this.userCacheService,
			requestCache: params.requestCache,
		});
		return mapRelationshipToResponse({relationship, userPartialResolver});
	}

	async sendFriendRequest(params: RelationshipSendParams): Promise<RelationshipResponse> {
		const userPartialResolver = this.createUserPartialResolver(params.requestCache);
		const relationship = await this.userService.sendFriendRequest({
			userId: params.userId,
			targetId: params.targetId,
			userCacheService: this.userCacheService,
			requestCache: params.requestCache,
		});
		return mapRelationshipToResponse({relationship, userPartialResolver});
	}

	async updateRelationshipType(params: RelationshipUpdateTypeParams): Promise<RelationshipResponse> {
		const userPartialResolver = this.createUserPartialResolver(params.requestCache);
		if (params.data?.type === RelationshipTypes.BLOCKED) {
			const relationship = await this.userService.blockUser({
				userId: params.userId,
				targetId: params.targetId,
				userCacheService: this.userCacheService,
				requestCache: params.requestCache,
			});
			return mapRelationshipToResponse({relationship, userPartialResolver});
		}
		const relationship = await this.userService.acceptFriendRequest({
			userId: params.userId,
			targetId: params.targetId,
			userCacheService: this.userCacheService,
			requestCache: params.requestCache,
		});
		return mapRelationshipToResponse({relationship, userPartialResolver});
	}

	async removeRelationship(params: RelationshipDeleteParams): Promise<void> {
		await this.userService.removeRelationship({userId: params.userId, targetId: params.targetId});
	}

	async updateNickname(params: RelationshipNicknameParams): Promise<RelationshipResponse> {
		const userPartialResolver = this.createUserPartialResolver(params.requestCache);
		const relationship = await this.userService.updateFriendNickname({
			userId: params.userId,
			targetId: params.targetId,
			nickname: params.data.nickname ?? null,
			userCacheService: this.userCacheService,
			requestCache: params.requestCache,
		});
		return mapRelationshipToResponse({relationship, userPartialResolver});
	}

	private createUserPartialResolver(requestCache: RequestCache) {
		return (userId: UserID) =>
			getCachedUserPartialResponse({userId, userCacheService: this.userCacheService, requestCache});
	}
}
