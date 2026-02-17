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
import {requireSudoMode, type SudoVerificationResult} from '@fluxer/api/src/auth/services/SudoVerificationService';
import {createChannelID, createGuildID, type UserID} from '@fluxer/api/src/BrandedTypes';
import {mapMessageToResponse} from '@fluxer/api/src/channel/MessageMappers';
import type {UserConnectionRow} from '@fluxer/api/src/database/types/ConnectionTypes';
import type {IMediaService} from '@fluxer/api/src/infrastructure/IMediaService';
import type {UserCacheService} from '@fluxer/api/src/infrastructure/UserCacheService';
import {Logger} from '@fluxer/api/src/Logger';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {AuthSession} from '@fluxer/api/src/models/AuthSession';
import type {User} from '@fluxer/api/src/models/User';
import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import type {EmailChangeService} from '@fluxer/api/src/user/services/EmailChangeService';
import type {UserService} from '@fluxer/api/src/user/services/UserService';
import {mapUserToPartialResponseWithCache} from '@fluxer/api/src/user/UserCacheHelpers';
import {createPremiumClearPatch, shouldStripExpiredPremium} from '@fluxer/api/src/user/UserHelpers';
import {
	mapGuildMemberToProfileResponse,
	mapUserToPrivateResponse,
	mapUserToProfileResponse,
} from '@fluxer/api/src/user/UserMappers';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import {UnauthorizedError} from '@fluxer/errors/src/domains/core/UnauthorizedError';
import {AccountSuspiciousActivityError} from '@fluxer/errors/src/domains/user/AccountSuspiciousActivityError';
import type {ConnectionResponse} from '@fluxer/schema/src/domains/connection/ConnectionSchemas';
import type {UserUpdateWithVerificationRequest} from '@fluxer/schema/src/domains/user/UserRequestSchemas';
import type {UserPrivateResponse, UserProfileFullResponse} from '@fluxer/schema/src/domains/user/UserResponseSchemas';
import type {Context} from 'hono';
import type {z} from 'zod';

export type UserUpdateWithVerificationRequestData = z.infer<typeof UserUpdateWithVerificationRequest>;

type UserUpdatePayload = Omit<
	UserUpdateWithVerificationRequestData,
	'mfa_method' | 'mfa_code' | 'webauthn_response' | 'webauthn_challenge' | 'email_token'
>;

interface UserProfileParams {
	currentUserId: UserID;
	targetUserId: UserID;
	guildId?: bigint;
	withMutualFriends?: boolean;
	withMutualGuilds?: boolean;
	requestCache: RequestCache;
}

export class UserAccountRequestService {
	constructor(
		private readonly authService: AuthService,
		private readonly authMfaService: AuthMfaService,
		private readonly emailChangeService: EmailChangeService,
		private readonly userService: UserService,
		private readonly userRepository: IUserRepository,
		private readonly userCacheService: UserCacheService,
		private readonly mediaService: IMediaService,
	) {}

	getCurrentUserResponse(params: {
		authTokenType?: 'session' | 'bearer' | 'bot' | 'admin_api_key';
		oauthBearerScopes?: Set<string> | null;
		user?: User;
	}): UserPrivateResponse {
		const tokenType = params.authTokenType;

		if (tokenType === 'bearer') {
			const bearerUser = params.user;
			if (!bearerUser) {
				throw new UnauthorizedError();
			}
			this.enforceUserAccess(bearerUser);
			const includeEmail = params.oauthBearerScopes?.has('email') ?? false;
			const response = mapUserToPrivateResponse(bearerUser);
			if (!includeEmail) {
				response.email = null;
			}
			return response;
		}

		const user = params.user;
		if (user) {
			this.enforceUserAccess(user);
			return mapUserToPrivateResponse(user);
		}

		throw new UnauthorizedError();
	}

