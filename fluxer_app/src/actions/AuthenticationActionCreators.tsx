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

import {Endpoints} from '@app/Endpoints';
import type {UserData} from '@app/lib/AccountStorage';
import http from '@app/lib/HttpClient';
import {HttpError} from '@app/lib/HttpError';
import {Logger} from '@app/lib/Logger';
import AccountManager from '@app/stores/AccountManager';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import GatewayConnectionStore from '@app/stores/gateway/GatewayConnectionStore';
import {getApiErrorCode} from '@app/utils/ApiErrorUtils';
import {isDesktop} from '@app/utils/NativeUtils';
import {APIErrorCodes} from '@fluxer/constants/src/ApiErrorCodes';
import type {ValueOf} from '@fluxer/constants/src/ValueOf';
import type {AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON} from '@simplewebauthn/browser';

const logger = new Logger('AuthService');

const getPlatformHeaderValue = (): 'web' | 'desktop' | 'mobile' => (isDesktop() ? 'desktop' : 'web');
const withPlatformHeader = (headers?: Record<string, string>): Record<string, string> => ({
	'X-Fluxer-Platform': getPlatformHeaderValue(),
	...(headers ?? {}),
});

export const VerificationResult = {
	SUCCESS: 'SUCCESS',
	EXPIRED_TOKEN: 'EXPIRED_TOKEN',
	RATE_LIMITED: 'RATE_LIMITED',
	SERVER_ERROR: 'SERVER_ERROR',
} as const;
export type VerificationResult = ValueOf<typeof VerificationResult>;

interface RegisterData {
	email?: string;
	global_name?: string;
	username?: string;
	password?: string;
	date_of_birth: string;
	consent: boolean;
	captchaToken?: string;
	captchaType?: 'turnstile' | 'hcaptcha';
	invite_code?: string;
}

interface StandardLoginResponse {
	mfa: false;
	user_id: string;
	token: string;
	theme?: string;
}

interface MfaLoginResponse {
	mfa: true;
	ticket: string;
	sms: boolean;
	totp: boolean;
	webauthn: boolean;
	allowed_methods?: Array<string>;
	sms_phone_hint?: string | null;
}

type LoginResponse = StandardLoginResponse | MfaLoginResponse;

export interface IpAuthorizationRequiredResponse {
	ip_authorization_required: true;
	ticket: string;
	email: string;
	resend_available_in: number;
}

export function isIpAuthorizationRequiredResponse(
	response: LoginResponse | IpAuthorizationRequiredResponse,
): response is IpAuthorizationRequiredResponse {
	return (response as IpAuthorizationRequiredResponse).ip_authorization_required === true;
}

interface TokenResponse {
	user_id: string;
	token: string;
	theme?: string;
	redirect_to?: string;
}

export type ResetPasswordResponse = TokenResponse | MfaLoginResponse;

interface DesktopHandoffInitiateResponse {
	code: string;
	expires_at: string;
}

interface DesktopHandoffStatusResponse {
	status: 'pending' | 'completed' | 'expired';
	token?: string;
	user_id?: string;
}

export async function login({
	email,
	password,
	captchaToken,
	inviteCode,
	captchaType,
}: {
	email: string;
	password: string;
	captchaToken?: string;
	inviteCode?: string;
	captchaType?: 'turnstile' | 'hcaptcha';
}): Promise<LoginResponse | IpAuthorizationRequiredResponse> {
	try {
		const headers: Record<string, string> = {};
		if (captchaToken) {
			headers['X-Captcha-Token'] = captchaToken;
			headers['X-Captcha-Type'] = captchaType || 'hcaptcha';
		}
		const body: {
			email: string;
			password: string;
			invite_code?: string;
		} = {email, password};
		if (inviteCode) {
			body.invite_code = inviteCode;
		}
		const response = await http.post<LoginResponse>({
			url: Endpoints.AUTH_LOGIN,
			body,
			headers: withPlatformHeader(headers),
		});
		logger.debug('Login successful', {mfa: response.body?.mfa});
		return response.body;
	} catch (error) {
		if (
			error instanceof HttpError &&
			error.status === 403 &&
			getApiErrorCode(error) === APIErrorCodes.IP_AUTHORIZATION_REQUIRED
		) {
			logger.info('Login requires IP authorization', {email});
			const body = error.body as Record<string, unknown> | undefined;
			return {
				ip_authorization_required: true,
				ticket: body?.ticket as string,
				email: body?.email as string,
				resend_available_in: (body?.resend_available_in as number) ?? 30,
			};
		}
		logger.error('Login failed', error);
		throw error;
	}
}

