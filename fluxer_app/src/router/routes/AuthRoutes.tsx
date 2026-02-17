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

import * as GiftActionCreators from '@app/actions/GiftActionCreators';
import * as InviteActionCreators from '@app/actions/InviteActionCreators';
import * as ThemeActionCreators from '@app/actions/ThemeActionCreators';
import {AuthLayout} from '@app/components/layout/AuthLayout';
import AuthorizeIPPage from '@app/components/pages/AuthorizeIPPage';
import EmailRevertPage from '@app/components/pages/EmailRevertPage';
import ForgotPasswordPage from '@app/components/pages/ForgotPasswordPage';
import GiftLoginPage from '@app/components/pages/GiftLoginPage';
import GiftRegisterPage from '@app/components/pages/GiftRegisterPage';
import InviteLoginPage from '@app/components/pages/InviteLoginPage';
import InviteRegisterPage from '@app/components/pages/InviteRegisterPage';
import LoginPage from '@app/components/pages/LoginPage';
import OAuthAuthorizePage from '@app/components/pages/OAuthAuthorizePage';
import RegisterPage from '@app/components/pages/RegisterPage';
import {ReportPage} from '@app/components/pages/ReportPage';
import ResetPasswordPage from '@app/components/pages/ResetPasswordPage';
import SsoCallbackPage from '@app/components/pages/SsoCallbackPage';
import ThemeLoginPage from '@app/components/pages/ThemeLoginPage';
import ThemeRegisterPage from '@app/components/pages/ThemeRegisterPage';
import VerifyEmailPage from '@app/components/pages/VerifyEmailPage';
import {createRoute} from '@app/lib/router/Builder';
import type {RouteContext} from '@app/lib/router/RouterTypes';
import {Redirect} from '@app/lib/router/RouterTypes';
import SessionManager from '@app/lib/SessionManager';
import {Routes} from '@app/Routes';
import {rootRoute} from '@app/router/routes/RootRoutes';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import * as RouterUtils from '@app/utils/RouterUtils';
import {setPathQueryParams} from '@app/utils/UrlUtils';
import {i18n} from '@lingui/core';

const resolveToPath = (to: Redirect['to']): string => {
	if (typeof to === 'string') {
		return to;
	}

	const url = new URL(to.to, window.location.origin);

	if (to.search) {
		url.search = '';
		for (const [k, v] of Object.entries(to.search)) {
			if (v === undefined) continue;
			if (v === null) {
				url.searchParams.set(k, '');
			} else {
				url.searchParams.set(k, String(v));
			}
		}
	}

	if (to.hash) {
		url.hash = to.hash.startsWith('#') ? to.hash : `#${to.hash}`;
	}

	return url.pathname + url.search + url.hash;
};

type AuthRedirectHandler = (ctx: RouteContext) => Redirect | undefined;

const whenAuthenticated = (handler: AuthRedirectHandler) => {
	return (ctx: RouteContext): Redirect | undefined => {
		const execute = (): Redirect | undefined => handler(ctx);

		if (SessionManager.isInitialized) {
			return AuthenticationStore.isAuthenticated ? execute() : undefined;
		}

		void SessionManager.initialize().then(() => {
			if (AuthenticationStore.isAuthenticated) {
				const res = execute();
				if (res instanceof Redirect) {
					RouterUtils.replaceWith(resolveToPath(res.to));
				}
			}
		});

		return undefined;
	};
};

const authLayoutRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: 'authLayout',
	layout: ({children}) => <AuthLayout>{children}</AuthLayout>,
});

const loginRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'login',
	path: '/login',
	onEnter: whenAuthenticated(() => {
		const search = window.location.search;
		const qp = new URLSearchParams(search);
		const isDesktopHandoff = qp.get('desktop_handoff') === '1';
		if (isDesktopHandoff) {
			return undefined;
		}
		const redirectTo = qp.get('redirect_to');
		return new Redirect(redirectTo || Routes.ME);
	}),
	component: () => <LoginPage />,
});

const ssoCallbackRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'ssoCallback',
	path: '/auth/sso/callback',
	component: () => <SsoCallbackPage />,
});

const inviteBaseRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'inviteBase',
	path: '/invite',
	onEnter: () => new Redirect(Routes.ME),
});

const giftBaseRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'giftBase',
	path: '/gift',
	onEnter: () => new Redirect(Routes.ME),
});

const themeBaseRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'themeBase',
	path: '/theme',
	onEnter: () => new Redirect(Routes.ME),
});

const registerRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'register',
	path: '/register',
	onEnter: whenAuthenticated(() => {
		const search = window.location.search;
		const qp = new URLSearchParams(search);
		const redirectTo = qp.get('redirect_to');
		return new Redirect(redirectTo || Routes.ME);
	}),
	component: () => <RegisterPage />,
});

const oauthAuthorizeRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'oauthAuthorize',
	path: Routes.OAUTH_AUTHORIZE,
	onEnter: () => {
		const current = window.location.pathname + window.location.search;

		if (!SessionManager.isInitialized) {
			void SessionManager.initialize().then(() => {
				if (!AuthenticationStore.isAuthenticated) {
					RouterUtils.replaceWith(setPathQueryParams(Routes.LOGIN, {redirect_to: current}));
				}
			});
			return undefined;
		}

		if (!AuthenticationStore.isAuthenticated) {
			return new Redirect(setPathQueryParams(Routes.LOGIN, {redirect_to: current}));
		}

		return undefined;
	},
	component: () => <OAuthAuthorizePage />,
});

const inviteRegisterRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'inviteRegister',
	path: '/invite/:code',
	onEnter: whenAuthenticated((ctx) => {
		const code = ctx.params['code'];
		if (code) {
			InviteActionCreators.openAcceptModal(code);
		}
		return new Redirect(Routes.ME);
	}),
	component: () => <InviteRegisterPage />,
});

const inviteLoginRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'inviteLogin',
	path: '/invite/:code/login',
	onEnter: whenAuthenticated((ctx) => {
		const code = ctx.params['code'];
		if (code) {
			InviteActionCreators.openAcceptModal(code);
		}
		return new Redirect(Routes.ME);
	}),
	component: () => <InviteLoginPage />,
});

const giftRegisterRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'giftRegister',
	path: '/gift/:code',
	onEnter: whenAuthenticated((ctx) => {
		const code = ctx.params['code'];
		if (code) {
			GiftActionCreators.openAcceptModal(code);
		}
		return new Redirect(Routes.ME);
	}),
	component: () => <GiftRegisterPage />,
});

const giftLoginRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'giftLogin',
	path: '/gift/:code/login',
	onEnter: whenAuthenticated((ctx) => {
		const code = ctx.params['code'];
		if (code) {
			GiftActionCreators.openAcceptModal(code);
		}
		return new Redirect(Routes.ME);
	}),
	component: () => <GiftLoginPage />,
});

const forgotPasswordRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'forgotPassword',
	path: Routes.FORGOT_PASSWORD,
	onEnter: whenAuthenticated(() => new Redirect(Routes.ME)),
	component: () => <ForgotPasswordPage />,
});

const resetPasswordRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'resetPassword',
	path: Routes.RESET_PASSWORD,
	component: () => <ResetPasswordPage />,
});

const emailRevertRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'emailRevert',
	path: Routes.EMAIL_REVERT,
	component: () => <EmailRevertPage />,
});

const verifyEmailRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'verifyEmail',
	path: Routes.VERIFY_EMAIL,
	component: () => <VerifyEmailPage />,
});

const authorizeIPRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'authorizeIP',
	path: Routes.AUTHORIZE_IP,
	component: () => <AuthorizeIPPage />,
});

const pendingRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'pending',
	path: Routes.PENDING,
	onEnter: () => new Redirect(Routes.ME),
});

const reportRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'report',
	path: Routes.REPORT,
	component: () => <ReportPage />,
});

const themeRegisterRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'themeRegister',
	path: Routes.THEME_REGISTER,
	onEnter: whenAuthenticated((ctx) => {
		const themeId = ctx.params.themeId;
		if (themeId) {
			ThemeActionCreators.openAcceptModal(themeId, i18n);
		}
		return new Redirect(Routes.ME);
	}),
	component: () => <ThemeRegisterPage />,
});

const themeLoginRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'themeLogin',
	path: Routes.THEME_LOGIN,
	onEnter: whenAuthenticated((ctx) => {
		const themeId = ctx.params.themeId;
		if (themeId) {
			ThemeActionCreators.openAcceptModal(themeId, i18n);
		}
		return new Redirect(Routes.ME);
	}),
	component: () => <ThemeLoginPage />,
});

export const authRouteTree = authLayoutRoute.addChildren([
	loginRoute,
	ssoCallbackRoute,
	registerRoute,
	oauthAuthorizeRoute,
	inviteBaseRoute,
	giftBaseRoute,
	themeBaseRoute,
	inviteRegisterRoute,
	inviteLoginRoute,
	themeRegisterRoute,
	themeLoginRoute,
	forgotPasswordRoute,
	resetPasswordRoute,
	emailRevertRoute,
	verifyEmailRoute,
	authorizeIPRoute,
	pendingRoute,
	reportRoute,
	...(RuntimeConfigStore.isSelfHosted() ? [] : [giftRegisterRoute, giftLoginRoute]),
]);