	async updateCurrentUser(params: {
		ctx: Context<HonoEnv>;
		user: User;
		body: UserUpdateWithVerificationRequestData;
		authSession: AuthSession;
	}): Promise<UserPrivateResponse> {
		const {ctx, user, body, authSession} = params;
		const oldEmail = user.email;
		const {
			mfa_method: _mfaMethod,
			mfa_code: _mfaCode,
			webauthn_response: _webauthnResponse,
			webauthn_challenge: _webauthnChallenge,
			email_token: emailToken,
			...userUpdateDataRest
		} = body;
		let userUpdateData: UserUpdatePayload = userUpdateDataRest;
		if (userUpdateData.email !== undefined) {
			throw InputValidationError.fromCode('email', ValidationErrorCodes.EMAIL_MUST_BE_CHANGED_VIA_TOKEN);
		}
		const emailTokenProvided = emailToken !== undefined;
		const isUnclaimed = user.isUnclaimedAccount();
		if (!isUnclaimed && userUpdateData.new_password !== undefined && !userUpdateData.password) {
			throw InputValidationError.fromCode('password', ValidationErrorCodes.PASSWORD_NOT_SET);
		}
		if (isUnclaimed) {
			const allowed = new Set(['username', 'discriminator', 'new_password']);
			const disallowedField = Object.keys(userUpdateData).find((key) => !allowed.has(key));
			if (disallowedField) {
				throw InputValidationError.fromCode(
					disallowedField,
					ValidationErrorCodes.UNCLAIMED_ACCOUNTS_CAN_ONLY_SET_EMAIL_VIA_TOKEN,
				);
			}
		}
		let emailFromToken: string | null = null;
		let emailVerifiedViaToken = false;

		const needsVerification = this.requiresSensitiveUserVerification(user, userUpdateData, emailTokenProvided);
		let sudoResult: SudoVerificationResult | null = null;
		if (needsVerification) {
			sudoResult = await requireSudoMode(ctx, user, body, this.authService, this.authMfaService);
		}

		if (emailTokenProvided && emailToken) {
			emailFromToken = await this.emailChangeService.consumeToken(user.id, emailToken);
			userUpdateData = {...userUpdateData, email: emailFromToken};
			emailVerifiedViaToken = true;
		}

		const updatedUser = await this.userService.update({
			user,
			oldAuthSession: authSession,
			data: userUpdateData,
			request: ctx.req.raw,
			sudoContext: sudoResult ?? undefined,
			emailVerifiedViaToken,
		});

		if (emailFromToken && oldEmail && updatedUser.email && oldEmail.toLowerCase() !== updatedUser.email.toLowerCase()) {
			try {
				await this.authService.issueEmailRevertToken(updatedUser, oldEmail, updatedUser.email);
			} catch (error) {
				Logger.warn({error, userId: updatedUser.id}, 'Failed to issue email revert token');
			}
		}
		return mapUserToPrivateResponse(updatedUser);
	}

	async preloadMessages(params: {
		userId: UserID;
		channels: ReadonlyArray<bigint>;
		requestCache: RequestCache;
	}): Promise<Record<string, unknown>> {
		const channelIds = params.channels.map((channelId) => createChannelID(channelId));
		const messages = await this.userService.preloadDMMessages({
			userId: params.userId,
			channelIds,
		});

		const mappingPromises = Object.entries(messages).map(async ([channelId, message]) => {
			const mappedMessage = message
				? await mapMessageToResponse({
						message,
						userCacheService: this.userCacheService,
						requestCache: params.requestCache,
						mediaService: this.mediaService,
						currentUserId: params.userId,
					})
				: null;
			return [channelId, mappedMessage] as const;
		});

		const mappedEntries = await Promise.all(mappingPromises);
		return Object.fromEntries(mappedEntries);
	}

