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

import {Config} from '@fluxer/api/src/Config';
import {getMetricsService} from '@fluxer/api/src/infrastructure/MetricsService';
import {Logger} from '@fluxer/api/src/Logger';
import type {User} from '@fluxer/api/src/models/User';
import type {HonoEnv} from '@fluxer/api/src/types/HonoEnv';
import {stripApiPrefix} from '@fluxer/api/src/utils/RequestPathUtils';
import {requireClientIp} from '@fluxer/ip_utils/src/ClientIp';
import {recordCounter} from '@fluxer/telemetry/src/Metrics';
import type {Context} from 'hono';
import {createMiddleware} from 'hono/factory';

type TokenType = 'session' | 'bearer' | 'bot' | 'admin_api_key';

interface ParsedAuthHeader {
	token: string;
	type: TokenType;
}

function parseAuthHeader(authHeader?: string | null): ParsedAuthHeader | null {
	if (!authHeader) return null;

	if (authHeader !== authHeader.trim()) return null;
	const normalized = authHeader;
	if (!normalized) return null;

	if (normalized.startsWith('Bearer ')) {
		const token = normalized.slice('Bearer '.length);
		if (token.length === 0 || token !== token.trim()) return null;
		return {
			token,
			type: 'bearer',
		};
	}

	if (normalized.startsWith('Bot ')) {
		const token = normalized.slice('Bot '.length);
		if (token.length === 0 || token !== token.trim()) return null;
		return {
			token,
			type: 'bot',
		};
	}

	if (normalized.startsWith('Admin ')) {
		const token = normalized.slice('Admin '.length);
		if (token.length === 0 || token !== token.trim()) return null;
		return {
			token,
			type: 'admin_api_key',
		};
	}

	if (normalized.includes(' ')) return null;
	return {
		token: normalized,
		type: 'session',
	};
}

function setUserInContext(ctx: Context<HonoEnv>, user: User, trackActivity: boolean): void {
	ctx.set('user', user);
	if (trackActivity) {
		const now = new Date();
		const userRepository = ctx.get('userRepository');
		const kvActivityTracker = ctx.get('kvActivityTracker');
		void Promise.all([
			userRepository.updateLastActiveAt({
				userId: user.id,
				lastActiveAt: now,
				lastActiveIp: requireClientIp(ctx.req.raw, {
					trustCfConnectingIp: Config.proxy.trust_cf_connecting_ip,
				}),
			}),
			kvActivityTracker.updateActivity(user.id, now),
		]).catch((error: unknown) => {
			Logger.warn({error, userId: user.id}, 'Failed to update background user activity');
		});
	}
}

