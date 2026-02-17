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
import styles from '@app/components/pages/LoginPage.module.css';
import * as RouterUtils from '@app/utils/RouterUtils';
import {completeSsoLogin} from '@app/viewmodels/auth/AuthFlow';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useRef, useState} from 'react';

const SSO_TIMEOUT_MS = 30_000;

const sanitizeRedirectTo = (redirectTo: string | undefined | null): string => {
	if (!redirectTo) return '/';
	const trimmed = redirectTo.trim();
	if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/';
	return trimmed;
};

const SsoCallbackPage = observer(function SsoCallbackPage() {
	const {t} = useLingui();
	const params = new URLSearchParams(window.location.search);
	const code = params['get']('code');
	const state = params['get']('state');
	const providerError = params['get']('error');
	const providerErrorDescription = params['get']('error_description');

	const [error, setError] = useState<string | null>(null);
	const [isProcessing, setIsProcessing] = useState(true);
	const abortControllerRef = useRef<AbortController | null>(null);

	const handleBackToLogin = useCallback(() => {
		RouterUtils.replaceWith('/login');
	}, []);

	const handleRetry = useCallback(() => {
		setError(null);
		setIsProcessing(true);
		window.location.reload();
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		abortControllerRef.current = controller;

		const timeoutId = setTimeout(() => {
			if (!controller.signal.aborted) {
				setError(t`SSO sign-in timed out. Please try again.`);
				setIsProcessing(false);
			}
		}, SSO_TIMEOUT_MS);

		(async () => {
			if (providerError) {
				setError(providerErrorDescription ? `${providerError}: ${providerErrorDescription}` : providerError);
				setIsProcessing(false);
				return;
			}
			if (!code || !state) {
				setError(t`Missing SSO code or state. Please try signing in again.`);
				setIsProcessing(false);
				return;
			}

			try {
				const result = await completeSsoLogin({code, state});
				if (controller.signal.aborted) return;

				await AuthenticationActionCreators.completeLogin({
					token: result.token,
					userId: result.userId,
				});
				if (controller.signal.aborted) return;

				RouterUtils.replaceWith(sanitizeRedirectTo(result.redirect_to));
			} catch (err) {
				if (controller.signal.aborted) return;
				const message = err instanceof Error ? err.message : t`Failed to complete SSO login`;
				setError(message);
				setIsProcessing(false);
			}
		})();

		return () => {
			clearTimeout(timeoutId);
			controller.abort();
		};
	}, [code, state, providerError, providerErrorDescription, t]);

	if (error) {
		return (
			<div className={styles.loginContainer}>
				<h1 className={styles.title}>
					<Trans>SSO Sign-in Failed</Trans>
				</h1>
				<div className={styles.loginNotice}>{error}</div>
				<div className={styles.ssoCallbackActions}>
					<button type="button" onClick={handleRetry} className={styles.ssoRetryButton}>
						<Trans>Try Again</Trans>
					</button>
					<button type="button" onClick={handleBackToLogin} className={styles.ssoBackButton}>
						<Trans>Back to Login</Trans>
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.loginContainer}>
			<h1 className={styles.title}>
				<Trans>Completing sign-in…</Trans>
			</h1>
			{isProcessing && (
				<p className={styles.ssoProcessingHint}>
					<Trans>Please wait while we complete your sign-in.</Trans>
				</p>
			)}
		</div>
	);
});

export default SsoCallbackPage;
