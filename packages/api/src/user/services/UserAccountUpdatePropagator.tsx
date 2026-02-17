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
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import type {UserGuildSettings} from '@fluxer/api/src/models/UserGuildSettings';
import type {UserSettings} from '@fluxer/api/src/models/UserSettings';
import type {IUserAccountRepository} from '@fluxer/api/src/user/repositories/IUserAccountRepository';
import {BaseUserUpdatePropagator} from '@fluxer/api/src/user/services/BaseUserUpdatePropagator';
import {mapUserGuildSettingsToResponse, mapUserSettingsToResponse} from '@fluxer/api/src/user/UserMappers';

interface UserAccountUpdatePropagatorDeps {
	userCacheService: UserCacheService;
	gatewayService: IGatewayService;
	mediaService: IMediaService;
	userRepository: IUserAccountRepository;
}

export class UserAccountUpdatePropagator extends BaseUserUpdatePropagator {
	constructor(private readonly deps: UserAccountUpdatePropagatorDeps) {
		super({
			userCacheService: deps.userCacheService,
			gatewayService: deps.gatewayService,
		});
	}

	async dispatchUserSettingsUpdate({userId, settings}: {userId: UserID; settings: UserSettings}): Promise<void> {
		const guildIds = await this.deps.userRepository.getUserGuildIds(userId);
		await this.deps.gatewayService.dispatchPresence({
			userId,
			event: 'USER_SETTINGS_UPDATE',
			data: mapUserSettingsToResponse({settings, memberGuildIds: guildIds}),
		});
	}

	async dispatchUserGuildSettingsUpdate({
		userId,
		settings,
	}: {
		userId: UserID;
		settings: UserGuildSettings;
	}): Promise<void> {
		await this.deps.gatewayService.dispatchPresence({
			userId,
			event: 'USER_GUILD_SETTINGS_UPDATE',
			data: mapUserGuildSettingsToResponse(settings),
		});
	}

	async dispatchUserNoteUpdate(params: {userId: UserID; targetId: UserID; note: string}): Promise<void> {
		const {userId, targetId, note} = params;
		await this.deps.gatewayService.dispatchPresence({
			userId,
			event: 'USER_NOTE_UPDATE',
			data: {id: targetId.toString(), note},
		});
	}
}
