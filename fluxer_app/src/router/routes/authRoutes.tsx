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

import {i18n} from '@lingui/core';
import * as GiftActionCreators from '~/actions/GiftActionCreators';
import * as InviteActionCreators from '~/actions/InviteActionCreators';
import * as ThemeActionCreators from '~/actions/ThemeActionCreators';
import {AuthLayout} from '~/components/layout/AuthLayout';
import AuthorizeIPPage from '~/components/pages/AuthorizeIPPage';
import EmailRevertPage from '~/components/pages/EmailRevertPage';
import ForgotPasswordPage from '~/components/pages/ForgotPasswordPage';
import GiftLoginPage from '~/components/pages/GiftLoginPage';
import GiftRegisterPage from '~/components/pages/GiftRegisterPage';
import InviteLoginPage from '~/components/pages/InviteLoginPage';
import InviteRegisterPage from '~/components/pages/InviteRegisterPage';
import LoginPage from '~/components/pages/LoginPage';
import OAuthAuthorizePage from '~/components/pages/OAuthAuthorizePage';
import PendingVerificationPage from '~/components/pages/PendingVerificationPage';
import RegisterPage from '~/components/pages/RegisterPage';
import {ReportPage} from '~/components/pages/ReportPage';
import ResetPasswordPage from '~/components/pages/ResetPasswordPage';
import ThemeLoginPage from '~/components/pages/ThemeLoginPage';
import ThemeRegisterPage from '~/components/pages/ThemeRegisterPage';
import VerifyEmailPage from '~/components/pages/VerifyEmailPage';
import {createRoute, Redirect, type RouteContext} from '~/lib/router';
import SessionManager from '~/lib/SessionManager';
import {Routes} from '~/Routes';
import {rootRoute} from '~/router/routes/rootRoutes';
import AuthenticationStore from '~/stores/AuthenticationStore';
import RuntimeConfigStore from '~/stores/RuntimeConfigStore';
import * as RouterUtils from '~/utils/RouterUtils';

const resolveToPath = (to: Redirect['to']): string => {
	if (typeof to === 'string') {
		return to;
	}

	const url = new URL(to.to, window.location.origin);

	if (to.search) {
		const sp = new URLSearchParams();
		for (const [k, v] of Object.entries(to.search)) {
			if (v === undefined) continue;
			if (v === null) {
				sp.set(k, '');
			} else {
				sp.set(k, String(v));
			}
		}
		url.search = sp.toString() ? `?${sp.toString()}` : '';
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
					RouterUtils.replaceWith(`${Routes.LOGIN}?redirect_to=${encodeURIComponent(current)}`);
				}
			});
			return undefined;
		}

		if (!AuthenticationStore.isAuthenticated) {
			return new Redirect(`${Routes.LOGIN}?redirect_to=${encodeURIComponent(current)}`);
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
		const code = ctx.params.code;
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
		const code = ctx.params.code;
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
		const code = ctx.params.code;
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
		const code = ctx.params.code;
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

const pendingVerificationRoute = createRoute({
	getParentRoute: () => authLayoutRoute,
	id: 'pendingVerification',
	path: Routes.PENDING_VERIFICATION,
	component: () => <PendingVerificationPage />,
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
	registerRoute,
	oauthAuthorizeRoute,
	inviteRegisterRoute,
	inviteLoginRoute,
	themeRegisterRoute,
	themeLoginRoute,
	forgotPasswordRoute,
	resetPasswordRoute,
	emailRevertRoute,
	verifyEmailRoute,
	authorizeIPRoute,
	pendingVerificationRoute,
	reportRoute,
	...(RuntimeConfigStore.isSelfHosted() ? [] : [giftRegisterRoute, giftLoginRoute]),
]);
