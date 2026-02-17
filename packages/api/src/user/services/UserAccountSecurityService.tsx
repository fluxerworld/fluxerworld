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
import type {SudoVerificationResult} from '@fluxer/api/src/auth/services/SudoVerificationService';
import {userHasMfa} from '@fluxer/api/src/auth/services/SudoVerificationService';
import type {UserRow} from '@fluxer/api/src/database/types/UserTypes';
import type {IDiscriminatorService} from '@fluxer/api/src/infrastructure/DiscriminatorService';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import type {LimitConfigService} from '@fluxer/api/src/limits/LimitConfigService';
import {resolveLimitSafe} from '@fluxer/api/src/limits/LimitConfigUtils';
import {createLimitMatchContext} from '@fluxer/api/src/limits/LimitMatchContextBuilder';
import type {AuthSession} from '@fluxer/api/src/models/AuthSession';
import type {User} from '@fluxer/api/src/models/User';
import type {IUserAccountRepository} from '@fluxer/api/src/user/repositories/IUserAccountRepository';
import {UserPremiumTypes} from '@fluxer/constants/src/UserConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {SudoModeRequiredError} from '@fluxer/errors/src/domains/auth/SudoModeRequiredError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import type {UserUpdateRequest} from '@fluxer/schema/src/domains/user/UserRequestSchemas';
import {ms} from 'itty-time';
import {uint8ArrayToBase64} from 'uint8array-extras';

interface UserUpdateMetadata {
	invalidateAuthSessions?: boolean;
}

type UserFieldUpdates = Partial<UserRow>;

interface UserAccountSecurityServiceDeps {
	userAccountRepository: IUserAccountRepository;
	authService: AuthService;
	discriminatorService: IDiscriminatorService;
	rateLimitService: IRateLimitService;
	limitConfigService: LimitConfigService;
}

export class UserAccountSecurityService {
	constructor(private readonly deps: UserAccountSecurityServiceDeps) {}

	async processSecurityUpdates(params: {
		user: User;
		data: UserUpdateRequest;
		sudoContext?: SudoVerificationResult;
	}): Promise<{updates: UserFieldUpdates; metadata: UserUpdateMetadata}> {
		const {user, data, sudoContext} = params;
		const updates: UserFieldUpdates = {
			password_hash: user.passwordHash,
			username: user.username,
			discriminator: user.discriminator,
			global_name: user.isBot ? null : user.globalName,
			email: user.email,
		};
		const metadata: UserUpdateMetadata = {
			invalidateAuthSessions: false,
		};

		const isUnclaimedAccount = user.isUnclaimedAccount();
		const identityVerifiedViaSudo = sudoContext?.method === 'mfa' || sudoContext?.method === 'sudo_token';
		const identityVerifiedViaPassword = sudoContext?.method === 'password';
		const hasMfa = userHasMfa(user);

		const rawEmail = data.email?.trim();
		const normalizedEmail = rawEmail?.toLowerCase();

		const hasPasswordRequiredChanges =
			(data.username !== undefined && data.username !== user.username) ||
			(data.discriminator !== undefined && data.discriminator !== user.discriminator) ||
			(data.email !== undefined && normalizedEmail !== user.email?.toLowerCase()) ||
			data.new_password !== undefined;

		const requiresVerification = hasPasswordRequiredChanges && !isUnclaimedAccount;
		if (requiresVerification && !identityVerifiedViaSudo && !identityVerifiedViaPassword) {
			throw new SudoModeRequiredError(hasMfa);
		}

		if (isUnclaimedAccount && data.new_password) {
			updates.password_hash = await this.hashNewPassword(data.new_password);
			updates.password_last_changed_at = new Date();
			metadata.invalidateAuthSessions = false;
		} else if (data.new_password) {
			if (!data.password) {
				throw InputValidationError.fromCode('password', ValidationErrorCodes.PASSWORD_NOT_SET);
			}
			if (!identityVerifiedViaSudo && !identityVerifiedViaPassword) {
				throw new SudoModeRequiredError(hasMfa);
			}
			updates.password_hash = await this.hashNewPassword(data.new_password);
			updates.password_last_changed_at = new Date();
			metadata.invalidateAuthSessions = true;
		}

		if (data.username !== undefined) {
			const {newUsername, newDiscriminator} = await this.updateUsername({
				user,
				username: data.username,
				requestedDiscriminator: data.discriminator,
			});
			updates.username = newUsername;
			updates.discriminator = newDiscriminator;
		} else if (data.discriminator !== undefined) {
			updates.discriminator = await this.updateDiscriminator({user, discriminator: data.discriminator});
		}

		if (user.isBot) {
			updates.global_name = null;
		} else if (data.global_name !== undefined) {
			if (data.global_name !== user.globalName) {
				getMetricsService().counter({name: 'fluxer.users.display_name_updated'});
			}
			updates.global_name = data.global_name;
		}

		if (rawEmail) {
			if (normalizedEmail && normalizedEmail !== user.email?.toLowerCase()) {
				const existing = await this.deps.userAccountRepository.findByEmail(normalizedEmail);
				if (existing && existing.id !== user.id) {
					throw InputValidationError.fromCode('email', ValidationErrorCodes.EMAIL_ALREADY_IN_USE);
				}
			}

			updates.email = rawEmail;
		}

		return {updates, metadata};
	}

