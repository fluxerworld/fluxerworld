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
import * as GiftActionCreators from '@app/actions/GiftActionCreators';
import {fetchWithCoalescing, type Gift} from '@app/actions/GiftActionCreators';
import {AuthErrorState} from '@app/components/auth/AuthErrorState';
import {AuthLoadingState} from '@app/components/auth/AuthLoadingState';
import {AuthLoginLayout} from '@app/components/auth/AuthLoginLayout';
import {AuthRouterLink} from '@app/components/auth/AuthRouterLink';
import {useDesktopHandoffFlow} from '@app/components/auth/auth_login_core/useDesktopHandoffFlow';
import {DesktopDeepLinkPrompt} from '@app/components/auth/DesktopDeepLinkPrompt';
import {GiftHeader} from '@app/components/auth/GiftHeader';
import {HandoffCodeDisplay} from '@app/components/auth/HandoffCodeDisplay';
import MfaScreen from '@app/components/auth/MfaScreen';
import {useFluxerDocumentTitle} from '@app/hooks/useFluxerDocumentTitle';
import {useLocation, useParams} from '@app/lib/router/React';
import {Routes} from '@app/Routes';
import AccountManager from '@app/stores/AccountManager';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import GiftStore from '@app/stores/GiftStore';
import * as RouterUtils from '@app/utils/RouterUtils';
import {setPathQueryParams} from '@app/utils/UrlUtils';
import type {LoginSuccessPayload} from '@app/viewmodels/auth/AuthFlow';
import {Trans, useLingui} from '@lingui/react/macro';
import {GiftIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useMemo} from 'react';

interface GiftLoginPageProps {
	code: string;
	gift: Gift;
}

const GiftLoginPage = observer(function GiftLoginPage({code, gift}: GiftLoginPageProps) {
	const location = useLocation();
	const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

	const rawRedirect = params['get']('redirect_to');
	const isDesktopHandoff = params['get']('desktop_handoff') === '1';
	const registerSearch = rawRedirect ? {redirect_to: rawRedirect} : undefined;
	const redirectPath = useMemo(() => {
		if (!rawRedirect) {
			return '/';
		}
		return setPathQueryParams('/', {redirect_to: rawRedirect});
	}, [rawRedirect]);

	const handleLoginComplete = useCallback(() => {
		GiftActionCreators.openAcceptModal(code);
	}, [code]);

	return (
		<AuthLoginLayout
			redirectPath={redirectPath || '/'}
			desktopHandoff={isDesktopHandoff}
			extraTopContent={
				<>
					<DesktopDeepLinkPrompt code={code} kind="gift" preferLogin={true} />
					<GiftHeader gift={gift} variant="login" />
				</>
			}
			showTitle={false}
			registerLink={
				<AuthRouterLink to={Routes.giftRegister(code)} search={registerSearch}>
					<Trans>Register</Trans>
				</AuthRouterLink>
			}
			onLoginComplete={handleLoginComplete}
		/>
	);
});

const GiftLoginPageMFA = observer(function GiftLoginPageMFA() {
	const location = useLocation();
	const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

	const isDesktopHandoff = params['get']('desktop_handoff') === '1';
	const rawRedirect = params['get']('redirect_to');
	const redirectTo = isDesktopHandoff ? undefined : rawRedirect || '/';
	const {code} = useParams() as {code: string};

	const mfaTicket = AuthenticationStore.currentMfaTicket;
	const mfaMethods = AuthenticationStore.availableMfaMethods;

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
			}

			await AuthenticationActionCreators.completeLogin({token, userId});
			GiftActionCreators.openAcceptModal(code);
			AuthenticationActionCreators.clearMfaTicket();
			RouterUtils.replaceWith(redirectTo || '/');
		},
		[handoff, isDesktopHandoff, redirectTo, code],
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

const GiftLoginPageContainer = observer(() => {
	const {t} = useLingui();
	const loginState = AuthenticationStore.loginState;
	const {code} = useParams() as {code: string};

	useFluxerDocumentTitle(t`Claim Gift`);

	const giftState = GiftStore.gifts.get(code) ?? null;

	useEffect(() => {
		const currentGiftState = GiftStore.gifts.get(code) ?? null;
		if (!currentGiftState && code) {
			void fetchWithCoalescing(code).catch(() => {});
		}
	}, [code]);

	if (!giftState || giftState.loading) {
		return <AuthLoadingState />;
	}

	if (giftState.error || !giftState.data) {
		return (
			<AuthErrorState
				title={<Trans>Gift not found</Trans>}
				text={<Trans>This gift code may be invalid, expired, or already redeemed.</Trans>}
			/>
		);
	}

	const gift = giftState.data;

	if (gift.redeemed) {
		return (
			<AuthErrorState
				icon={GiftIcon}
				title={<Trans>Gift already redeemed</Trans>}
				text={<Trans>This gift code has already been claimed.</Trans>}
			/>
		);
	}

	switch (loginState) {
		case 'default':
			return <GiftLoginPage code={code} gift={gift} />;
		case 'mfa':
			return <GiftLoginPageMFA />;
		default:
			return null;
	}
});

export default GiftLoginPageContainer;