export async function loginMfaTotp(code: string, ticket: string, inviteCode?: string): Promise<TokenResponse> {
	try {
		const body: {
			code: string;
			ticket: string;
			invite_code?: string;
		} = {code, ticket};
		if (inviteCode) {
			body.invite_code = inviteCode;
		}
		const response = await http.post<TokenResponse>({
			url: Endpoints.AUTH_LOGIN_MFA_TOTP,
			body,
			headers: withPlatformHeader(),
		});
		const responseBody = response.body;
		logger.debug('MFA TOTP authentication successful');
		return responseBody;
	} catch (error) {
		logger.error('MFA TOTP authentication failed', error);
		throw error;
	}
}

export async function loginMfaSmsSend(ticket: string): Promise<void> {
	try {
		await http.post({
			url: Endpoints.AUTH_LOGIN_MFA_SMS_SEND,
			body: {ticket},
			headers: withPlatformHeader(),
		});
		logger.debug('SMS MFA code sent');
	} catch (error) {
		logger.error('Failed to send SMS MFA code', error);
		throw error;
	}
}

export async function loginMfaSms(code: string, ticket: string, inviteCode?: string): Promise<TokenResponse> {
	try {
		const body: {
			code: string;
			ticket: string;
			invite_code?: string;
		} = {code, ticket};
		if (inviteCode) {
			body.invite_code = inviteCode;
		}
		const response = await http.post<TokenResponse>({
			url: Endpoints.AUTH_LOGIN_MFA_SMS,
			body,
			headers: withPlatformHeader(),
		});
		const responseBody = response.body;
		logger.debug('MFA SMS authentication successful');
		return responseBody;
	} catch (error) {
		logger.error('MFA SMS authentication failed', error);
		throw error;
	}
}

export async function loginMfaWebAuthn(
	response: AuthenticationResponseJSON,
	challenge: string,
	ticket: string,
	inviteCode?: string,
): Promise<TokenResponse> {
	try {
		const body: {
			response: AuthenticationResponseJSON;
			challenge: string;
			ticket: string;
			invite_code?: string;
		} = {response, challenge, ticket};
		if (inviteCode) {
			body.invite_code = inviteCode;
		}
		const httpResponse = await http.post<TokenResponse>({
			url: Endpoints.AUTH_LOGIN_MFA_WEBAUTHN,
			body,
			headers: withPlatformHeader(),
		});
		const responseBody = httpResponse.body;
		logger.debug('MFA WebAuthn authentication successful');
		return responseBody;
	} catch (error) {
		logger.error('MFA WebAuthn authentication failed', error);
		throw error;
	}
}

export async function getWebAuthnMfaOptions(ticket: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
	try {
		const response = await http.post<PublicKeyCredentialRequestOptionsJSON>({
			url: Endpoints.AUTH_LOGIN_MFA_WEBAUTHN_OPTIONS,
			body: {ticket},
			headers: withPlatformHeader(),
		});
		const responseBody = response.body;
		logger.debug('WebAuthn MFA options retrieved');
		return responseBody;
	} catch (error) {
		logger.error('Failed to get WebAuthn MFA options', error);
		throw error;
	}
}

export async function getWebAuthnAuthenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
	try {
		const response = await http.post<PublicKeyCredentialRequestOptionsJSON>({
			url: Endpoints.AUTH_WEBAUTHN_OPTIONS,
			headers: withPlatformHeader(),
		});
		const responseBody = response.body;
		logger.debug('WebAuthn authentication options retrieved');
		return responseBody;
	} catch (error) {
		logger.error('Failed to get WebAuthn authentication options', error);
		throw error;
	}
}

export async function authenticateWithWebAuthn(
	response: AuthenticationResponseJSON,
	challenge: string,
	inviteCode?: string,
): Promise<TokenResponse> {
	try {
		const body: {
			response: AuthenticationResponseJSON;
			challenge: string;
			invite_code?: string;
		} = {response, challenge};
		if (inviteCode) {
			body.invite_code = inviteCode;
		}
		const httpResponse = await http.post<TokenResponse>({
			url: Endpoints.AUTH_WEBAUTHN_AUTHENTICATE,
			body,
			headers: withPlatformHeader(),
		});
		const responseBody = httpResponse.body;
		logger.debug('WebAuthn authentication successful');
		return responseBody;
	} catch (error) {
		logger.error('WebAuthn authentication failed', error);
		throw error;
	}
}