	async invalidateAndRecreateSessions({
		user,
		oldAuthSession,
		request,
	}: {
		user: User;
		oldAuthSession: AuthSession;
		request: Request;
	}): Promise<void> {
		await this.deps.authService.terminateAllUserSessions(user.id);

		const [newToken, newAuthSession] = await this.deps.authService.createAuthSession({user, request});
		const oldAuthSessionIdHash = uint8ArrayToBase64(oldAuthSession.sessionIdHash, {urlSafe: true});

		await this.deps.authService.dispatchAuthSessionChange({
			userId: user.id,
			oldAuthSessionIdHash,
			newAuthSessionIdHash: uint8ArrayToBase64(newAuthSession.sessionIdHash, {urlSafe: true}),
			newToken,
		});
	}

	private async hashNewPassword(newPassword: string): Promise<string> {
		if (await this.deps.authService.isPasswordPwned(newPassword)) {
			throw InputValidationError.fromCode('new_password', ValidationErrorCodes.PASSWORD_IS_TOO_COMMON);
		}
		return await this.deps.authService.hashPassword(newPassword);
	}

	private async updateUsername({
		user,
		username,
		requestedDiscriminator,
	}: {
		user: User;
		username: string;
		requestedDiscriminator?: number;
	}): Promise<{newUsername: string; newDiscriminator: number}> {
		const normalizedRequestedDiscriminator =
			requestedDiscriminator == null ? undefined : Number(requestedDiscriminator);

		if (
			user.username.toLowerCase() === username.toLowerCase() &&
			(normalizedRequestedDiscriminator === undefined || normalizedRequestedDiscriminator === user.discriminator)
		) {
			return {
				newUsername: username,
				newDiscriminator: user.discriminator,
			};
		}

		const rateLimit = await this.deps.rateLimitService.checkLimit({
			identifier: `username_change:${user.id}`,
			maxAttempts: 5,
			windowMs: ms('1 hour'),
		});

		if (!rateLimit.allowed) {
			const minutes = Math.ceil((rateLimit.retryAfter || 0) / 60);
			throw InputValidationError.fromCode('username', ValidationErrorCodes.USERNAME_CHANGED_TOO_MANY_TIMES, {
				minutes,
			});
		}

		const ctx = createLimitMatchContext({user});
		const hasCustomDiscriminator = resolveLimitSafe(
			this.deps.limitConfigService.getConfigSnapshot(),
			ctx,
			'feature_custom_discriminator',
			0,
		);

		if (
			hasCustomDiscriminator === 0 &&
			user.username === username &&
			(normalizedRequestedDiscriminator === undefined || normalizedRequestedDiscriminator === user.discriminator)
		) {
			return {
				newUsername: user.username,
				newDiscriminator: user.discriminator,
			};
		}

		if (hasCustomDiscriminator === 0) {
			const discriminatorResult = await this.deps.discriminatorService.generateDiscriminator({
				username,
				requestedDiscriminator: undefined,
				user,
			});

			if (!discriminatorResult.available || discriminatorResult.discriminator === -1) {
				throw InputValidationError.fromCode(
					'username',
					ValidationErrorCodes.TOO_MANY_USERS_WITH_USERNAME_TRY_DIFFERENT,
				);
			}

			return {
				newUsername: username,
				newDiscriminator: discriminatorResult.discriminator,
			};
		}

		const discriminatorToUse = normalizedRequestedDiscriminator ?? user.discriminator;
		if (discriminatorToUse === 0 && user.premiumType !== UserPremiumTypes.LIFETIME) {
			throw InputValidationError.fromCode('discriminator', ValidationErrorCodes.VISIONARY_REQUIRED_FOR_DISCRIMINATOR);
		}

		const discriminatorResult = await this.deps.discriminatorService.generateDiscriminator({
			username,
			requestedDiscriminator: discriminatorToUse,
			user,
		});

		if (!discriminatorResult.available || discriminatorResult.discriminator === -1) {
			throw InputValidationError.fromCode(
				'username',
				discriminatorToUse !== undefined
					? ValidationErrorCodes.TAG_ALREADY_TAKEN
					: ValidationErrorCodes.TOO_MANY_USERS_WITH_USERNAME_TRY_DIFFERENT,
			);
		}

		return {
			newUsername: username,
			newDiscriminator: discriminatorResult.discriminator,
		};
	}

	private async updateDiscriminator({user, discriminator}: {user: User; discriminator: number}): Promise<number> {
		const ctx = createLimitMatchContext({user});
		const hasCustomDiscriminator = resolveLimitSafe(
			this.deps.limitConfigService.getConfigSnapshot(),
			ctx,
			'feature_custom_discriminator',
			0,
		);

		if (hasCustomDiscriminator === 0) {
			throw InputValidationError.fromCode(
				'discriminator',
				ValidationErrorCodes.CHANGING_DISCRIMINATOR_REQUIRES_PREMIUM,
			);
		}
		if (discriminator === 0 && user.premiumType !== UserPremiumTypes.LIFETIME) {
			throw InputValidationError.fromCode('discriminator', ValidationErrorCodes.VISIONARY_REQUIRED_FOR_DISCRIMINATOR);
		}

		const discriminatorResult = await this.deps.discriminatorService.generateDiscriminator({
			username: user.username,
			requestedDiscriminator: discriminator,
			user,
		});

		if (!discriminatorResult.available) {
			throw InputValidationError.fromCode('discriminator', ValidationErrorCodes.TAG_ALREADY_TAKEN);
		}

		return discriminator;
	}
}
