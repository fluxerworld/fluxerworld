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

import {requireSudoMode} from '@fluxer/api/src/auth/services/SudoVerificationService';
import {DefaultUserOnly, LoginRequired, LoginRequiredAllowSuspicious} from '@fluxer/api/src/middleware/AuthMiddleware';
import {RateLimitMiddleware} from '@fluxer/api/src/middleware/RateLimitMiddleware';
import {OpenAPI} from '@fluxer/api/src/middleware/ResponseTypeMiddleware';
import {SudoModeMiddleware} from '@fluxer/api/src/middleware/SudoModeMiddleware';
import {RateLimitConfigs} from '@fluxer/api/src/RateLimitConfig';
import type {HonoApp} from '@fluxer/api/src/types/HonoEnv';
import {Validator} from '@fluxer/api/src/Validator';
import {
	DisableTotpRequest,
	EnableMfaTotpRequest,
	MfaBackupCodesRequest,
	MfaBackupCodesResponse,
	PhoneAddRequest,
	PhoneSendVerificationRequest,
	PhoneVerifyRequest,
	PhoneVerifyResponse,
	SudoMfaMethodsResponse,
	SudoVerificationSchema,
	WebAuthnChallengeResponse,
	WebAuthnCredentialListResponse,
	WebAuthnCredentialUpdateRequest,
	WebAuthnRegisterRequest,
} from '@fluxer/schema/src/domains/auth/AuthSchemas';
import {CredentialIdParam} from '@fluxer/schema/src/domains/common/CommonParamSchemas';