export const UserMiddleware = createMiddleware<HonoEnv>(async (ctx, next) => {
	const rawAuthHeader = ctx.req.header('Authorization');
	const parsed = parseAuthHeader(rawAuthHeader);

	ctx.set('oauthBearerToken', undefined);
	ctx.set('oauthBearerAllowed', false);
	ctx.set('oauthBearerScopes', undefined);
	ctx.set('oauthBearerUserId', undefined);
	ctx.set('authToken', undefined);

	if (!parsed) {
		return next();
	}

	const {token, type} = parsed;
	ctx.set('authToken', token);

	if (type === 'session') {
		const authService = ctx.get('authService');
		const authSession = await authService.getAuthSessionByToken(token);
		if (authSession) {
			recordCounter({
				name: 'auth.token_validation',
				dimensions: {token_type: 'session', valid: 'true'},
			});

			void authService.updateAuthSessionLastUsed(authSession.sessionIdHash);
			void authService.updateUserActivity({
				userId: authSession.userId,
				clientIp: requireClientIp(ctx.req.raw, {
					trustCfConnectingIp: Config.proxy.trust_cf_connecting_ip,
				}),
			});

			const user = await ctx.get('userService').findUniqueAssert(authSession.userId);

			ctx.set('authSession', authSession);
			ctx.set('authTokenType', 'session');
			setUserInContext(ctx, user, true);
		} else {
			recordCounter({
				name: 'auth.token_validation',
				dimensions: {token_type: 'session', valid: 'false'},
			});

			getMetricsService().counter({
				name: 'auth.token.invalid',
				dimensions: {type: 'session'},
			});
		}
		await next();
		return;
	}

	if (type === 'bearer') {
		const oauth2TokenRepository = ctx.get('oauth2TokenRepository');
		const accessToken = await oauth2TokenRepository.getAccessToken(token);

		if (accessToken) {
			recordCounter({
				name: 'auth.token_validation',
				dimensions: {token_type: 'bearer', valid: 'true'},
			});

			ctx.set('oauthBearerToken', token);
			ctx.set('oauthBearerScopes', accessToken.scope);
			ctx.set('oauthBearerUserId', accessToken.userId ?? undefined);
			ctx.set('authTokenType', 'bearer');

			const userId = accessToken.userId ?? null;
			if (userId) {
				const user = await ctx.get('userService').findUnique(userId);
				if (user) {
					setUserInContext(ctx, user, false);
				}
			}
			await next();
			return;
		}

		const authService = ctx.get('authService');
		const authSession = await authService.getAuthSessionByToken(token);
		if (authSession) {
			recordCounter({
				name: 'auth.token_validation',
				dimensions: {token_type: 'session', valid: 'true'},
			});

			void authService.updateAuthSessionLastUsed(authSession.sessionIdHash);
			void authService.updateUserActivity({
				userId: authSession.userId,
				clientIp: requireClientIp(ctx.req.raw, {
					trustCfConnectingIp: Config.proxy.trust_cf_connecting_ip,
				}),
			});

			const user = await ctx.get('userService').findUniqueAssert(authSession.userId);
			ctx.set('authSession', authSession);
			ctx.set('authTokenType', 'session');
			setUserInContext(ctx, user, true);
		} else {
			recordCounter({
				name: 'auth.token_validation',
				dimensions: {token_type: 'bearer', valid: 'false'},
			});

			getMetricsService().counter({
				name: 'auth.token.invalid',
				dimensions: {type: 'bearer'},
			});
		}
		await next();
		return;
	}

	if (type === 'bot') {
		const botAuthService = ctx.get('botAuthService');
		const botUserId = await botAuthService.validateBotToken(token);
		if (botUserId) {
			recordCounter({
				name: 'auth.token_validation',
				dimensions: {token_type: 'bot', valid: 'true'},
			});

			const botUser = await ctx.get('userService').findUnique(botUserId);
			if (botUser) {
				ctx.set('authTokenType', 'bot');
				setUserInContext(ctx, botUser, false);
			}
		} else {
			recordCounter({
				name: 'auth.token_validation',
				dimensions: {token_type: 'bot', valid: 'false'},
			});

			getMetricsService().counter({
				name: 'auth.token.invalid',
				dimensions: {type: 'bot'},
			});
		}
		await next();
		return;
	}

	if (type === 'admin_api_key') {
		const path = stripApiPrefix(ctx.req.path);
		if (!(path === '/admin' || path.startsWith('/admin/'))) {
			await next();
			return;
		}

		const adminApiKeyService = ctx.get('adminApiKeyService');
		const apiKey = await adminApiKeyService.validateApiKey(token);
		if (apiKey) {
			recordCounter({
				name: 'auth.token_validation',
				dimensions: {token_type: 'admin_api_key', valid: 'true'},
			});

			const userService = ctx.get('userService');
			const user = await userService.findUnique(apiKey.createdById);
			if (user) {
				ctx.set('authTokenType', 'admin_api_key');
				ctx.set('adminApiKey', apiKey);
				ctx.set('adminApiKeyAcls', apiKey.acls);
				setUserInContext(ctx, user, false);
			}
		} else {
			recordCounter({
				name: 'auth.token_validation',
				dimensions: {token_type: 'admin_api_key', valid: 'false'},
			});

			getMetricsService().counter({
				name: 'auth.token.invalid',
				dimensions: {type: 'admin_api_key'},
			});
		}
		await next();
		return;
	}

	await next();
});
