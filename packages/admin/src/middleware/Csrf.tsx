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

/** @jsxRuntime automatic */
/** @jsxImportSource hono/jsx */

import type {AppContext} from '@fluxer/admin/src/types/App';
import {CSRF_FORM_FIELD} from '@fluxer/constants/src/Cookies';
import {type CsrfProtection, createCsrfProtection} from '@fluxer/hono/src/security/CsrfProtection';
import type {Next} from 'hono';

let csrfProtection: CsrfProtection | null = null;

export function initializeCsrf(secretKeyBase: string, secureCookie: boolean): void {
	csrfProtection = createCsrfProtection({
		secretKeyBase,
		secureCookie,
		ignoredPathSuffixes: ['/oauth2_callback', '/auth/start'],
	});
}

function getCsrfProtectionOrThrow(): CsrfProtection {
	if (!csrfProtection) {
		throw new Error('CSRF not initialized');
	}
	return csrfProtection;
}

export function getCsrfToken(c: AppContext): string {
	return getCsrfProtectionOrThrow().getToken(c);
}

export async function csrfMiddleware(c: AppContext, next: Next): Promise<Response | undefined> {
	const response = await getCsrfProtectionOrThrow().middleware(c, next);
	return response ?? undefined;
}

export const CSRF_FORM_FIELD_NAME = CSRF_FORM_FIELD;
