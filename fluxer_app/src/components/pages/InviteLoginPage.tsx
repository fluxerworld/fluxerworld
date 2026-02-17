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
import * as InviteActionCreators from '@app/actions/InviteActionCreators';
import {AuthErrorState} from '@app/components/auth/AuthErrorState';
import {AuthLoadingState} from '@app/components/auth/AuthLoadingState';
import {AuthLoginLayout} from '@app/components/auth/AuthLoginLayout';
import sharedStyles from '@app/components/auth/AuthPageStyles.module.css';
import {AuthRouterLink} from '@app/components/auth/AuthRouterLink';
import {useDesktopHandoffFlow} from '@app/components/auth/auth_login_core/useDesktopHandoffFlow';
import {DesktopDeepLinkPrompt} from '@app/components/auth/DesktopDeepLinkPrompt';
import {HandoffCodeDisplay} from '@app/components/auth/HandoffCodeDisplay';
import {GuildInviteHeader, InviteHeader} from '@app/components/auth/InviteHeader';
import MfaScreen from '@app/components/auth/MfaScreen';
import {Button} from '@app/components/uikit/button/Button';
import {useAuthLayoutContext} from '@app/contexts/AuthLayoutContext';
import {useFluxerDocumentTitle} from '@app/hooks/useFluxerDocumentTitle';
import {useLocation, useParams} from '@app/lib/router/React';
import {Routes} from '@app/Routes';
import AccountManager from '@app/stores/AccountManager';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import InviteStore from '@app/stores/InviteStore';
import {isGroupDmInvite, isGuildInvite} from '@app/types/InviteTypes';
import {getGuildSplashURL} from '@app/utils/AvatarUtils';
import * as RouterUtils from '@app/utils/RouterUtils';
import {setPathQueryParams} from '@app/utils/UrlUtils';
import type {LoginSuccessPayload} from '@app/viewmodels/auth/AuthFlow';
import {GuildFeatures, GuildSplashCardAlignment} from '@fluxer/constants/src/GuildConstants';
import type {Invite} from '@fluxer/schema/src/domains/invite/InviteSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useMemo} from 'react';

interface InviteLoginPageProps {
	code: string;
	invite: Invite;
}

const InviteLoginPage = observer(function InviteLoginPage({code, invite}: InviteLoginPageProps) {
	const location = useLocation();
	const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

	const rawRedirect = params['get']('redirect_to');
	const isDesktopHandoff = params['get']('desktop_handoff') === '1';
	const registerSearch = rawRedirect ? {redirect_to: rawRedirect} : undefined;
	const redirectPath = useMemo(() => {
		return setPathQueryParams('/', {invite: code, redirect_to: rawRedirect});
	}, [code, rawRedirect]);

	return (
		<AuthLoginLayout
			redirectPath={redirectPath}
			desktopHandoff={isDesktopHandoff}
			inviteCode={code}
			extraTopContent={
				<>
					<DesktopDeepLinkPrompt code={code} kind="invite" preferLogin={true} />
					<InviteHeader invite={invite} />
				</>
			}
			showTitle={false}
			registerLink={
				<AuthRouterLink to={Routes.inviteRegister(code)} search={registerSearch}>
					<Trans>Register</Trans>
				</AuthRouterLink>
			}
		/>
	);
});

const InviteLoginPageMFA = observer(function InviteLoginPageMFA() {
	const location = useLocation();
	const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

	const isDesktopHandoff = params['get']('desktop_handoff') === '1';
	const rawRedirect = params['get']('redirect_to');
	const redirectTo = isDesktopHandoff ? undefined : rawRedirect || '/';

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
			AuthenticationActionCreators.clearMfaTicket();
			RouterUtils.replaceWith(redirectTo || '/');
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

const InviteLoginPageContainer = observer(() => {
	const {t} = useLingui();
	const loginState = AuthenticationStore.loginState;
	const {code} = useParams() as {code: string};

	useFluxerDocumentTitle(t`Accept Invite`);

	const {setSplashUrl, setSplashCardAlignment} = useAuthLayoutContext();

	const inviteState = InviteStore.invites.get(code) ?? null;
	const inviteData = inviteState?.data ?? null;
	const guildInvite = inviteData && isGuildInvite(inviteData) ? inviteData : null;

	useEffect(() => {
		const currentInviteState = InviteStore.invites.get(code) ?? null;
		if (!currentInviteState && code) {
			void InviteActionCreators.fetchWithCoalescing(code).catch(() => {});
		}
	}, [code]);

	useEffect(() => {
		if (!guildInvite) {
			return;
		}
		const guild = guildInvite.guild;
		if (guild?.splash && guild.id) {
			const splashUrl = getGuildSplashURL({id: guild.id, splash: guild.splash}, 4096) ?? null;
			setSplashUrl(splashUrl);
		}
	}, [guildInvite?.guild?.splash, guildInvite?.guild?.id, setSplashUrl]);

	useEffect(() => {
		if (guildInvite) {
			setSplashCardAlignment(guildInvite.guild.splash_card_alignment ?? GuildSplashCardAlignment.CENTER);
		} else {
			setSplashCardAlignment(GuildSplashCardAlignment.CENTER);
		}
	}, [guildInvite?.guild?.splash_card_alignment, setSplashCardAlignment]);

	if (!inviteState || inviteState.loading) {
		return <AuthLoadingState />;
	}

	if (inviteState.error || !inviteState.data) {
		return (
			<AuthErrorState
				title={<Trans>Invite not found</Trans>}
				text={<Trans>This invite may have expired or been deleted.</Trans>}
			/>
		);
	}

	const invite = inviteState.data;
	const isGroupDM = isGroupDmInvite(invite);

	const guildFeatures = guildInvite?.guild.features
		? Array.isArray(guildInvite.guild.features)
			? guildInvite.guild.features
			: [...guildInvite.guild.features]
		: [];
	const isInvitesDisabled = guildFeatures.includes(GuildFeatures.INVITES_DISABLED);

	if (isInvitesDisabled && !isGroupDM) {
		return (
			<div className={sharedStyles.container}>
				<DesktopDeepLinkPrompt code={code} kind="invite" preferLogin={true} />

				{guildInvite ? <GuildInviteHeader invite={guildInvite} /> : null}

				<div className={sharedStyles.disabledContainer}>
					<p className={sharedStyles.disabledText}>
						<Trans>This community has temporarily disabled invites.</Trans>
					</p>
					<p className={sharedStyles.disabledSubtext}>
						<Trans>
							You can still create an account or log in. If invites are re-enabled later, you can use this same link to
							join.
						</Trans>
					</p>
				</div>

				<div className={sharedStyles.disabledActions}>
					<AuthRouterLink to="/register" className={sharedStyles.disabledActionLink}>
						<Button fitContainer>
							<Trans>Create Account</Trans>
						</Button>
					</AuthRouterLink>
					<AuthRouterLink to="/login" className={sharedStyles.disabledActionLink}>
						<Button fitContainer variant="secondary">
							<Trans>Log In</Trans>
						</Button>
					</AuthRouterLink>
				</div>
			</div>
		);
	}

	switch (loginState) {
		case 'default':
			return <InviteLoginPage code={code} invite={invite} />;
		case 'mfa':
			return <InviteLoginPageMFA />;
		default:
			return null;
	}
});

export default InviteLoginPageContainer;
