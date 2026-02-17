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

import crypto from 'node:crypto';
import {promisify} from 'node:util';
import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {User} from '@fluxer/api/src/models/User';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import * as AgeUtils from '@fluxer/api/src/utils/AgeUtils';
import * as RandomUtils from '@fluxer/api/src/utils/RandomUtils';
import {UserFlags} from '@fluxer/constants/src/UserConstants';
import {BotUserAuthEndpointAccessDeniedError} from '@fluxer/errors/src/domains/auth/BotUserAuthEndpointAccessDeniedError';
import {AccountPermanentlySuspendedError} from '@fluxer/errors/src/domains/user/AccountPermanentlySuspendedError';
import {AccountTemporarilySuspendedError} from '@fluxer/errors/src/domains/user/AccountTemporarilySuspendedError';
import type {IRateLimitService} from '@fluxer/rate_limit/src/IRateLimitService';
import {ms} from 'itty-time';

const randomBytesAsync = promisify(crypto.randomBytes);
const ALPHANUMERIC_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function base62Encode(buffer: Uint8Array): string {
	let num = BigInt(`0x${Buffer.from(buffer).toString('hex')}`);
	const base = BigInt(ALPHANUMERIC_CHARS.length);
	let encoded = '';
	while (num > 0) {
		const remainder = num % base;
		encoded = ALPHANUMERIC_CHARS[Number(remainder)] + encoded;
		num = num / base;
	}
	return encoded;
}

interface ValidateAgeParams {
	dateOfBirth: string;
	minAge: number;
}

interface CheckEmailChangeRateLimitParams {
	userId: UserID;
}

export class AuthUtilityService {
	constructor(
		private repository: IUserRepository,
		private rateLimitService: IRateLimitService,
	) {}

	async generateSecureToken(length = 64): Promise<string> {
		return RandomUtils.randomString(length);
	}

	async generateAuthToken(): Promise<string> {
		const bytes = await randomBytesAsync(27);
		let token = base62Encode(new Uint8Array(bytes));

		while (token.length < 36) {
			const extraBytes = await randomBytesAsync(1);
			token += ALPHANUMERIC_CHARS[extraBytes[0] % ALPHANUMERIC_CHARS.length];
		}

		if (token.length > 36) {
			token = token.slice(0, 36);
		}

		return `flx_${token}`;
	}

	generateBackupCodes(): Array<string> {
		return Array.from({length: 10}, () => {
			return `${RandomUtils.randomString(4).toLowerCase()}-${RandomUtils.randomString(4).toLowerCase()}`;
		});
	}

	getTokenIdHash(token: string): Uint8Array {
		return new Uint8Array(crypto.createHash('sha256').update(token).digest());
	}

	async checkEmailChangeRateLimit({
		userId,
	}: CheckEmailChangeRateLimitParams): Promise<{allowed: boolean; retryAfter?: number}> {
		const rateLimit = await this.rateLimitService.checkLimit({
			identifier: `email_change:${userId}`,
			maxAttempts: 3,
			windowMs: ms('1 hour'),
		});

		return {
			allowed: rateLimit.allowed,
			retryAfter: rateLimit.retryAfter,
		};
	}

	validateAge({dateOfBirth, minAge}: ValidateAgeParams): boolean {
		const birthDate = new Date(dateOfBirth);
		const age = AgeUtils.calculateAge({
			year: birthDate.getFullYear(),
			month: birthDate.getMonth() + 1,
			day: birthDate.getDate(),
		});
		return age >= minAge;
	}

	assertNonBotUser(user: User): void {
		if (user.isBot) {
			throw new BotUserAuthEndpointAccessDeniedError();
		}
	}

	async authorizeIpByToken(token: string): Promise<{userId: UserID; email: string} | null> {
		return this.repository.authorizeIpByToken(token);
	}

	checkAccountBanStatus(user: User): {
		isPermanentlyBanned: boolean;
		isTempBanned: boolean;
		tempBanExpired: boolean;
	} {
		const isPermanentlyBanned = !!(user.flags & UserFlags.DELETED);
		const hasTempBan = !!(user.flags & UserFlags.DISABLED && user.tempBannedUntil);
		const tempBanExpired = hasTempBan && user.tempBannedUntil! <= new Date();

		return {
			isPermanentlyBanned,
			isTempBanned: hasTempBan && !tempBanExpired,
			tempBanExpired,
		};
	}

	async handleBanStatus(user: User): Promise<User> {
		const banStatus = this.checkAccountBanStatus(user);

		if (banStatus.isPermanentlyBanned) {
			throw new AccountPermanentlySuspendedError();
		}

		if (banStatus.isTempBanned) {
			throw new AccountTemporarilySuspendedError();
		}

		if (banStatus.tempBanExpired) {
			const updatedUser = await this.repository.patchUpsert(
				user.id,
				{
					flags: user.flags & ~UserFlags.DISABLED,
					temp_banned_until: null,
				},
				user.toRow(),
			);

			return updatedUser;
		}

		return user;
	}
}
