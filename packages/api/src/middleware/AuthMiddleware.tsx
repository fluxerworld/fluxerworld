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

import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {AccessDeniedError} from '@fluxer/errors/src/domains/core/AccessDeniedError';
import {UnauthorizedError} from '@fluxer/errors/src/domains/core/UnauthorizedError';
import {AccountSuspiciousActivityError} from '@fluxer/errors/src/domains/user/AccountSuspiciousActivityError';
import {createMiddleware} from 'hono/factory';

function ensureOAuth2BearerRouteSupport(
	authTokenType: 'session' | 'bearer' | 'bot' | 'admin_api_key' | undefined,
	oauthBearerAllowed: boolean | undefined,
): void {
	if (authTokenType === 'bearer' && !oauthBearerAllowed) {
		throw new AccessDeniedError();
	}
}

export const LoginRequired = createMiddleware<HonoEnv>(async (ctx, next) => {
	const user = ctx.get('user');
	if (!user) {
		throw new UnauthorizedError();
	}
	ensureOAuth2BearerRouteSupport(ctx.get('authTokenType'), ctx.get('oauthBearerAllowed'));
	if (user.suspiciousActivityFlags !== null && user.suspiciousActivityFlags !== 0) {
		throw new AccountSuspiciousActivityError(user.suspiciousActivityFlags);
	}

	await next();
});

export const LoginRequiredAllowSuspicious = createMiddleware<HonoEnv>(async (ctx, next) => {
	const user = ctx.get('user');
	if (!user) {
		throw new UnauthorizedError();
	}
	ensureOAuth2BearerRouteSupport(ctx.get('authTokenType'), ctx.get('oauthBearerAllowed'));
	await next();
});

export const DefaultUserOnly = createMiddleware<HonoEnv>(async (ctx, next) => {
	const user = ctx.get('user');
	if (!user) {
		throw new UnauthorizedError();
	}
	if (user.isBot) {
		throw new AccessDeniedError();
	}
	await next();
});
