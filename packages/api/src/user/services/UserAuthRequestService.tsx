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
import type {SudoVerificationResult} from '@fluxer/api/src/auth/services/SudoVerificationService';
import type {User} from '@fluxer/api/src/models/User';
import type {IUserRepository} from '@fluxer/api/src/user/IUserRepository';
import type {UserService} from '@fluxer/api/src/user/services/UserService';
import type {
	DisableTotpRequest,
	EnableMfaTotpRequest,
	MfaBackupCodesRequest,
	MfaBackupCodesResponse,
	PhoneAddRequest,
	PhoneSendVerificationRequest,
	PhoneVerifyRequest,
	PhoneVerifyResponse,
	SudoMfaMethodsResponse,
	WebAuthnChallengeResponse,
	WebAuthnCredentialListResponse,
	WebAuthnCredentialUpdateRequest,
	WebAuthnRegisterRequest,
} from '@fluxer/schema/src/domains/auth/AuthSchemas';

interface UserAuthWithSudoRequest<T> {
	user: User;
	data: T;
	sudoContext: SudoVerificationResult;
}

interface UserAuthRequest<T> {
	user: User;
	data: T;
}

interface UserAuthPhoneTokenRequest {
	user: User;
	data: PhoneAddRequest;
}

interface UserAuthWebAuthnUpdateRequest {
	user: User;
	credentialId: string;
	data: WebAuthnCredentialUpdateRequest;
}

interface UserAuthWebAuthnRegisterRequest {
	user: User;
	data: WebAuthnRegisterRequest;
}

interface UserAuthWebAuthnDeleteRequest {
	user: User;
	credentialId: string;
}

export class UserAuthRequestService {
	constructor(
		private authService: AuthService,
		private authMfaService: AuthMfaService,
		private userService: UserService,
		private userRepository: IUserRepository,
	) {}

	async enableTotp({
		user,
		data,
		sudoContext,
	}: UserAuthWithSudoRequest<EnableMfaTotpRequest>): Promise<MfaBackupCodesResponse> {
		const backupCodes = await this.userService.enableMfaTotp({
			user,
			secret: data.secret,
			code: data.code,
			sudoContext,
		});
		return this.toBackupCodesResponse(backupCodes);
	}

	async disableTotp({user, data, sudoContext}: UserAuthWithSudoRequest<DisableTotpRequest>): Promise<void> {
		await this.userService.disableMfaTotp({
			user,
			code: data.code,
			sudoContext,
			password: data.password,
		});
	}

	async getBackupCodes({
		user,
		data,
		sudoContext,
	}: UserAuthWithSudoRequest<MfaBackupCodesRequest>): Promise<MfaBackupCodesResponse> {
		const backupCodes = await this.userService.getMfaBackupCodes({
			user,
			regenerate: data.regenerate,
			sudoContext,
			password: data.password,
		});
		return this.toBackupCodesResponse(backupCodes);
	}

	async sendPhoneVerificationCode({user, data}: UserAuthRequest<PhoneSendVerificationRequest>): Promise<void> {
		await this.authService.sendPhoneVerificationCode(data.phone, user.id);
	}

	async verifyPhoneCode({user, data}: UserAuthRequest<PhoneVerifyRequest>): Promise<PhoneVerifyResponse> {
		const phoneToken = await this.authService.verifyPhoneCode(data.phone, data.code, user.id);
		return {phone_token: phoneToken};
	}

	async addPhoneToAccount({user, data}: UserAuthPhoneTokenRequest): Promise<void> {
		await this.authService.addPhoneToAccount(user.id, data.phone_token);
	}

	async removePhoneFromAccount(user: User): Promise<void> {
		await this.authService.removePhoneFromAccount(user.id);
	}

	async enableSmsMfa(user: User): Promise<void> {
		await this.authService.enableSmsMfa(user.id);
	}

	async disableSmsMfa(user: User): Promise<void> {
		await this.authService.disableSmsMfa(user.id);
	}

	async forgetAuthorizedIps(user: User): Promise<void> {
		await this.userRepository.deleteAllAuthorizedIps(user.id);
	}

	async listWebAuthnCredentials(user: User): Promise<WebAuthnCredentialListResponse> {
		const credentials = await this.userRepository.listWebAuthnCredentials(user.id);
		return credentials.map((cred) => ({
			id: cred.credentialId,
			name: cred.name,
			created_at: cred.createdAt.toISOString(),
			last_used_at: cred.lastUsedAt?.toISOString() ?? null,
		}));
	}

	async generateWebAuthnRegistrationOptions(user: User): Promise<WebAuthnChallengeResponse> {
		const options = await this.authService.generateWebAuthnRegistrationOptions(user.id);
		return this.toWebAuthnChallengeResponse(options);
	}

	async registerWebAuthnCredential({user, data}: UserAuthWebAuthnRegisterRequest): Promise<void> {
		await this.authService.verifyWebAuthnRegistration(user.id, data.response, data.challenge, data.name);
	}

	async renameWebAuthnCredential({user, credentialId, data}: UserAuthWebAuthnUpdateRequest): Promise<void> {
		await this.authService.renameWebAuthnCredential(user.id, credentialId, data.name);
	}

	async deleteWebAuthnCredential({user, credentialId}: UserAuthWebAuthnDeleteRequest): Promise<void> {
		await this.authService.deleteWebAuthnCredential(user.id, credentialId);
	}

	async listSudoMfaMethods(user: User): Promise<SudoMfaMethodsResponse> {
		return this.authMfaService.getAvailableMfaMethods(user.id);
	}

	async sendSudoSmsCode(user: User): Promise<void> {
		await this.authService.sendSmsMfaCode(user.id);
	}

	async getSudoWebAuthnOptions(user: User): Promise<WebAuthnChallengeResponse> {
		const options = await this.authMfaService.generateWebAuthnOptionsForSudo(user.id);
		return this.toWebAuthnChallengeResponse(options);
	}

	private toWebAuthnChallengeResponse(options: {challenge: string}): WebAuthnChallengeResponse {
		const response: Record<string, unknown> & {challenge: string} = {
			...options,
			challenge: options.challenge,
		};
		return response;
	}

	private toBackupCodesResponse(backupCodes: Array<{code: string; consumed: boolean}>): MfaBackupCodesResponse {
		return {
			backup_codes: backupCodes.map((code) => ({
				code: code.code,
				consumed: code.consumed,
			})),
		};
	}
}
