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
import {getSudoModeService} from '@fluxer/api/src/auth/services/SudoModeService';
import {SUDO_MODE_HEADER} from '@fluxer/api/src/middleware/SudoModeMiddleware';
import type {User} from '@fluxer/api/src/models/User';
import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {setSudoCookie} from '@fluxer/api/src/utils/SudoCookieUtils';
import {ValidationErrorCodes} from '@fluxer/constants/src/ValidationErrorCodes';
import {SudoModeRequiredError} from '@fluxer/errors/src/domains/auth/SudoModeRequiredError';
import {InputValidationError} from '@fluxer/errors/src/domains/core/InputValidationError';
import type {AuthenticationResponseJSON} from '@simplewebauthn/server';
import type {Context} from 'hono';

export interface SudoVerificationBody {
	password?: string;
	mfa_method?: 'totp' | 'sms' | 'webauthn';
	mfa_code?: string;
	webauthn_response?: AuthenticationResponseJSON;
	webauthn_challenge?: string;
}

type SudoVerificationMethod = 'password' | 'mfa' | 'sudo_token';

export function userHasMfa(user: {authenticatorTypes?: Set<number> | null}): boolean {
	return (user.authenticatorTypes?.size ?? 0) > 0;
}

export interface SudoVerificationResult {
	verified: boolean;
	method: SudoVerificationMethod;
	sudoToken?: string;
}

export interface SudoVerificationOptions {
	issueSudoToken?: boolean;
}

async function verifySudoMode(
	ctx: Context<HonoEnv>,
	user: User,
	body: SudoVerificationBody,
	authService: AuthService,
	mfaService: AuthMfaService,
	options: SudoVerificationOptions = {},
): Promise<SudoVerificationResult> {
	if (user.isBot) {
		return {verified: true, method: 'sudo_token'};
	}

	const hasMfa = userHasMfa(user);
	const issueSudoToken = options.issueSudoToken ?? hasMfa;

	if (hasMfa && ctx.get('sudoModeValid')) {
		const sudoToken = ctx.get('sudoModeToken') ?? ctx.req.header(SUDO_MODE_HEADER) ?? undefined;
		return {verified: true, method: 'sudo_token', sudoToken: issueSudoToken ? sudoToken : undefined};
	}

	const incomingToken = ctx.req.header(SUDO_MODE_HEADER);
	if (!hasMfa && incomingToken && ctx.get('sudoModeValid')) {
		return {verified: true, method: 'sudo_token', sudoToken: issueSudoToken ? incomingToken : undefined};
	}

	if (hasMfa && body.mfa_method) {
		const result = await mfaService.verifySudoMfa({
			userId: user.id,
			method: body.mfa_method,
			code: body.mfa_code,
			webauthnResponse: body.webauthn_response,
			webauthnChallenge: body.webauthn_challenge,
		});

		if (!result.success) {
			throw InputValidationError.fromCode('mfa_code', ValidationErrorCodes.INVALID_MFA_CODE);
		}

		const sudoModeService = getSudoModeService();
		const sudoToken = issueSudoToken ? await sudoModeService.generateSudoToken(user.id) : undefined;

		return {verified: true, sudoToken, method: 'mfa'};
	}

	const isUnclaimedAccount = user.isUnclaimedAccount();
	if (isUnclaimedAccount && !hasMfa) {
		return {verified: true, method: 'password'};
	}

	if (body.password && !hasMfa) {
		if (!user.passwordHash) {
			throw InputValidationError.fromCode('password', ValidationErrorCodes.PASSWORD_NOT_SET);
		}

		const passwordValid = await authService.verifyPassword({
			password: body.password,
			passwordHash: user.passwordHash,
		});

		if (!passwordValid) {
			throw InputValidationError.fromCode('password', ValidationErrorCodes.INVALID_PASSWORD);
		}

		return {verified: true, method: 'password'};
	}

	throw new SudoModeRequiredError(hasMfa);
}

function setSudoTokenHeader(
	ctx: Context<HonoEnv>,
	result: SudoVerificationResult,
	options: SudoVerificationOptions = {},
): void {
	const issueSudoToken = options.issueSudoToken ?? true;

	if (!issueSudoToken) {
		return;
	}

	const tokenToSet = result.sudoToken ?? ctx.req.header(SUDO_MODE_HEADER);
	if (tokenToSet) {
		ctx.header(SUDO_MODE_HEADER, tokenToSet);
		const user = ctx.get('user');
		if (user) {
			setSudoCookie(ctx, tokenToSet, user.id.toString());
		}
	}
}

export async function requireSudoMode(
	ctx: Context<HonoEnv>,
	user: User,
	body: SudoVerificationBody,
	authService: AuthService,
	mfaService: AuthMfaService,
	options: SudoVerificationOptions = {},
): Promise<SudoVerificationResult> {
	const sudoResult = await verifySudoMode(ctx, user, body, authService, mfaService, options);
	setSudoTokenHeader(ctx, sudoResult, options);
	return sudoResult;
}
