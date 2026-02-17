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

import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {CSRF_COOKIE_NAME, CSRF_FORM_FIELD, CSRF_HEADER_NAME} from '@fluxer/constants/src/Cookies';
import type {Context, MiddlewareHandler} from 'hono';
import {getCookie, setCookie} from 'hono/cookie';

const TOKEN_LENGTH = 32;
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;

export interface CreateCsrfProtectionOptions {
	secretKeyBase: string;
	secureCookie: boolean;
	cookiePath?: string;
	cookieSameSite?: 'Strict' | 'Lax' | 'None';
	ignoredPathSuffixes?: Array<string>;
}

export interface CsrfProtection {
	middleware: MiddlewareHandler;
	getToken: (c: Context) => string;
	verifySignedToken: (signedToken: string) => string | null;
}

export function createCsrfProtection(options: CreateCsrfProtectionOptions): CsrfProtection {
	const secretKey = Buffer.from(options.secretKeyBase);
	const cookiePath = options.cookiePath ?? '/';
	const cookieSameSite = options.cookieSameSite ?? 'Strict';
	const ignoredPathSuffixes = options.ignoredPathSuffixes ?? [];

	function signToken(token: string): string {
		const signature = createHmac('sha256', secretKey).update(token).digest('base64url');
		return `${token}.${signature}`;
	}

	function verifySignedToken(signedToken: string): string | null {
		const parts = signedToken.split('.');
		if (parts.length !== 2) {
			return null;
		}

		const [token, providedSignature] = parts;
		if (!token || !providedSignature) {
			return null;
		}

		const expectedSignature = createHmac('sha256', secretKey).update(token).digest('base64url');

		try {
			const providedBuffer = Buffer.from(providedSignature, 'base64url');
			const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

			if (providedBuffer.length !== expectedBuffer.length) {
				return null;
			}

			if (timingSafeEqual(providedBuffer, expectedBuffer)) {
				return token;
			}
		} catch {
			return null;
		}

		return null;
	}

	function getToken(c: Context): string {
		const existingCookie = getCookie(c, CSRF_COOKIE_NAME);
		if (existingCookie && verifySignedToken(existingCookie)) {
			return existingCookie;
		}

		const token = randomBytes(TOKEN_LENGTH).toString('base64url');
		const signedToken = signToken(token);
		setCookie(c, CSRF_COOKIE_NAME, signedToken, {
			httpOnly: true,
			secure: options.secureCookie,
			sameSite: cookieSameSite,
			maxAge: TOKEN_MAX_AGE_SECONDS,
			path: cookiePath,
		});
		return signedToken;
	}

	const middleware: MiddlewareHandler = async (c, next) => {
		const method = c.req.method.toUpperCase();
		if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
			await next();
			return undefined;
		}

		const path = c.req.path;
		if (ignoredPathSuffixes.some((suffix) => path.endsWith(suffix))) {
			await next();
			return undefined;
		}

		const cookieToken = getCookie(c, CSRF_COOKIE_NAME);
		if (!cookieToken) {
			return c.text('CSRF token missing', 403);
		}

		const verifiedCookieToken = verifySignedToken(cookieToken);
		if (!verifiedCookieToken) {
			return c.text('CSRF token invalid', 403);
		}

		const submittedToken = await extractSubmittedToken(c);
		if (!submittedToken) {
			return c.text('CSRF token not provided', 403);
		}

		const verifiedSubmittedToken = verifySignedToken(submittedToken);
		if (!verifiedSubmittedToken) {
			return c.text('CSRF token invalid', 403);
		}

		if (verifiedCookieToken !== verifiedSubmittedToken) {
			return c.text('CSRF token mismatch', 403);
		}

		await next();
		return undefined;
	};

	return {
		middleware,
		getToken,
		verifySignedToken,
	};
}

async function extractSubmittedToken(c: Context): Promise<string | null> {
	const headerToken = c.req.header(CSRF_HEADER_NAME);
	if (headerToken) {
		return headerToken;
	}

	const contentType = c.req.header('content-type') ?? '';
	const isFormRequest =
		contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
	if (!isFormRequest) {
		return null;
	}

	try {
		const body = await c.req.parseBody();
		const formToken = body[CSRF_FORM_FIELD];
		return typeof formToken === 'string' ? formToken : null;
	} catch {
		return null;
	}
}
