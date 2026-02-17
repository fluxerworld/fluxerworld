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

import {type CsrfProtection, createCsrfProtection} from '@fluxer/hono/src/security/CsrfProtection';
import type {Context, Next} from 'hono';

let csrfProtection: CsrfProtection | null = null;

export function initializeMarketingCsrf(secretKeyBase: string, secureCookie: boolean): void {
	csrfProtection = createCsrfProtection({
		secretKeyBase,
		secureCookie,
	});
}

function getCsrfProtectionOrThrow(): CsrfProtection {
	if (!csrfProtection) {
		throw new Error('CSRF not initialized');
	}
	return csrfProtection;
}

export function getMarketingCsrfToken(c: Context): string {
	return getCsrfProtectionOrThrow().getToken(c);
}

export async function marketingCsrfMiddleware(c: Context, next: Next): Promise<Response | undefined> {
	const response = await getCsrfProtectionOrThrow().middleware(c, next);
	return response ?? undefined;
}
