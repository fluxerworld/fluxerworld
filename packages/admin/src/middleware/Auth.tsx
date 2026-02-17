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
import {createAdminOAuth2Client} from '@fluxer/admin/src/Oauth2';
import {parseSession} from '@fluxer/admin/src/Session';
import type {AppContext, Session} from '@fluxer/admin/src/types/App';
import type {AdminConfig as Config} from '@fluxer/admin/src/types/Config';
import {type Flash, serializeFlash} from '@fluxer/hono/src/Flash';
import {parseFlashFromCookie} from '@fluxer/ui/src/components/Flash';
import type {Next} from 'hono';
import {deleteCookie, getCookie, setCookie} from 'hono/cookie';

export async function getValidSession(c: AppContext, configOverride?: Config): Promise<Session | null> {
	const config = configOverride ?? c.get('config');
	const sessionCookie = getCookie(c, 'session');
	if (!sessionCookie) return null;

	const session = parseSession(sessionCookie, config.secretKeyBase);
	if (!session) return null;

	return session;
}

export function redirectToAuthorize(c: AppContext, config: Config): Response {
	const oauth2Client = createAdminOAuth2Client(config);
	const state = oauth2Client.generateState();
	setCookie(c, 'oauth_state', state, {
		httpOnly: true,
		secure: config.env === 'production',
		sameSite: 'Lax',
		maxAge: 300,
		path: '/',
	});
	return c.redirect(oauth2Client.createAuthorizationUrl(state));
}

export function redirectToLoginAndClearSession(c: AppContext, config: Config): Response {
	deleteCookie(c, 'session', {path: '/'});
	return c.redirect(`${config.basePath}/login`);
}

export function getFlash(c: AppContext): Flash | undefined {
	const flashCookie = getCookie(c, 'flash');
	if (flashCookie) {
		deleteCookie(c, 'flash', {path: '/'});
		return parseFlashFromCookie(flashCookie);
	}
	return undefined;
}

export function redirectWithFlash(c: AppContext, url: string, flash: Flash): Response {
	setCookie(c, 'flash', serializeFlash(flash), {
		httpOnly: true,
		secure: c.get('config').env === 'production',
		sameSite: 'Lax',
		maxAge: 60,
		path: '/',
	});
	return c.redirect(url);
}

export function createRequireAuth(config: Config, assetVersion: string) {
	return async (c: AppContext, next: Next): Promise<Response | undefined> => {
		const session = await getValidSession(c, config);

		if (!session) {
			return redirectToAuthorize(c, config);
		}

		const adminResult = await usersApi.getCurrentAdmin(config, session);
		if (!adminResult.ok) {
			if (adminResult.error.type === 'unauthorized') {
				return redirectToLoginAndClearSession(c, config);
			}
		}

		c.set('config', config);
		c.set('session', session);
		c.set('currentAdmin', adminResult.ok ? (adminResult.data ?? undefined) : undefined);
		c.set('assetVersion', assetVersion);

		await next();
		return;
	};
}