	async getUserProfile(params: UserProfileParams): Promise<UserProfileFullResponse> {
		const guildId = params.guildId ? createGuildID(params.guildId) : undefined;
		const profile = await this.userService.getUserProfile({
			userId: params.currentUserId,
			targetId: params.targetUserId,
			guildId,
			withMutualFriends: params.withMutualFriends,
			withMutualGuilds: params.withMutualGuilds,
			requestCache: params.requestCache,
		});

		let profileUser = profile.user;
		let premiumType = profile.premiumType;
		let premiumSince = profile.premiumSince;
		let premiumLifetimeSequence = profile.premiumLifetimeSequence;

		if (shouldStripExpiredPremium(profileUser)) {
			try {
				const sanitizedUser = await this.userRepository.patchUpsert(
					profileUser.id,
					createPremiumClearPatch(),
					profileUser.toRow(),
				);
				if (sanitizedUser) {
					profileUser = sanitizedUser;
					profile.user = sanitizedUser;
					premiumType = undefined;
					premiumSince = undefined;
					premiumLifetimeSequence = undefined;
				}
			} catch (error) {
				Logger.warn(
					{userId: profileUser.id.toString(), error},
					'Failed to sanitize expired premium fields before returning profile',
				);
			}
		}

		const userProfile = mapUserToProfileResponse(profileUser);
		const guildMemberProfile = mapGuildMemberToProfileResponse(profile.guildMemberDomain ?? null);

		const mutualFriends = profile.mutualFriends
			? await Promise.all(
					profile.mutualFriends.map((user) =>
						mapUserToPartialResponseWithCache({
							user,
							userCacheService: this.userCacheService,
							requestCache: params.requestCache,
						}),
					),
				)
			: undefined;

		const connectedAccounts = profile.connections ? this.mapConnectionsToResponse(profile.connections) : undefined;

		return {
			user: await mapUserToPartialResponseWithCache({
				user: profileUser,
				userCacheService: this.userCacheService,
				requestCache: params.requestCache,
			}),
			user_profile: userProfile,
			guild_member: profile.guildMember ?? undefined,
			guild_member_profile: guildMemberProfile ?? undefined,
			premium_type: premiumType,
			premium_since: premiumSince?.toISOString(),
			premium_lifetime_sequence: premiumLifetimeSequence,
			mutual_friends: mutualFriends,
			mutual_guilds: profile.mutualGuilds,
			connected_accounts: connectedAccounts,
		};
	}

	checkTagAvailability(params: {currentUser: User; username: string; discriminator: number}): boolean {
		const currentUser = params.currentUser;
		const discriminator = params.discriminator;
		if (
			params.username.toLowerCase() === currentUser.username.toLowerCase() &&
			discriminator === currentUser.discriminator
		) {
			return false;
		}
		return true;
	}

	private enforceUserAccess(user: User): void {
		if (user.suspiciousActivityFlags !== null && user.suspiciousActivityFlags !== 0) {
			throw new AccountSuspiciousActivityError(user.suspiciousActivityFlags);
		}
	}

	private requiresSensitiveUserVerification(user: User, data: UserUpdatePayload, emailTokenProvided: boolean): boolean {
		const isUnclaimed = user.isUnclaimedAccount();
		const usernameChanged = data.username !== undefined && data.username !== user.username;
		const discriminatorChanged = data.discriminator !== undefined && data.discriminator !== user.discriminator;
		const emailChanged = data.email !== undefined && data.email !== user.email;
		const newPasswordProvided = data.new_password !== undefined;

		if (isUnclaimed) {
			return usernameChanged || discriminatorChanged;
		}

		return usernameChanged || discriminatorChanged || emailTokenProvided || emailChanged || newPasswordProvided;
	}

	private mapConnectionsToResponse(connections: Array<UserConnectionRow>): Array<ConnectionResponse> {
		return connections
			.sort((a, b) => a.sort_order - b.sort_order)
			.map((connection) => ({
				id: connection.connection_id,
				type: connection.connection_type,
				name: connection.name,
				verified: connection.verified,
				visibility_flags: connection.visibility_flags,
				sort_order: connection.sort_order,
			}));
	}
}