export async function register(data: RegisterData): Promise<TokenResponse> {
	try {
		const headers: Record<string, string> = {};
		if (data.captchaToken) {
			headers['X-Captcha-Token'] = data.captchaToken;
			headers['X-Captcha-Type'] = data.captchaType || 'hcaptcha';
		}
		const {captchaToken: _, captchaType: __, ...bodyData} = data;
		const response = await http.post<TokenResponse>({
			url: Endpoints.AUTH_REGISTER,
			body: bodyData,
			headers: withPlatformHeader(headers),
		});
		const responseBody = response.body;
		logger.info('Registration successful');
		return responseBody;
	} catch (error) {
		logger.error('Registration failed', error);
		throw error;
	}
}

interface UsernameSuggestionsResponse {
	suggestions: Array<string>;
}

export async function getUsernameSuggestions(globalName: string): Promise<Array<string>> {
	try {
		const response = await http.post<UsernameSuggestionsResponse>({
			url: Endpoints.AUTH_USERNAME_SUGGESTIONS,
			body: {global_name: globalName},
			headers: withPlatformHeader(),
		});
		const responseBody = response.body;
		logger.debug('Username suggestions retrieved', {count: responseBody?.suggestions?.length || 0});
		return responseBody?.suggestions ?? [];
	} catch (error) {
		logger.error('Failed to fetch username suggestions', error);
		throw error;
	}
}

export async function forgotPassword(
	email: string,
	captchaToken?: string,
	captchaType?: 'turnstile' | 'hcaptcha',
): Promise<void> {
	try {
		const headers: Record<string, string> = {};
		if (captchaToken) {
			headers['X-Captcha-Token'] = captchaToken;
			headers['X-Captcha-Type'] = captchaType || 'hcaptcha';
		}
		await http.post({
			url: Endpoints.AUTH_FORGOT_PASSWORD,
			body: {email},
			headers: withPlatformHeader(headers),
		});
		logger.debug('Password reset email sent');
	} catch (error) {
		logger.warn('Password reset request failed, but returning success to user', error);
	}
}

export async function resetPassword(token: string, password: string): Promise<ResetPasswordResponse> {
	try {
		const response = await http.post<ResetPasswordResponse>({
			url: Endpoints.AUTH_RESET_PASSWORD,
			body: {token, password},
			headers: withPlatformHeader(),
		});
		const responseBody = response.body;
		logger.info('Password reset successful');
		return responseBody;
	} catch (error) {
		logger.error('Password reset failed', error);
		throw error;
	}
}

export async function revertEmailChange(token: string, password: string): Promise<TokenResponse> {
	try {
		const response = await http.post<TokenResponse>({
			url: Endpoints.AUTH_EMAIL_REVERT,
			body: {token, password},
			headers: withPlatformHeader(),
		});
		const responseBody = response.body;
		logger.info('Email revert successful');
		return responseBody;
	} catch (error) {
		logger.error('Email revert failed', error);
		throw error;
	}
}

export async function verifyEmail(token: string): Promise<VerificationResult> {
	try {
		await http.post({
			url: Endpoints.AUTH_VERIFY_EMAIL,
			body: {token},
			headers: withPlatformHeader(),
		});
		logger.info('Email verification successful');
		return VerificationResult.SUCCESS;
	} catch (error) {
		const httpError = error as {status?: number};
		if (httpError.status === 400) {
			logger.warn('Email verification failed - expired or invalid token');
			return VerificationResult.EXPIRED_TOKEN;
		}
		logger.error('Email verification failed - server error', error);
		return VerificationResult.SERVER_ERROR;
	}
}

export async function resendVerificationEmail(): Promise<VerificationResult> {
	try {
		await http.post({
			url: Endpoints.AUTH_RESEND_VERIFICATION,
			headers: withPlatformHeader(),
		});
		logger.info('Verification email resent');
		return VerificationResult.SUCCESS;
	} catch (error) {
		const httpError = error as {status?: number};
		if (httpError.status === 429) {
			logger.warn('Rate limited when resending verification email');
			return VerificationResult.RATE_LIMITED;
		}
		logger.error('Failed to resend verification email - server error', error);
		return VerificationResult.SERVER_ERROR;
	}
}

export async function logout(): Promise<void> {
	await AccountManager.logout();
}

