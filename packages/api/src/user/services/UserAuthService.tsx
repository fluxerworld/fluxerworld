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
import {createEmailVerificationToken} from '@fluxer/api/src/BrandedTypes';
import type {IGatewayService} from '@fluxer/api/src/infrastructure/IGatewayService';
import type {MfaBackupCode} from '@fluxer/api/src/models/MfaBackupCode';
import type {User} from '@fluxer/api/src/models/User';
import type {BotMfaMirrorService} from '@fluxer/api/src/oauth/BotMfaMirrorService';
import type {IUserAccountRepository} from '@fluxer/api/src/user/repositories/IUserAccountRepository';
import type {IUserAuthRepository} from '@fluxer/api/src/user/repositories/IUserAuthRepository';
import {mapUserToPrivateResponse} from '@fluxer/api/src/user/UserMappers';
import * as RandomUtils from '@fluxer/api/src/utils/RandomUtils';
import {UserAuthenticatorTypes} from '@fluxer/constants/src/UserConstants';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import type {IEmailService} from '@fluxer/email/src/IEmailService';
import {MfaNotDisabledError} from '@fluxer/errors/src/domains/auth/MfaNotDisabledError';
import {MfaNotEnabledError} from '@fluxer/errors/src/domains/auth/MfaNotEnabledError';
import {SudoModeRequiredError} from '@fluxer/errors/src/domains/auth/SudoModeRequiredError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';

export class UserAuthService {
	constructor(
		private userAccountRepository: IUserAccountRepository,
		private userAuthRepository: IUserAuthRepository,
		private authService: AuthService,
		private emailService: IEmailService,
		private gatewayService: IGatewayService,
		private botMfaMirrorService?: BotMfaMirrorService,
	) {}

	async enableMfaTotp(params: {
		user: User;
		secret: string;
		code: string;
		sudoContext: SudoVerificationResult;
	}): Promise<Array<MfaBackupCode>> {
		const {user, secret, code, sudoContext} = params;
		const identityVerifiedViaSudo = sudoContext.method === 'mfa' || sudoContext.method === 'sudo_token';
		const identityVerifiedViaPassword = sudoContext.method === 'password';
		const hasMfa = userHasMfa(user);
		if (!identityVerifiedViaSudo && !identityVerifiedViaPassword) {
			throw new SudoModeRequiredError(hasMfa);
		}
		if (user.totpSecret) throw new MfaNotDisabledError();

		const userId = user.id;
		if (!(await this.authService.verifyMfaCode({userId: user.id, mfaSecret: secret, code}))) {
			throw InputValidationError.fromCode('code', ValidationErrorCodes.INVALID_CODE);
		}

		const authenticatorTypes = user.authenticatorTypes || new Set<number>();
		authenticatorTypes.add(UserAuthenticatorTypes.TOTP);
		const updatedUser = await this.userAccountRepository.patchUpsert(
			userId,
			{
				totp_secret: secret,
				authenticator_types: authenticatorTypes,
			},
			user.toRow(),
		);
		const newBackupCodes = this.authService.generateBackupCodes();
		const mfaBackupCodes = await this.userAuthRepository.createMfaBackupCodes(userId, newBackupCodes);
		await this.dispatchUserUpdate(updatedUser);
		if (updatedUser) {
			await this.botMfaMirrorService?.syncAuthenticatorTypesForOwner(updatedUser);
		}
		return mfaBackupCodes;
	}

	async disableMfaTotp(params: {user: User; code: string; sudoContext: SudoVerificationResult}): Promise<void> {
		const {user, code, sudoContext} = params;
		if (!user.totpSecret) throw new MfaNotEnabledError();

		const identityVerifiedViaSudo = sudoContext.method === 'mfa' || sudoContext.method === 'sudo_token';
		const identityVerifiedViaPassword = sudoContext.method === 'password';
		const hasMfa = userHasMfa(user);
		if (!identityVerifiedViaSudo && !identityVerifiedViaPassword) {
			throw new SudoModeRequiredError(hasMfa);
		}

		if (
			!(await this.authService.verifyMfaCode({
				userId: user.id,
				mfaSecret: user.totpSecret,
				code,
				allowBackup: true,
			}))
		) {
			throw InputValidationError.fromCode('code', ValidationErrorCodes.INVALID_CODE);
		}

		const userId = user.id;

		const authenticatorTypes = user.authenticatorTypes || new Set<number>();
		authenticatorTypes.delete(UserAuthenticatorTypes.TOTP);
		const hasSms = authenticatorTypes.has(UserAuthenticatorTypes.SMS);
		if (hasSms) {
			authenticatorTypes.delete(UserAuthenticatorTypes.SMS);
		}

		const updatedUser = await this.userAccountRepository.patchUpsert(
			userId,
			{
				totp_secret: null,
				authenticator_types: authenticatorTypes,
			},
			user.toRow(),
		);
		await this.userAuthRepository.clearMfaBackupCodes(userId);
		await this.dispatchUserUpdate(updatedUser);
		await this.botMfaMirrorService?.syncAuthenticatorTypesForOwner(updatedUser);
	}

	async getMfaBackupCodes(params: {
		user: User;
		regenerate: boolean;
		sudoContext: SudoVerificationResult;
	}): Promise<Array<MfaBackupCode>> {
		const {user, regenerate, sudoContext} = params;
		const identityVerifiedViaSudo = sudoContext.method === 'mfa' || sudoContext.method === 'sudo_token';
		const identityVerifiedViaPassword = sudoContext.method === 'password';
		const hasMfa = userHasMfa(user);
		if (!identityVerifiedViaSudo && !identityVerifiedViaPassword) {
			throw new SudoModeRequiredError(hasMfa);
		}

		if (regenerate) {
			return this.regenerateMfaBackupCodes(user);
		}

		return await this.userAuthRepository.listMfaBackupCodes(user.id);
	}

	async regenerateMfaBackupCodes(user: User): Promise<Array<MfaBackupCode>> {
		const userId = user.id;
		const newBackupCodes = this.authService.generateBackupCodes();
		await this.userAuthRepository.clearMfaBackupCodes(userId);
		return await this.userAuthRepository.createMfaBackupCodes(userId, newBackupCodes);
	}

	async verifyEmail(token: string): Promise<boolean> {
		const emailToken = await this.userAuthRepository.getEmailVerificationToken(token);
		if (!emailToken) {
			return false;
		}
		const user = await this.userAccountRepository.findUnique(emailToken.userId);
		if (!user) {
			return false;
		}
		const updatedUser = await this.userAccountRepository.patchUpsert(
			emailToken.userId,
			{
				email: emailToken.email,
				email_verified: true,
			},
			user.toRow(),
		);
		await this.userAuthRepository.deleteEmailVerificationToken(token);
		await this.dispatchUserUpdate(updatedUser);
		return true;
	}

	async resendVerificationEmail(user: User): Promise<boolean> {
		if (user.emailVerified) {
			return true;
		}
		const email = user.email;
		if (!email) {
			return false;
		}
		const verificationToken = createEmailVerificationToken(RandomUtils.randomString(64));
		await this.userAuthRepository.createEmailVerificationToken({
			token_: verificationToken,
			user_id: user.id,
			email,
		});
		await this.emailService.sendEmailVerification(email, user.username, verificationToken, user.locale);
		return true;
	}

	async dispatchUserUpdate(user: User): Promise<void> {
		await this.gatewayService.dispatchPresence({
			userId: user.id,
			event: 'USER_UPDATE',
			data: mapUserToPrivateResponse(user),
		});
	}
}
