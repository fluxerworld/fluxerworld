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
import type {User} from '@fluxer/api/src/models/User';
import type {UserPartialResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';

export async function getCachedUserPartialResponse(params: {
	userId: UserID;
	userCacheService: UserCacheService;
	requestCache: RequestCache;
}): Promise<UserPartialResponse> {
	const {userId, userCacheService, requestCache} = params;
	return await userCacheService.getUserPartialResponse(userId, requestCache);
}

export async function getCachedUserPartialResponses(params: {
	userIds: Array<UserID>;
	userCacheService: UserCacheService;
	requestCache: RequestCache;
}): Promise<Map<UserID, UserPartialResponse>> {
	const {userIds, userCacheService, requestCache} = params;
	return await userCacheService.getUserPartialResponses(userIds, requestCache);
}

export async function mapUserToPartialResponseWithCache(params: {
	user: User;
	userCacheService: UserCacheService;
	requestCache: RequestCache;
}): Promise<UserPartialResponse> {
	const {user, userCacheService, requestCache} = params;
	const cached = requestCache.userPartials.get(user.id);
	if (cached) {
		return cached;
	}
	return userCacheService.setUserPartialResponseFromUserInBackground(user, requestCache);
}

export async function invalidateUserCache(params: {userId: UserID; userCacheService: UserCacheService}): Promise<void> {
	const {userId, userCacheService} = params;
	await userCacheService.invalidateUserCache(userId);
}

export async function updateUserCache(params: {user: User; userCacheService: UserCacheService}): Promise<void> {
	const {user, userCacheService} = params;
	await userCacheService.setUserPartialResponseFromUser(user);
}
