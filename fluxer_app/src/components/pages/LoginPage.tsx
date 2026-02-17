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

import * as AuthenticationActionCreators from '@app/actions/AuthenticationActionCreators';
import {AuthLoginLayout} from '@app/components/auth/AuthLoginLayout';
import {AuthRouterLink} from '@app/components/auth/AuthRouterLink';
import {useDesktopHandoffFlow} from '@app/components/auth/auth_login_core/useDesktopHandoffFlow';
import {HandoffCodeDisplay} from '@app/components/auth/HandoffCodeDisplay';
import MfaScreen from '@app/components/auth/MfaScreen';
import {useFluxerDocumentTitle} from '@app/hooks/useFluxerDocumentTitle';
import {useLocation} from '@app/lib/router/React';
import AccountManager from '@app/stores/AccountManager';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import * as RouterUtils from '@app/utils/RouterUtils';
import type {LoginSuccessPayload} from '@app/viewmodels/auth/AuthFlow';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo} from 'react';

const LoginPage = observer(function LoginPage() {
	const location = useLocation();
	const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

	const rawRedirect = params['get']('redirect_to');
	const isDesktopHandoff = params['get']('desktop_handoff') === '1';
	const initialEmail = params['get']('email') ?? undefined;
	const registerSearch = rawRedirect ? {redirect_to: rawRedirect} : undefined;

	const redirectPath = isDesktopHandoff ? undefined : rawRedirect || '/';

	return (
		<AuthLoginLayout
			redirectPath={redirectPath}
			desktopHandoff={isDesktopHandoff}
			excludeCurrentUser={false}
			initialEmail={initialEmail}
			registerLink={
				<AuthRouterLink to="/register" search={registerSearch}>
					<Trans>Register</Trans>
				</AuthRouterLink>
			}
		/>
	);
});

const LoginPageMFA = observer(function LoginPageMFA() {
	const location = useLocation();
	const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

	const isDesktopHandoff = params['get']('desktop_handoff') === '1';
	const rawRedirect = params['get']('redirect_to');

	const redirectTo = isDesktopHandoff ? undefined : rawRedirect || '/';

	const mfaTicket = AuthenticationStore.currentMfaTicket ?? AuthenticationStore.mfaTicket;
	const mfaMethods = AuthenticationStore.availableMfaMethods ?? AuthenticationStore.mfaMethods;

	const hasStoredAccounts = AccountManager.orderedAccounts.length > 0;

	const handoff = useDesktopHandoffFlow({
		enabled: isDesktopHandoff,
		hasStoredAccounts,
		initialMode: 'idle',
	});

	const handleMfaSuccess = useCallback(
		async ({token, userId}: LoginSuccessPayload) => {
			if (isDesktopHandoff) {
				await handoff.start({token, userId});
				return;
			} else {
				await AuthenticationActionCreators.completeLogin({token, userId});
				AuthenticationActionCreators.clearMfaTicket();

				RouterUtils.replaceWith(redirectTo || '/');
				return;
			}
		},
		[handoff, isDesktopHandoff, redirectTo],
	);

	const handleCancel = useCallback(() => {
		AuthenticationActionCreators.clearMfaTicket();
	}, []);

	if (!mfaTicket || !mfaMethods) {
		return null;
	}

	if (
		isDesktopHandoff &&
		(handoff.mode === 'generating' || handoff.mode === 'displaying' || handoff.mode === 'error')
	) {
		return (
			<HandoffCodeDisplay
				code={handoff.code}
				isGenerating={handoff.mode === 'generating'}
				error={handoff.mode === 'error' ? handoff.error : null}
				onRetry={handoff.retry}
			/>
		);
	}

	return (
		<MfaScreen challenge={{ticket: mfaTicket, ...mfaMethods}} onSuccess={handleMfaSuccess} onCancel={handleCancel} />
	);
});

const LoginPageContainer = observer(() => {
	const {t} = useLingui();
	const loginState = AuthenticationStore.loginState;

	useFluxerDocumentTitle(t`Log in`);

	switch (loginState) {
		case 'default':
			return <LoginPage />;
		case 'mfa':
			return <LoginPageMFA />;
		default:
			return null;
	}
});

export default LoginPageContainer;
