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
import type {OAuth2Scope} from '@fluxer/constants/src/OAuth2Constants';
import {UnauthorizedError} from '@fluxer/errors/src/domains/core/UnauthorizedError';
import {MissingOAuthScopeError} from '@fluxer/errors/src/domains/oauth/MissingOAuthScopeError';
import type {Context} from 'hono';
import {createMiddleware} from 'hono/factory';

type OAuth2ScopeCheckMode = 'strict' | 'bearer_only';

function ensureBearerScope(ctx: Context<HonoEnv>, scope: OAuth2Scope, mode: OAuth2ScopeCheckMode): boolean {
	const tokenType = ctx.get('authTokenType');
	if (tokenType !== 'bearer') {
		if (mode === 'strict') {
			throw new UnauthorizedError();
		}
		return false;
	}

	const oauthScopes = ctx.get('oauthBearerScopes');
	if (!oauthScopes || !oauthScopes.has(scope)) {
		throw new MissingOAuthScopeError(scope);
	}

	return true;
}

function ensureAnyBearerScope(ctx: Context<HonoEnv>, scopes: Array<OAuth2Scope>, mode: OAuth2ScopeCheckMode): boolean {
	const tokenType = ctx.get('authTokenType');
	if (tokenType !== 'bearer') {
		if (mode === 'strict') {
			throw new UnauthorizedError();
		}
		return false;
	}

	const oauthScopes = ctx.get('oauthBearerScopes');
	const hasAnyScope = oauthScopes && scopes.some((scope) => oauthScopes.has(scope));
	if (!hasAnyScope) {
		throw new MissingOAuthScopeError(scopes[0]);
	}

	return true;
}

export function requireOAuth2Scope(scope: OAuth2Scope) {
	return createMiddleware<HonoEnv>(async (ctx, next) => {
		ctx.set('oauthBearerAllowed', true);
		ensureBearerScope(ctx, scope, 'strict');
		await next();
	});
}

export function requireAnyOAuth2Scope(...scopes: Array<OAuth2Scope>) {
	return createMiddleware<HonoEnv>(async (ctx, next) => {
		ctx.set('oauthBearerAllowed', true);
		ensureAnyBearerScope(ctx, scopes, 'strict');
		await next();
	});
}

export function requireOAuth2ScopeForBearer(scope: OAuth2Scope) {
	return createMiddleware<HonoEnv>(async (ctx, next) => {
		ctx.set('oauthBearerAllowed', true);
		ensureBearerScope(ctx, scope, 'bearer_only');
		await next();
	});
}

export function requireAnyOAuth2ScopeForBearer(...scopes: Array<OAuth2Scope>) {
	return createMiddleware<HonoEnv>(async (ctx, next) => {
		ctx.set('oauthBearerAllowed', true);
		ensureAnyBearerScope(ctx, scopes, 'bearer_only');
		await next();
	});
}

export function requireOAuth2BearerToken() {
	return createMiddleware<HonoEnv>(async (ctx, next) => {
		ctx.set('oauthBearerAllowed', true);
		const tokenType = ctx.get('authTokenType');
		if (tokenType !== 'bearer') {
			throw new UnauthorizedError();
		}
		await next();
	});
}
