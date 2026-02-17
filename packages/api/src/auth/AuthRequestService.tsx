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
import type {DesktopHandoffService} from '@fluxer/api/src/auth/services/DesktopHandoffService';
import type {SsoService} from '@fluxer/api/src/auth/services/SsoService';
import type {UserID} from '@fluxer/api/src/BrandedTypes';
import type {RequestCache} from '@fluxer/api/src/middleware/RequestCacheMiddleware';
import type {User} from '@fluxer/api/src/models/User';
import {generateUsernameSuggestions} from '@fluxer/api/src/utils/UsernameSuggestionUtils';
import type {ICacheService} from '@fluxer/cache/src/ICacheService';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import type {
	AuthLoginResponse,
	AuthorizeIpRequest,
	AuthRegisterResponse,
	AuthSessionsResponse,
	AuthTokenWithUserIdResponse,
	EmailRevertRequest,
	ForgotPasswordRequest,
	HandoffCompleteRequest,
	HandoffInitiateResponse,
	HandoffStatusResponse,
	IpAuthorizationPollResponse,
	LoginRequest,
	LogoutAuthSessionsRequest,
	MfaTicketRequest,
	RegisterRequest,
	ResetPasswordRequest,
	SsoCompleteRequest,
	SsoStartRequest,
	UsernameSuggestionsResponse,
	VerifyEmailRequest,
	WebAuthnAuthenticateRequest,
	WebAuthnMfaRequest,
} from '@fluxer/schema/src/domains/auth/AuthSchemas';

interface AuthRegisterRequest {
	data: RegisterRequest;
	request: Request;
	requestCache: RequestCache;
}

interface AuthLoginRequest {
	data: LoginRequest;
	request: Request;
	requestCache: RequestCache;
}

interface AuthForgotPasswordRequest {
	data: ForgotPasswordRequest;
	request: Request;
}

interface AuthResetPasswordRequest {
	data: ResetPasswordRequest;
	request: Request;
}

interface AuthRevertEmailChangeRequest {
	data: EmailRevertRequest;
	request: Request;
}

interface AuthLoginMfaRequest {
	code: string;
	ticket: string;
	request: Request;
}

interface AuthLogoutRequest {
	authorizationHeader?: string;
	authToken?: string;
}

interface AuthHandoffCompleteRequest {
	data: HandoffCompleteRequest;
	request: Request;
}

interface AuthAuthorizeIpRequest {
	data: AuthorizeIpRequest;
}

interface AuthUsernameSuggestionsRequest {
	globalName: string;
}

interface AuthPollIpRequest {
	ticket: string;
}

interface AuthWebAuthnAuthenticateRequest {
	data: WebAuthnAuthenticateRequest;
	request: Request;
}

interface AuthWebAuthnMfaRequest {
	data: WebAuthnMfaRequest;
	request: Request;
}

interface AuthLogoutAuthSessionsRequest {
	user: User;
	data: LogoutAuthSessionsRequest;
}

interface AuthHandoffInitiateRequest {
	userAgent?: string;
}

interface AuthHandoffStatusRequest {
	code: string;
}

export class AuthRequestService {
	constructor(
		private authService: AuthService,
		private ssoService: SsoService,
		private cacheService: ICacheService,
		private desktopHandoffService: DesktopHandoffService,
	) {}

	getSsoStatus() {
		return this.ssoService.getPublicStatus();
	}

	startSso(data: SsoStartRequest) {
		return this.ssoService.startLogin(data.redirect_to ?? undefined);
	}

	completeSso(data: SsoCompleteRequest, request: Request) {
		return this.ssoService.completeLogin({code: data.code, state: data.state, request});
	}

	async register({data, request, requestCache}: AuthRegisterRequest): Promise<AuthRegisterResponse> {
		const result = await this.authService.register({data, request, requestCache});
		return this.toAuthLoginResponse(result);
	}

	async login({data, request, requestCache}: AuthLoginRequest): Promise<AuthLoginResponse> {
		const result = await this.authService.login({data, request, requestCache});
		return this.toAuthLoginResponse(result);
	}

	loginMfaTotp({code, ticket, request}: AuthLoginMfaRequest): Promise<AuthTokenWithUserIdResponse> {
		return this.authService.loginMfaTotp({code, ticket, request});
	}

	async sendSmsMfaCodeForTicket({ticket}: MfaTicketRequest): Promise<void> {
		await this.authService.sendSmsMfaCodeForTicket(ticket);
	}

	loginMfaSms({code, ticket, request}: AuthLoginMfaRequest): Promise<AuthTokenWithUserIdResponse> {
		return this.authService.loginMfaSms({code, ticket, request});
	}

	async logout({authorizationHeader, authToken}: AuthLogoutRequest): Promise<void> {
		const token = authorizationHeader ?? authToken;
		if (token) {
			await this.authService.revokeToken(token);
		}
	}

	async verifyEmail(data: VerifyEmailRequest): Promise<void> {
		const success = await this.authService.verifyEmail(data);
		if (!success) {
			throw InputValidationError.fromCode('token', ValidationErrorCodes.INVALID_OR_EXPIRED_VERIFICATION_TOKEN);
		}
	}

