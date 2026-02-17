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

import * as usersApi from '@fluxer/admin/src/api/Users';
import {getValidSession, redirectToAuthorize} from '@fluxer/admin/src/middleware/Auth';
import {LoginPage} from '@fluxer/admin/src/pages/LoginPage';
import type {RouteFactoryDeps} from '@fluxer/admin/src/routes/RouteTypes';
import {createSession} from '@fluxer/admin/src/Session';
import type {AppVariables} from '@fluxer/admin/src/types/App';
import {base64EncodeString} from '@fluxer/oauth2/src/OAuth2';
import {Hono} from 'hono';
import {deleteCookie, getCookie, setCookie} from 'hono/cookie';

export function createAuthRoutes({config}: RouteFactoryDeps) {
	const router = new Hono<{Variables: AppVariables}>();

	router.get('/login', async (c) => {
		const error = c.req.query('error');
		let errorMsg: string | undefined;

		if (error === 'oauth_failed') {
			errorMsg = 'Authentication failed. Please try again.';
		} else if (error === 'missing_admin_acl') {
			errorMsg = 'Access denied: missing admin:authenticate permission. Ask an administrator to grant access.';
		} else if (error) {
			errorMsg = 'Login error. Please try again.';
		}

		const session = await getValidSession(c, config);
		if (session) {
			return c.redirect(`${config.basePath}/dashboard`);
		}

		return c.html(<LoginPage config={config} errorMessage={errorMsg} />);
	});

	router.get('/auth/start', (c) => {
		return redirectToAuthorize(c, config);
	});

	router.get('/oauth2_callback', async (c) => {
		const code = c.req.query('code');
		const state = c.req.query('state');
		const storedState = getCookie(c, 'oauth_state');

		deleteCookie(c, 'oauth_state', {path: '/'});

		if (!code || !state || state !== storedState) {
			return c.redirect(`${config.basePath}/login?error=oauth_failed`);
		}

		try {
			const tokenResponse = await fetch(`${config.apiEndpoint}/oauth2/token`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					grant_type: 'authorization_code',
					code,
					redirect_uri: config.oauthRedirectUri,
					client_id: config.oauthClientId,
					client_secret: config.oauthClientSecret,
				}),
			});

			if (!tokenResponse.ok) {
				return c.redirect(`${config.basePath}/login?error=oauth_failed`);
			}

			const tokenData = (await tokenResponse.json()) as {access_token: string; token_type: string};
			const accessToken = tokenData.access_token;

			const userResponse = await fetch(`${config.apiEndpoint}/users/@me`, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
				},
			});

			if (!userResponse.ok) {
				return c.redirect(`${config.basePath}/login?error=oauth_failed`);
			}

			const userData = (await userResponse.json()) as {id: string};
			const userId = userData.id;

			const adminResult = await usersApi.getCurrentAdmin(config, {
				userId,
				accessToken,
				createdAt: Math.floor(Date.now() / 1000),
			});
			if (!adminResult.ok || !adminResult.data) {
				return c.redirect(`${config.basePath}/login?error=missing_admin_acl`);
			}

			const sessionData = createSession(userId, accessToken, config.secretKeyBase);
			setCookie(c, 'session', sessionData, {
				httpOnly: true,
				secure: config.env === 'production',
				sameSite: 'Lax',
				maxAge: 60 * 60 * 24 * 7,
				path: '/',
			});

			return c.redirect(`${config.basePath}/dashboard`);
		} catch {
			return c.redirect(`${config.basePath}/login?error=oauth_failed`);
		}
	});

	router.post('/logout', async (c) => {
		const session = await getValidSession(c, config);

		if (session) {
			try {
				const basic = `Basic ${base64EncodeString(`${config.oauthClientId}:${config.oauthClientSecret}`)}`;
				await fetch(`${config.apiEndpoint}/oauth2/revoke`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						Authorization: basic,
					},
					body: new URLSearchParams({
						token: session.accessToken,
						token_type_hint: 'access_token',
					}),
				});
			} catch {}
		}

		deleteCookie(c, 'session', {path: '/'});
		return c.redirect(`${config.basePath}/login`);
	});

	router.get('/logout', async (c) => {
		const session = await getValidSession(c, config);
		if (session) {
			return c.redirect(`${config.basePath}/dashboard`);
		}
		return c.redirect(`${config.basePath}/login`);
	});

	return router;
}
