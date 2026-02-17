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

import {createPhoneVerificationToken, type UserID} from '@fluxer/api/src/BrandedTypes';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import {Logger} from '@fluxer/api/src/Logger';
import type {User} from '@fluxer/api/src/models/User';
import {getUserSearchService} from '@fluxer/api/src/SearchFactory';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import type {UserContactChangeLogService} from '@fluxer/api/src/user/services/UserContactChangeLogService';
import {mapUserToPrivateResponse} from '@fluxer/api/src/user/UserMappers';
import {SuspiciousActivityFlags, UserAuthenticatorTypes, UserFlags} from '@fluxer/constants/src/UserConstants';
import {InvalidPhoneNumberError} from '@fluxer/errors/src/domains/auth/InvalidPhoneNumberError';
import {InvalidPhoneVerificationCodeError} from '@fluxer/errors/src/domains/auth/InvalidPhoneVerificationCodeError';
import {PhoneAlreadyUsedError} from '@fluxer/errors/src/domains/auth/PhoneAlreadyUsedError';
import {PhoneVerificationRequiredError} from '@fluxer/errors/src/domains/auth/PhoneVerificationRequiredError';
import {SmsMfaNotEnabledError} from '@fluxer/errors/src/domains/auth/SmsMfaNotEnabledError';
import {PHONE_E164_REGEX} from '@fluxer/schema/src/primitives/UserValidators';
import type {ISmsService} from '@fluxer/sms/src/ISmsService';

const PHONE_CLEARABLE_SUSPICIOUS_ACTIVITY_FLAGS =
	SuspiciousActivityFlags.REQUIRE_VERIFIED_PHONE |
	SuspiciousActivityFlags.REQUIRE_REVERIFIED_PHONE |
	SuspiciousActivityFlags.REQUIRE_VERIFIED_EMAIL_OR_VERIFIED_PHONE |
	SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL_OR_VERIFIED_PHONE |
	SuspiciousActivityFlags.REQUIRE_VERIFIED_EMAIL_OR_REVERIFIED_PHONE |
	SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL_OR_REVERIFIED_PHONE;

export class AuthPhoneService {
	constructor(
		private repository: IUserRepository,
		private smsService: ISmsService,
		private gatewayService: IGatewayService,
		private assertNonBotUser: (user: User) => void,
		private generateSecureToken: () => Promise<string>,
		private contactChangeLogService: UserContactChangeLogService,
	) {}

	async sendPhoneVerificationCode(phone: string, userId: UserID | null): Promise<void> {
		if (!PHONE_E164_REGEX.test(phone)) {
			throw new InvalidPhoneNumberError();
		}

		const existingUser = await this.repository.findByPhone(phone);

		if (userId) {
			const requestingUser = await this.repository.findUnique(userId);
			if (requestingUser) {
				this.assertNonBotUser(requestingUser);
			}
		}

		const allowReverification =
			existingUser &&
			userId &&
			existingUser.id === userId &&
			existingUser.suspiciousActivityFlags !== null &&
			((existingUser.suspiciousActivityFlags & SuspiciousActivityFlags.REQUIRE_REVERIFIED_PHONE) !== 0 ||
				(existingUser.suspiciousActivityFlags &
					SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL_OR_REVERIFIED_PHONE) !==
					0 ||
				(existingUser.suspiciousActivityFlags & SuspiciousActivityFlags.REQUIRE_VERIFIED_EMAIL_OR_REVERIFIED_PHONE) !==
					0 ||
				(existingUser.suspiciousActivityFlags & SuspiciousActivityFlags.REQUIRE_REVERIFIED_EMAIL_OR_VERIFIED_PHONE) !==
					0);

		if (existingUser) {
			this.assertNonBotUser(existingUser);
		}

		if (existingUser && (!userId || existingUser.id !== userId) && !allowReverification) {
			throw new PhoneAlreadyUsedError();
		}

		await this.smsService.startVerification(phone);
	}

	async verifyPhoneCode(phone: string, code: string, userId: UserID | null): Promise<string> {
		if (!PHONE_E164_REGEX.test(phone)) {
			throw new InvalidPhoneNumberError();
		}

		const isValid = await this.smsService.checkVerification(phone, code);
		if (!isValid) {
			throw new InvalidPhoneVerificationCodeError();
		}

		const phoneToken = await this.generateSecureToken();
		const phoneVerificationToken = createPhoneVerificationToken(phoneToken);
		await this.repository.createPhoneToken(phoneVerificationToken, phone, userId);

		return phoneToken;
	}

	async addPhoneToAccount(userId: UserID, phoneToken: string): Promise<void> {
		const phoneVerificationToken = createPhoneVerificationToken(phoneToken);
		const tokenData = await this.repository.getPhoneToken(phoneVerificationToken);

		if (!tokenData) {
			throw new PhoneVerificationRequiredError();
		}

		if (tokenData.user_id && tokenData.user_id !== userId) {
			throw new PhoneVerificationRequiredError();
		}

		const existingUser = await this.repository.findByPhone(tokenData.phone);
		if (existingUser && existingUser.id !== userId) {
			throw new PhoneAlreadyUsedError();
		}

		const user = await this.repository.findUnique(userId);
		if (!user) {
			throw new PhoneVerificationRequiredError();
		}

		this.assertNonBotUser(user);

		if (user.flags & UserFlags.DELETED) {
			throw new PhoneVerificationRequiredError();
		}

		const updates: {phone: string; suspicious_activity_flags?: number} = {
			phone: tokenData.phone,
		};

		if (user.suspiciousActivityFlags !== null && user.suspiciousActivityFlags !== 0) {
			const newFlags = user.suspiciousActivityFlags & ~PHONE_CLEARABLE_SUSPICIOUS_ACTIVITY_FLAGS;
			if (newFlags !== user.suspiciousActivityFlags) {
				updates.suspicious_activity_flags = newFlags;
			}
		}

		const updatedUser = await this.repository.patchUpsert(userId, updates, user.toRow());

		await this.repository.deletePhoneToken(phoneVerificationToken);

		await this.contactChangeLogService.recordDiff({
			oldUser: user,
			newUser: updatedUser,
			reason: 'user_requested',
			actorUserId: userId,
		});

		const userSearchService = getUserSearchService();
		if (userSearchService && 'updateUser' in userSearchService) {
			await userSearchService.updateUser(updatedUser).catch((error) => {
				Logger.error({userId, error}, 'Failed to update user in search index');
			});
		}

		await this.gatewayService.dispatchPresence({
			userId,
			event: 'USER_UPDATE',
			data: mapUserToPrivateResponse(updatedUser),
		});
	}

	async removePhoneFromAccount(userId: UserID): Promise<void> {
		const user = await this.repository.findUniqueAssert(userId);

		this.assertNonBotUser(user);

		if (user.authenticatorTypes?.has(UserAuthenticatorTypes.SMS)) {
			throw new SmsMfaNotEnabledError();
		}

		const updatedUser = await this.repository.patchUpsert(userId, {phone: null}, user.toRow());

		await this.contactChangeLogService.recordDiff({
			oldUser: user,
			newUser: updatedUser,
			reason: 'user_requested',
			actorUserId: userId,
		});

		const userSearchService = getUserSearchService();
		if (userSearchService && 'updateUser' in userSearchService) {
			await userSearchService.updateUser(updatedUser).catch((error) => {
				Logger.error({userId, error}, 'Failed to update user in search index');
			});
		}

		await this.gatewayService.dispatchPresence({
			userId,
			event: 'USER_UPDATE',
			data: mapUserToPrivateResponse(updatedUser),
		});
	}
}
