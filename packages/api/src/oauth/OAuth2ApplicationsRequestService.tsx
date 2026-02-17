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

import type {AuthService} from '@fluxer/api/src/auth/AuthService';
import type {AuthMfaService} from '@fluxer/api/src/auth/services/AuthMfaService';
import type {SudoVerificationBody} from '@fluxer/api/src/auth/services/SudoVerificationService';
import {requireSudoMode} from '@fluxer/api/src/auth/services/SudoVerificationService';
import {createApplicationID, type UserID} from '@fluxer/api/src/BrandedTypes';
import {UsernameNotAvailableError} from '@fluxer/api/src/infrastructure/DiscriminatorService';
import type {Application} from '@fluxer/api/src/models/Application';
import type {User} from '@fluxer/api/src/models/User';
import type {ApplicationService} from '@fluxer/api/src/oauth/ApplicationService';
import {ApplicationNotOwnedError} from '@fluxer/api/src/oauth/ApplicationService';
import {mapApplicationToResponse, mapBotProfileToResponse} from '@fluxer/api/src/oauth/OAuth2Mappers';
import type {IApplicationRepository} from '@fluxer/api/src/oauth/repositories/IApplicationRepository';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {AccessDeniedError} from '@fluxer/errors/src/domains/core/AccessDeniedError';
import {BotUserNotFoundError} from '@fluxer/errors/src/domains/oauth/BotUserNotFoundError';
import {InvalidClientError} from '@fluxer/errors/src/domains/oauth/InvalidClientError';
import {UnknownApplicationError} from '@fluxer/errors/src/domains/oauth/UnknownApplicationError';
import type {
	ApplicationCreateRequest,
	ApplicationUpdateRequest,
	BotProfileResponse,
	BotProfileUpdateRequest,
} from '@fluxer/schema/src/domains/oauth/OAuthSchemas';
import type {Context} from 'hono';

export class OAuth2ApplicationsRequestService {
	constructor(
		private readonly applicationService: ApplicationService,
		private readonly applicationRepository: IApplicationRepository,
		private readonly userRepository: IUserRepository,
		private readonly authService: AuthService,
		private readonly authMfaService: AuthMfaService,
	) {}

	async listApplications(userId: UserID) {
		const applications: Array<Application> = await this.applicationService.listApplicationsByOwner(userId);

		const botUserMap = new Map<string, User>();
		const botUserFetches: Array<{id: string; promise: Promise<User | null>}> = [];

		for (const app of applications) {
			if (app.hasBotUser()) {
				const botUserId = app.getBotUserId();
				if (botUserId) {
					botUserFetches.push({
						id: botUserId.toString(),
						promise: this.userRepository.findUnique(botUserId),
					});
				}
			}
		}

		const botUsers = await Promise.all(botUserFetches.map((f) => f.promise));
		for (let i = 0; i < botUsers.length; i++) {
			const user = botUsers[i];
			if (user !== null) {
				botUserMap.set(botUserFetches[i].id, user);
			}
		}

		return applications.map((app: Application) => {
			const botUserId = app.hasBotUser() ? app.getBotUserId() : null;
			const botUser = botUserId ? botUserMap.get(botUserId.toString()) : null;
			return mapApplicationToResponse(app, {botUser: botUser ?? undefined});
		});
	}

	async createApplication(userId: UserID, body: ApplicationCreateRequest) {
		const result = await this.applicationService.createApplication({
			ownerUserId: userId,
			name: body.name,
			redirectUris: body.redirect_uris,
			botPublic: body.bot_public,
			botRequireCodeGrant: body.bot_require_code_grant,
		});

		return mapApplicationToResponse(result.application, {
			botUser: result.botUser,
			botToken: result.botToken,
			clientSecret: result.clientSecret,
		});
	}

	async getApplication(userId: UserID, applicationId: bigint) {
		const appId = createApplicationID(applicationId);
		const application = await this.applicationRepository.getApplication(appId);
		if (!application) {
			throw new UnknownApplicationError();
		}

		if (application.ownerUserId !== userId) {
			throw new AccessDeniedError();
		}

		let botUser = null;
		if (application.hasBotUser()) {
			const botUserId = application.getBotUserId();
			if (botUserId) {
				botUser = await this.userRepository.findUnique(botUserId);
			}
		}

		return mapApplicationToResponse(application, {botUser});
	}

	async updateApplication(userId: UserID, applicationId: bigint, body: ApplicationUpdateRequest) {
		try {
			const updated = await this.applicationService.updateApplication({
				userId,
				applicationId: createApplicationID(applicationId),
				name: body.name,
				redirectUris: body.redirect_uris,
				botPublic: body.bot_public,
				botRequireCodeGrant: body.bot_require_code_grant,
			});

			let botUser = null;
			if (updated.hasBotUser()) {
				const botUserId = updated.getBotUserId();
				if (botUserId) {
					botUser = await this.userRepository.findUnique(botUserId);
				}
			}

			return mapApplicationToResponse(updated, {botUser: botUser ?? undefined});
		} catch (err) {
			if (err instanceof ApplicationNotOwnedError) {
				throw new AccessDeniedError();
			}
			if (err instanceof UnknownApplicationError) {
				throw err;
			}
			throw err;
		}
	}

	async deleteApplication(params: {
		ctx: Context;
		userId: UserID;
		body: SudoVerificationBody;
		applicationId: bigint;
	}): Promise<void> {
		await requireSudoMode(params.ctx, params.ctx.get('user'), params.body, this.authService, this.authMfaService);

		try {
			await this.applicationService.deleteApplication(params.userId, createApplicationID(params.applicationId));
		} catch (err) {
			if (err instanceof ApplicationNotOwnedError) {
				throw new AccessDeniedError();
			}
			if (err instanceof UnknownApplicationError) {
				throw err;
			}
			throw err;
		}
	}

	async updateBotProfile(
		userId: UserID,
		applicationId: bigint,
		body: BotProfileUpdateRequest,
	): Promise<BotProfileResponse> {
		try {
			const result = await this.applicationService.updateBotProfile(userId, createApplicationID(applicationId), {
				username: body.username,
				discriminator: body.discriminator,
				avatar: body.avatar,
				banner: body.banner,
				bio: body.bio,
				botFlags: body.bot_flags,
			});

			return mapBotProfileToResponse(result.user);
		} catch (err) {
			if (err instanceof ApplicationNotOwnedError) {
				throw new AccessDeniedError();
			}
			if (err instanceof BotUserNotFoundError) {
				throw err;
			}
			if (err instanceof InvalidClientError || err instanceof UnknownApplicationError) {
				throw new UnknownApplicationError();
			}
			if (err instanceof UsernameNotAvailableError) {
				throw err;
			}
			throw err;
		}
	}
}