	async resendVerificationEmail(user: User): Promise<void> {
		await this.authService.resendVerificationEmail(user);
	}

	async forgotPassword({data, request}: AuthForgotPasswordRequest): Promise<void> {
		await this.authService.forgotPassword({data, request});
	}

	async resetPassword({data, request}: AuthResetPasswordRequest): Promise<AuthLoginResponse> {
		const result = await this.authService.resetPassword({data, request});
		return this.toAuthLoginResponse(result);
	}

	revertEmailChange({data, request}: AuthRevertEmailChangeRequest): Promise<AuthLoginResponse> {
		return this.authService.revertEmailChange({data, request});
	}

	getAuthSessions(userId: UserID): Promise<AuthSessionsResponse> {
		return this.authService.getAuthSessions(userId);
	}

	async logoutAuthSessions({user, data}: AuthLogoutAuthSessionsRequest): Promise<void> {
		await this.authService.logoutAuthSessions({
			user,
			sessionIdHashes: data.session_id_hashes,
		});
	}

	async completeIpAuthorization({data}: AuthAuthorizeIpRequest): Promise<void> {
		const result = await this.authService.completeIpAuthorization(data.token);
		const payload = JSON.stringify({token: result.token, user_id: result.user_id});
		await this.cacheService.set(`ip-auth-result:${result.ticket}`, payload, 60);
	}

	async resendIpAuthorization({ticket}: MfaTicketRequest): Promise<void> {
		await this.authService.resendIpAuthorization(ticket);
	}

	async pollIpAuthorization({ticket}: AuthPollIpRequest): Promise<IpAuthorizationPollResponse> {
		const result = await this.cacheService.get<string>(`ip-auth-result:${ticket}`);
		if (result) {
			const parsed = JSON.parse(result) as {token: string; user_id: string};
			return {
				completed: true,
				token: parsed.token,
				user_id: parsed.user_id,
			};
		}

		const ticketPayload = await this.cacheService.get(`ip-auth-ticket:${ticket}`);
		if (!ticketPayload) {
			throw InputValidationError.fromCode('ticket', ValidationErrorCodes.INVALID_OR_EXPIRED_AUTHORIZATION_TICKET);
		}

		return {completed: false};
	}

	async getWebAuthnAuthenticationOptions() {
		return this.authService.generateWebAuthnAuthenticationOptionsDiscoverable();
	}

	async authenticateWebAuthnDiscoverable({data, request}: AuthWebAuthnAuthenticateRequest) {
		const user = await this.authService.verifyWebAuthnAuthenticationDiscoverable(data.response, data.challenge);
		const [token] = await this.authService.createAuthSession({user, request});
		return {token, user_id: user.id.toString()};
	}

	async getWebAuthnMfaOptions({ticket}: MfaTicketRequest) {
		return this.authService.generateWebAuthnAuthenticationOptionsForMfa(ticket);
	}

	loginMfaWebAuthn({data, request}: AuthWebAuthnMfaRequest): Promise<AuthTokenWithUserIdResponse> {
		return this.authService.loginMfaWebAuthn({
			response: data.response,
			challenge: data.challenge,
			ticket: data.ticket,
			request,
		});
	}

	getUsernameSuggestions({globalName}: AuthUsernameSuggestionsRequest): UsernameSuggestionsResponse {
		return {suggestions: generateUsernameSuggestions(globalName)};
	}

	async initiateHandoff({userAgent}: AuthHandoffInitiateRequest): Promise<HandoffInitiateResponse> {
		const result = await this.desktopHandoffService.initiateHandoff(userAgent);
		return {
			code: result.code,
			expires_at: result.expiresAt.toISOString(),
		};
	}

	async completeHandoff({data, request}: AuthHandoffCompleteRequest): Promise<void> {
		const {token: handoffToken, userId} = await this.authService.createAdditionalAuthSessionFromToken({
			token: data.token,
			expectedUserId: data.user_id,
			request,
		});

		await this.desktopHandoffService.completeHandoff(data.code, handoffToken, userId);
	}

	async getHandoffStatus({code}: AuthHandoffStatusRequest): Promise<HandoffStatusResponse> {
		const result = await this.desktopHandoffService.getHandoffStatus(code);
		return {
			status: result.status,
			token: result.token,
			user_id: result.userId,
		};
	}

	async cancelHandoff({code}: AuthHandoffStatusRequest): Promise<void> {
		await this.desktopHandoffService.cancelHandoff(code);
	}

	private toAuthLoginResponse(
		result:
			| {user_id: string; token: string}
			| {mfa: true; ticket: string; allowed_methods: Array<string>; sms_phone_hint: string | null},
	): AuthLoginResponse {
		if (!('mfa' in result)) {
			return result;
		}

		const allowedMethods = new Set(result.allowed_methods);
		return {
			...result,
			sms: allowedMethods.has('sms'),
			totp: allowedMethods.has('totp'),
			webauthn: allowedMethods.has('webauthn'),
		};
	}
}
