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

import {createEmailVerificationToken} from '@fluxer/api/src/BrandedTypes';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import {Logger} from '@fluxer/api/src/Logger';
import type {User} from '@fluxer/api/src/models/User';
import {getUserSearchService} from '@fluxer/api/src/SearchFactory';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import {mapUserToPrivateResponse} from '@fluxer/api/src/user/UserMappers';
import {SuspiciousActivityFlags, UserFlags} from '@fluxer/constants/src/UserConstants';
import type {IEmailService} from '@fluxer/email/src/IEmailService';
import {RateLimitError} from '@fluxer/errors/src/domains/core/RateLimitError';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import type {VerifyEmailRequest} from '@fluxer/schema/src/domains/auth/AuthSchemas';
import {ms} from 'itty-time';

export const EMAIL_CLEARABLE_SUSPICIOUS_ACTIVITY_FLAGS =
	SuspiciousActivityFlags.REQUIRE_VERIFIED_EMAIL |
	SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL |
	SuspiciousActivityFlags.REQUIRE_VERIFIED_EMAIL_OR_VERIFIED_PHONE |
	SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL_OR_VERIFIED_PHONE |
	SuspiciousActivityFlags.REQUIRE_VERIFIED_EMAIL_OR_REVERIFIED_PHONE |
	SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL_OR_REVERIFIED_PHONE;

export class AuthEmailService {
	constructor(
		private repository: IUserRepository,
		private emailService: IEmailService,
		private gatewayService: IGatewayService,
		private rateLimitService: IRateLimitService,
		private assertNonBotUser: (user: User) => void,
		private generateSecureToken: () => Promise<string>,
	) {}

	async verifyEmail(data: VerifyEmailRequest): Promise<boolean> {
		const tokenData = await this.repository.getEmailVerificationToken(data.token);
		if (!tokenData) {
			return false;
		}

		const user = await this.repository.findUnique(tokenData.userId);
		if (!user) {
			return false;
		}

		this.assertNonBotUser(user);

		if (user.flags & UserFlags.DELETED) {
			return false;
		}

		const updates: {email_verified: boolean; suspicious_activity_flags?: number} = {
			email_verified: true,
		};

		if (user.suspiciousActivityFlags !== null && user.suspiciousActivityFlags !== 0) {
			const newFlags = user.suspiciousActivityFlags & ~EMAIL_CLEARABLE_SUSPICIOUS_ACTIVITY_FLAGS;
			if (newFlags !== user.suspiciousActivityFlags) {
				updates.suspicious_activity_flags = newFlags;
			}
		}

		const updatedUser = await this.repository.patchUpsert(user.id, updates, user.toRow());
		await this.repository.deleteEmailVerificationToken(data.token);

		const userSearchService = getUserSearchService();
		if (userSearchService && 'updateUser' in userSearchService) {
			await userSearchService.updateUser(updatedUser).catch((error) => {
				Logger.error({userId: user.id, error}, 'Failed to update user in search');
			});
		}

		await this.gatewayService.dispatchPresence({
			userId: user.id,
			event: 'USER_UPDATE',
			data: mapUserToPrivateResponse(updatedUser),
		});

		return true;
	}

	async resendVerificationEmail(user: User): Promise<void> {
		this.assertNonBotUser(user);

		const allowReverification =
			user.suspiciousActivityFlags !== null &&
			((user.suspiciousActivityFlags & SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL) !== 0 ||
				(user.suspiciousActivityFlags & SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL_OR_VERIFIED_PHONE) !== 0 ||
				(user.suspiciousActivityFlags & SuspiciousActivityFlags.REQUIRE_VERIFIED_EMAIL_OR_REVERIFIED_PHONE) !== 0 ||
				(user.suspiciousActivityFlags & SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL_OR_REVERIFIED_PHONE) !== 0);

		if (user.emailVerified && !allowReverification) {
			return;
		}

		const rateLimit = await this.rateLimitService.checkLimit({
			identifier: `email_verification:${user.email!}`,
			maxAttempts: 3,
			windowMs: ms('15 minutes'),
		});

		if (!rateLimit.allowed) {
			throw new RateLimitError({
				retryAfter: rateLimit.retryAfter || 0,
				limit: rateLimit.limit,
				resetTime: rateLimit.resetTime,
			});
		}

		const emailVerifyToken = createEmailVerificationToken(await this.generateSecureToken());
		await this.repository.createEmailVerificationToken({
			token_: emailVerifyToken,
			user_id: user.id,
			email: user.email!,
		});

		await this.emailService.sendEmailVerification(user.email!, user.username, emailVerifyToken, user.locale);
	}
}
