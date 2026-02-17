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
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {User} from '@fluxer/api/src/models/User';
import {invalidateUserCache, updateUserCache} from '@fluxer/api/src/user/UserCacheHelpers';
import {mapUserToPrivateResponse} from '@fluxer/api/src/user/UserMappers';

export interface BaseUserUpdatePropagatorDeps {
	userCacheService: UserCacheService;
	gatewayService: IGatewayService;
}

export class BaseUserUpdatePropagator {
	constructor(protected readonly baseDeps: BaseUserUpdatePropagatorDeps) {}

	async dispatchUserUpdate(user: User): Promise<void> {
		await this.baseDeps.gatewayService.dispatchPresence({
			userId: user.id,
			event: 'USER_UPDATE',
			data: mapUserToPrivateResponse(user),
		});
	}

	async invalidateUserCache(userId: UserID): Promise<void> {
		await invalidateUserCache({
			userId,
			userCacheService: this.baseDeps.userCacheService,
		});
	}

	async updateUserCache(user: User): Promise<void> {
		await updateUserCache({
			user,
			userCacheService: this.baseDeps.userCacheService,
		});
	}
}
