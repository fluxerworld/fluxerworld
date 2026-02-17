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
import type {Application} from '@fluxer/api/src/models/Application';
import type {User} from '@fluxer/api/src/models/User';
import type {IApplicationRepository} from '@fluxer/api/src/oauth/repositories/IApplicationRepository';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {mapUserToPrivateResponse} from '@fluxer/api/src/user/UserMappers';

export class BotMfaMirrorService {
	constructor(
		private readonly applicationRepository: IApplicationRepository,
		private readonly userRepository: IUserRepository,
		private readonly gatewayService: IGatewayService,
	) {}

	private cloneAuthenticatorTypes(source: User): Set<number> {
		return source.authenticatorTypes ? new Set(source.authenticatorTypes) : new Set();
	}

	private hasSameAuthenticatorTypes(target: User, desired: Set<number>): boolean {
		const current = target.authenticatorTypes ?? new Set<number>();
		if (current.size !== desired.size) return false;
		for (const value of current) {
			if (!desired.has(value)) {
				return false;
			}
		}
		return true;
	}

	private async listApplications(ownerUserId: UserID): Promise<Array<Application>> {
		return this.applicationRepository.listApplicationsByOwner(ownerUserId);
	}

	async syncAuthenticatorTypesForOwner(owner: User): Promise<void> {
		if (owner.isBot) return;

		const desiredTypes = this.cloneAuthenticatorTypes(owner);
		const applications = await this.listApplications(owner.id);

		await Promise.all(
			applications.map(async (application) => {
				if (!application.hasBotUser()) return;

				const botUserId = application.getBotUserId();
				if (!botUserId) return;

				const botUser = await this.userRepository.findUnique(botUserId);
				if (!botUser) return;

				if (this.hasSameAuthenticatorTypes(botUser, desiredTypes)) {
					return;
				}

				const updatedBotUser = await this.userRepository.patchUpsert(
					botUserId,
					{
						authenticator_types: desiredTypes,
					},
					botUser.toRow(),
				);

				if (updatedBotUser) {
					await this.gatewayService.dispatchPresence({
						userId: botUserId,
						event: 'USER_UPDATE',
						data: mapUserToPrivateResponse(updatedBotUser),
					});
				}
			}),
		);
	}
}