export function UserAuthController(app: HonoApp) {
	app.post(
		'/users/@me/mfa/totp/enable',
		RateLimitMiddleware(RateLimitConfigs.USER_MFA_TOTP_ENABLE),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', EnableMfaTotpRequest),
		OpenAPI({
			operationId: 'enable_totp_mfa',
			summary: 'Enable TOTP multi-factor authentication',
			responseSchema: MfaBackupCodesResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Enable time-based one-time password (TOTP) MFA on the current account. Returns backup codes for account recovery. Requires sudo mode verification.',
		}),
		async (ctx) => {
			const body = ctx.req.valid('json');
			const user = ctx.get('user');
			const sudoResult = await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'));
			return ctx.json(
				await ctx.get('userAuthRequestService').enableTotp({
					user,
					data: body,
					sudoContext: sudoResult,
				}),
			);
		},
	);

	app.post(
		'/users/@me/mfa/totp/disable',
		RateLimitMiddleware(RateLimitConfigs.USER_MFA_TOTP_DISABLE),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', DisableTotpRequest),
		OpenAPI({
			operationId: 'disable_totp_mfa',
			summary: 'Disable TOTP multi-factor authentication',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Disable TOTP multi-factor authentication on the current account. Requires sudo mode verification for security.',
		}),
		async (ctx) => {
			const body = ctx.req.valid('json');
			const user = ctx.get('user');
			const sudoResult = await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'));
			await ctx.get('userAuthRequestService').disableTotp({user, data: body, sudoContext: sudoResult});
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/mfa/backup-codes',
		RateLimitMiddleware(RateLimitConfigs.USER_MFA_BACKUP_CODES),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', MfaBackupCodesRequest),
		OpenAPI({
			operationId: 'get_backup_codes_mfa',
			summary: 'Get backup codes for multi-factor authentication',
			responseSchema: MfaBackupCodesResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Generate and retrieve new backup codes for account recovery. Requires sudo mode verification. Old codes are invalidated.',
		}),
		async (ctx) => {
			const body = ctx.req.valid('json');
			const user = ctx.get('user');
			const sudoResult = await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'));
			return ctx.json(
				await ctx.get('userAuthRequestService').getBackupCodes({user, data: body, sudoContext: sudoResult}),
			);
		},
	);

	app.post(
		'/users/@me/phone/send-verification',
		RateLimitMiddleware(RateLimitConfigs.PHONE_SEND_VERIFICATION),
		LoginRequiredAllowSuspicious,
		DefaultUserOnly,
		Validator('json', PhoneSendVerificationRequest),
		OpenAPI({
			operationId: 'send_phone_verification_code',
			summary: 'Send phone verification code',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Request a verification code to be sent via SMS to the provided phone number. Requires authentication.',
		}),
		async (ctx) => {
			await ctx.get('userAuthRequestService').sendPhoneVerificationCode({
				user: ctx.get('user'),
				data: ctx.req.valid('json'),
			});
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/phone/verify',
		RateLimitMiddleware(RateLimitConfigs.PHONE_VERIFY_CODE),
		LoginRequiredAllowSuspicious,
		DefaultUserOnly,
		Validator('json', PhoneVerifyRequest),
		OpenAPI({
			operationId: 'verify_phone_code',
			summary: 'Verify phone code',
			responseSchema: PhoneVerifyResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description: 'Verify a phone number by confirming the SMS verification code. Returns phone verification status.',
		}),
		async (ctx) => {
			return ctx.json(
				await ctx.get('userAuthRequestService').verifyPhoneCode({user: ctx.get('user'), data: ctx.req.valid('json')}),
			);
		},
	);

	app.post(
		'/users/@me/phone',
		RateLimitMiddleware(RateLimitConfigs.PHONE_ADD),
		LoginRequiredAllowSuspicious,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', PhoneAddRequest),
		OpenAPI({
			operationId: 'add_phone_to_account',
			summary: 'Add phone number to account',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Add or update the phone number associated with the current account. Requires sudo mode verification. Phone must be verified before use.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			const {phone_token: _phoneToken, ...sudoBody} = body;
			await requireSudoMode(ctx, user, sudoBody, ctx.get('authService'), ctx.get('authMfaService'));
			await ctx.get('userAuthRequestService').addPhoneToAccount({
				user,
				data: body,
			});
			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/users/@me/phone',
		RateLimitMiddleware(RateLimitConfigs.PHONE_REMOVE),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'remove_phone_from_account',
			summary: 'Remove phone number from account',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Remove the phone number from the current account. Requires sudo mode verification. SMS MFA will be disabled if enabled.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'));
			await ctx.get('userAuthRequestService').removePhoneFromAccount(user);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/mfa/sms/enable',
		RateLimitMiddleware(RateLimitConfigs.MFA_SMS_ENABLE),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'enable_sms_mfa',
			summary: 'Enable SMS multi-factor authentication',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Enable SMS-based multi-factor authentication on the current account. Requires sudo mode verification and a verified phone number.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'), {
				issueSudoToken: false,
			});
			await ctx.get('userAuthRequestService').enableSmsMfa(user);
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/mfa/sms/disable',
		RateLimitMiddleware(RateLimitConfigs.MFA_SMS_DISABLE),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'disable_sms_mfa',
			summary: 'Disable SMS multi-factor authentication',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Disable SMS-based multi-factor authentication on the current account. Requires sudo mode verification for security.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'));
			await ctx.get('userAuthRequestService').disableSmsMfa(user);
			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/users/@me/authorized-ips',
		RateLimitMiddleware(RateLimitConfigs.USER_AUTHORIZED_IPS_FORGET),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'forget_authorized_ips',
			summary: 'Forget authorized IPs for current user',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Clears all authorized IP addresses for the current user. After calling this endpoint, the user will be required to re-authorize any new IP addresses they log in from. Requires sudo mode verification.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'));
			await ctx.get('userAuthRequestService').forgetAuthorizedIps(user);
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/users/@me/mfa/webauthn/credentials',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_LIST),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_webauthn_credentials',
			summary: 'List WebAuthn credentials',
			responseSchema: WebAuthnCredentialListResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieve all registered WebAuthn credentials (security keys, biometric devices) for the current user. Requires authentication.',
		}),
		async (ctx) => {
			return ctx.json(await ctx.get('userAuthRequestService').listWebAuthnCredentials(ctx.get('user')));
		},
	);

	app.post(
		'/users/@me/mfa/webauthn/credentials/registration-options',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_REGISTRATION_OPTIONS),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'get_webauthn_registration_options',
			summary: 'Get WebAuthn registration options',
			responseSchema: WebAuthnChallengeResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Generate challenge and options to register a new WebAuthn credential. Requires sudo mode verification.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'), {
				issueSudoToken: false,
			});
			return ctx.json(await ctx.get('userAuthRequestService').generateWebAuthnRegistrationOptions(user));
		},
	);

	app.post(
		'/users/@me/mfa/webauthn/credentials',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_REGISTER),
		LoginRequired,
		DefaultUserOnly,
		SudoModeMiddleware,
		Validator('json', WebAuthnRegisterRequest),
		OpenAPI({
			operationId: 'register_webauthn_credential',
			summary: 'Register WebAuthn credential',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Complete registration of a new WebAuthn credential (security key or biometric device). Requires sudo mode verification.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const {response, challenge, name, ...sudoBody} = ctx.req.valid('json');
			await requireSudoMode(ctx, user, sudoBody, ctx.get('authService'), ctx.get('authMfaService'), {
				issueSudoToken: false,
			});
			await ctx.get('userAuthRequestService').registerWebAuthnCredential({
				user,
				data: {response, challenge, name},
			});
			return ctx.body(null, 204);
		},
	);

	app.patch(
		'/users/@me/mfa/webauthn/credentials/:credential_id',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_UPDATE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', CredentialIdParam),
		Validator('json', WebAuthnCredentialUpdateRequest),
		SudoModeMiddleware,
		OpenAPI({
			operationId: 'update_webauthn_credential',
			summary: 'Update WebAuthn credential',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description: 'Update the name or settings of a registered WebAuthn credential. Requires sudo mode verification.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const {credential_id} = ctx.req.valid('param');
			const {name, ...sudoBody} = ctx.req.valid('json');
			await requireSudoMode(ctx, user, sudoBody, ctx.get('authService'), ctx.get('authMfaService'));
			await ctx.get('userAuthRequestService').renameWebAuthnCredential({
				user,
				credentialId: credential_id,
				data: {name},
			});
			return ctx.body(null, 204);
		},
	);

	app.delete(
		'/users/@me/mfa/webauthn/credentials/:credential_id',
		RateLimitMiddleware(RateLimitConfigs.MFA_WEBAUTHN_DELETE),
		LoginRequired,
		DefaultUserOnly,
		Validator('param', CredentialIdParam),
		SudoModeMiddleware,
		Validator('json', SudoVerificationSchema),
		OpenAPI({
			operationId: 'delete_webauthn_credential',
			summary: 'Delete WebAuthn credential',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Remove a registered WebAuthn credential from the current account. Requires sudo mode verification for security.',
		}),
		async (ctx) => {
			const user = ctx.get('user');
			const {credential_id} = ctx.req.valid('param');
			const body = ctx.req.valid('json');
			await requireSudoMode(ctx, user, body, ctx.get('authService'), ctx.get('authMfaService'));
			await ctx.get('userAuthRequestService').deleteWebAuthnCredential({user, credentialId: credential_id});
			return ctx.body(null, 204);
		},
	);

	app.get(
		'/users/@me/sudo/mfa-methods',
		RateLimitMiddleware(RateLimitConfigs.SUDO_MFA_METHODS),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'list_sudo_mfa_methods',
			summary: 'List sudo multi-factor authentication methods',
			responseSchema: SudoMfaMethodsResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Retrieve all available MFA methods for sudo mode verification (TOTP, SMS, WebAuthn). Requires authentication.',
		}),
		async (ctx) => {
			return ctx.json(await ctx.get('userAuthRequestService').listSudoMfaMethods(ctx.get('user')));
		},
	);

	app.post(
		'/users/@me/sudo/mfa/sms/send',
		RateLimitMiddleware(RateLimitConfigs.SUDO_SMS_SEND),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'send_sudo_sms_code',
			summary: 'Send sudo SMS code',
			responseSchema: null,
			statusCode: 204,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Request an SMS code to be sent for sudo mode verification. Used before entering sensitive account settings.',
		}),
		async (ctx) => {
			await ctx.get('userAuthRequestService').sendSudoSmsCode(ctx.get('user'));
			return ctx.body(null, 204);
		},
	);

	app.post(
		'/users/@me/sudo/webauthn/authentication-options',
		RateLimitMiddleware(RateLimitConfigs.SUDO_WEBAUTHN_OPTIONS),
		LoginRequired,
		DefaultUserOnly,
		OpenAPI({
			operationId: 'get_sudo_webauthn_authentication_options',
			summary: 'Get sudo WebAuthn authentication options',
			responseSchema: WebAuthnChallengeResponse,
			statusCode: 200,
			security: ['botToken', 'bearerToken', 'sessionToken'],
			tags: ['Users'],
			description:
				'Generate WebAuthn challenge for sudo mode verification using a registered security key or biometric device.',
		}),
		async (ctx) => {
			return ctx.json(await ctx.get('userAuthRequestService').getSudoWebAuthnOptions(ctx.get('user')));
		},
	);
}
