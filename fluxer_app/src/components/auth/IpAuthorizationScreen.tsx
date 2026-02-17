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
import styles from '@app/components/auth/IpAuthorizationScreen.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {Logger} from '@app/lib/Logger';
import type {IpAuthorizationChallenge} from '@app/viewmodels/auth/AuthFlow';
import {Trans} from '@lingui/react/macro';
import {EnvelopeSimpleIcon, WarningCircleIcon} from '@phosphor-icons/react';
import {useCallback, useEffect, useRef, useState} from 'react';

type PollingState = 'polling' | 'error';

interface IpAuthorizationScreenProps {
	challenge: IpAuthorizationChallenge;
	onAuthorized: (payload: {token: string; userId: string}) => Promise<void> | void;
	onBack?: () => void;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ERRORS = 3;

const logger = new Logger('IpAuthorizationScreen');

const IpAuthorizationScreen = ({challenge, onAuthorized, onBack}: IpAuthorizationScreenProps) => {
	const [resendUsed, setResendUsed] = useState(false);
	const [resendIn, setResendIn] = useState(challenge.resendAvailableIn);
	const [pollingState, setPollingState] = useState<PollingState>('polling');
	const onAuthorizedRef = useRef(onAuthorized);
	onAuthorizedRef.current = onAuthorized;

	useEffect(() => {
		setResendUsed(false);
		setResendIn(challenge.resendAvailableIn);
		setPollingState('polling');
	}, [challenge]);

	useEffect(() => {
		let pollTimeout: ReturnType<typeof setTimeout> | null = null;
		let isMounted = true;
		let consecutiveErrors = 0;

		const poll = async () => {
			if (!isMounted) return;

			try {
				const result = await AuthenticationActionCreators.pollIpAuthorization(challenge.ticket);

				if (!isMounted) return;

				if (result.completed && result.token && result.user_id) {
					await onAuthorizedRef.current({token: result.token, userId: result.user_id});
					return;
				}

				consecutiveErrors = 0;
				pollTimeout = setTimeout(poll, POLL_INTERVAL_MS);
			} catch (error) {
				if (!isMounted) return;

				consecutiveErrors++;

				if (consecutiveErrors >= MAX_POLL_ERRORS) {
					setPollingState('error');
					logger.error('Failed to poll IP authorization after max retries', error);
				} else {
					pollTimeout = setTimeout(poll, POLL_INTERVAL_MS);
				}
			}
		};

		poll();

		return () => {
			isMounted = false;
			if (pollTimeout) {
				clearTimeout(pollTimeout);
			}
		};
	}, [challenge.ticket, pollingState]);

	useEffect(() => {
		if (resendIn <= 0) return;
		const interval = setInterval(() => {
			setResendIn((prev) => (prev > 0 ? prev - 1 : 0));
		}, 1000);
		return () => clearInterval(interval);
	}, [resendIn]);

	const handleResend = useCallback(async () => {
		if (resendIn > 0 || resendUsed) return;
		try {
			await AuthenticationActionCreators.resendIpAuthorization(challenge.ticket);
			setResendUsed(true);
			setResendIn(30);
		} catch (error) {
			logger.error('Failed to resend IP authorization email', error);
		}
	}, [challenge.ticket, resendIn, resendUsed]);

	const handleRetry = useCallback(() => {
		setPollingState('polling');
	}, []);

	return (
		<div className={styles.container}>
			<div className={styles.icon}>
				{pollingState === 'error' ? (
					<WarningCircleIcon size={48} weight="fill" />
				) : (
					<EnvelopeSimpleIcon size={48} weight="fill" />
				)}
			</div>
			<h1 className={styles.title}>
				{pollingState === 'error' ? <Trans>Connection lost</Trans> : <Trans>Check your email</Trans>}
			</h1>
			<p className={styles.description}>
				{pollingState === 'error' ? (
					<Trans>We lost the connection while waiting for authorization. Please try again.</Trans>
				) : (
					<Trans>We emailed a link to authorize this login. Please open your inbox for {challenge.email}.</Trans>
				)}
			</p>
			<div className={styles.actions}>
				{pollingState === 'error' ? (
					<Button variant="primary" onClick={handleRetry}>
						<Trans>Retry</Trans>
					</Button>
				) : (
					<Button variant="secondary" onClick={handleResend} disabled={resendIn > 0 || resendUsed}>
						{resendUsed ? <Trans>Resent</Trans> : <Trans>Resend email</Trans>}
						{resendIn > 0 ? ` (${resendIn}s)` : ''}
					</Button>
				)}
				{onBack ? (
					<Button variant="secondary" onClick={onBack}>
						<Trans>Back</Trans>
					</Button>
				) : null}
			</div>
		</div>
	);
};

export default IpAuthorizationScreen;
