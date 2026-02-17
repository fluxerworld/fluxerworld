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
import {mapGuildMemberToResponse} from '@fluxer/api/src/guild/GuildModel';
import type {IGuildRepositoryAggregate} from '@fluxer/api/src/guild/repositories/IGuildRepositoryAggregate';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import {createRequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {User} from '@fluxer/api/src/models/User';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {BaseUserUpdatePropagator} from '@fluxer/api/src/user/services/BaseUserUpdatePropagator';
import {hasPartialUserFieldsChanged} from '@fluxer/api/src/user/UserMappers';

interface AdminUserUpdatePropagatorDeps {
	userCacheService: UserCacheService;
	userRepository: IUserRepository;
	guildRepository: IGuildRepositoryAggregate;
	gatewayService: IGatewayService;
}

export class AdminUserUpdatePropagator extends BaseUserUpdatePropagator {
	constructor(private readonly deps: AdminUserUpdatePropagatorDeps) {
		super({
			userCacheService: deps.userCacheService,
			gatewayService: deps.gatewayService,
		});
	}

	async propagateUserUpdate({
		userId,
		oldUser,
		updatedUser,
	}: {
		userId: UserID;
		oldUser: User;
		updatedUser: User;
	}): Promise<void> {
		await this.dispatchUserUpdate(updatedUser);

		if (hasPartialUserFieldsChanged(oldUser, updatedUser)) {
			await this.updateUserCache(updatedUser);
			await this.propagateToGuilds(userId);
		}
	}

	private async propagateToGuilds(userId: UserID): Promise<void> {
		const {userRepository, guildRepository, gatewayService, userCacheService} = this.deps;

		const guildIds = await userRepository.getUserGuildIds(userId);
		if (guildIds.length === 0) {
			return;
		}

		const requestCache = createRequestCache();

		for (const guildId of guildIds) {
			const member = await guildRepository.getMember(guildId, userId);
			if (!member) {
				continue;
			}

			const memberResponse = await mapGuildMemberToResponse(member, userCacheService, requestCache);
			await gatewayService.dispatchGuild({
				guildId,
				event: 'GUILD_MEMBER_UPDATE',
				data: memberResponse,
			});
		}

		requestCache.clear();
	}
}