export async function authorizeIp(token: string): Promise<VerificationResult> {
	try {
		await http.post({
			url: Endpoints.AUTH_AUTHORIZE_IP,
			body: {token},
			headers: withPlatformHeader(),
		});
		logger.info('IP authorization successful');
		return VerificationResult.SUCCESS;
	} catch (error) {
		const httpError = error as {status?: number};
		if (httpError.status === 400) {
			logger.warn('IP authorization failed - expired or invalid token');
			return VerificationResult.EXPIRED_TOKEN;
		}
		logger.error('IP authorization failed - server error', error);
		return VerificationResult.SERVER_ERROR;
	}
}

export async function resendIpAuthorization(ticket: string): Promise<void> {
	await http.post({
		url: Endpoints.AUTH_IP_AUTHORIZATION_RESEND,
		body: {ticket},
		headers: withPlatformHeader(),
	});
}

export interface IpAuthorizationPollResult {
	completed: boolean;
	token?: string;
	user_id?: string;
}

export async function pollIpAuthorization(ticket: string): Promise<IpAuthorizationPollResult> {
	const response = await http.get<IpAuthorizationPollResult>({
		url: Endpoints.AUTH_IP_AUTHORIZATION_POLL(ticket),
		headers: withPlatformHeader(),
	});
	return response.body;
}

export async function initiateDesktopHandoff(): Promise<DesktopHandoffInitiateResponse> {
	const response = await http.post<DesktopHandoffInitiateResponse>({
		url: Endpoints.AUTH_HANDOFF_INITIATE,
		skipAuth: true,
	});
	return response.body;
}

export async function pollDesktopHandoffStatus(code: string): Promise<DesktopHandoffStatusResponse> {
	const response = await http.get<DesktopHandoffStatusResponse>({
		url: Endpoints.AUTH_HANDOFF_STATUS(code),
		skipAuth: true,
	});
	return response.body;
}

export async function completeDesktopHandoff({
	code,
	token,
	userId,
}: {
	code: string;
	token: string;
	userId: string;
}): Promise<void> {
	await http.post({
		url: Endpoints.AUTH_HANDOFF_COMPLETE,
		body: {code, token, user_id: userId},
		skipAuth: true,
	});
}

export function startSession(token: string, options: {startGateway?: boolean} = {}): void {
	const {startGateway = true} = options;

	logger.info('Starting new session');
	AuthenticationStore.handleSessionStart({token});

	if (!startGateway) {
		return;
	}

	GatewayConnectionStore.startSession(token);
}

let sessionStartInProgress = false;

export async function ensureSessionStarted(): Promise<void> {
	if (sessionStartInProgress) {
		return;
	}

	if (AccountManager.isSwitching) {
		return;
	}

	if (!AuthenticationStore.isAuthenticated) {
		return;
	}

	if (GatewayConnectionStore.isConnected || GatewayConnectionStore.isConnecting) {
		return;
	}

	if (GatewayConnectionStore.socket) {
		return;
	}

	sessionStartInProgress = true;

	try {
		logger.info('Ensuring session is started');

		const token = AuthenticationStore.authToken;
		if (token) {
			GatewayConnectionStore.startSession(token);
		}
	} finally {
		setTimeout(() => {
			sessionStartInProgress = false;
		}, 100);
	}
}

export async function completeLogin({
	token,
	userId,
	userData,
}: {
	token: string;
	userId: string;
	userData?: UserData;
}): Promise<void> {
	logger.info('Completing login process');

	if (userId && token) {
		await AccountManager.switchToNewAccount(userId, token, userData, false);
	} else {
		startSession(token, {startGateway: true});
	}
}

export async function startSso(redirectTo?: string): Promise<{authorization_url: string}> {
	const response = await http.post<{authorization_url: string}>({
		url: Endpoints.AUTH_SSO_START,
		body: {redirect_to: redirectTo},
		headers: withPlatformHeader(),
	});
	return response.body;
}

export async function completeSso({code, state}: {code: string; state: string}): Promise<TokenResponse> {
	const response = await http.post<TokenResponse>({
		url: Endpoints.AUTH_SSO_COMPLETE,
		body: {code, state},
		headers: withPlatformHeader(),
	});
	return response.body;
}

interface SetMfaTicketPayload {
	ticket: string;
	sms: boolean;
	totp: boolean;
	webauthn: boolean;
}

export function setMfaTicket({ticket, sms, totp, webauthn}: SetMfaTicketPayload): void {
	logger.debug('Setting MFA ticket');
	AuthenticationStore.handleMfaTicketSet({ticket, sms, totp, webauthn});
}

export function clearMfaTicket(): void {
	logger.debug('Clearing MFA ticket');
	AuthenticationStore.handleMfaTicketClear();
}
