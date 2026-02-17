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
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import styles from '@app/components/auth/BrowserLoginHandoffModal.module.css';
import {Input} from '@app/components/form/Input';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import {getElectronAPI, openExternalUrl} from '@app/utils/NativeUtils';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {ArrowSquareOutIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

interface LoginSuccessPayload {
	token: string;
	userId: string;
}

interface BrowserLoginHandoffModalProps {
	onSuccess: (payload: LoginSuccessPayload) => Promise<void>;
	targetWebAppUrl?: string;
	prefillEmail?: string;
}

const CODE_LENGTH = 8;
const VALID_CODE_PATTERN = /^[A-Za-z0-9]{8}$/;

const formatCodeForDisplay = (raw: string): string => {
	const cleaned = raw
		.replace(/[^A-Za-z0-9]/g, '')
		.toUpperCase()
		.slice(0, CODE_LENGTH);

	if (cleaned.length <= 4) {
		return cleaned;
	}
	return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
};

const extractRawCode = (formatted: string): string => {
	return formatted
		.replace(/[^A-Za-z0-9]/g, '')
		.toUpperCase()
		.slice(0, CODE_LENGTH);
};

function normalizeInstanceOrigin(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) {
		throw new Error('Instance URL is required');
	}

	const candidate = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;

	const url = new URL(candidate);
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		throw new Error('Instance URL must use http or https');
	}

	return url.origin;
}

const BrowserLoginHandoffModal = observer(
	({onSuccess, targetWebAppUrl, prefillEmail}: BrowserLoginHandoffModalProps) => {
		const {i18n} = useLingui();

		const electronApi = getElectronAPI();
		const switchInstanceUrl = electronApi?.switchInstanceUrl;
		const canSwitchInstanceUrl = typeof switchInstanceUrl === 'function';

		const currentWebAppUrl = RuntimeConfigStore.webAppBaseUrl;
		const [instanceUrl, setInstanceUrl] = useState(() => targetWebAppUrl ?? currentWebAppUrl);
		const [instanceUrlError, setInstanceUrlError] = useState<string | null>(null);

		const [code, setCode] = useState('');
		const [isSubmitting, setIsSubmitting] = useState(false);
		const [error, setError] = useState<string | null>(null);
		const inputRef = useRef<HTMLInputElement | null>(null);
		const switchingInstanceRef = useRef(false);

		const instanceUrlHelper = useMemo(
			() => (canSwitchInstanceUrl ? i18n._(msg`The URL of the Fluxer instance you want to sign in to.`) : null),
			[canSwitchInstanceUrl, i18n],
		);

		const handleSubmit = useCallback(
			async (rawCode: string) => {
				if (!VALID_CODE_PATTERN.test(rawCode)) {
					return;
				}

				setIsSubmitting(true);
				setError(null);
				setInstanceUrlError(null);

				try {
					if (canSwitchInstanceUrl) {
						const trimmedInstanceUrl = instanceUrl.trim();
						if (trimmedInstanceUrl) {
							let instanceOrigin: string;
							try {
								instanceOrigin = normalizeInstanceOrigin(trimmedInstanceUrl);
							} catch {
								setInstanceUrlError(
									i18n._(msg`Invalid instance URL. Try something like "example.com" or "https://example.com".`),
								);
								return;
							}

							if (instanceOrigin !== window.location.origin) {
								try {
									switchingInstanceRef.current = true;
									await switchInstanceUrl({
										instanceUrl: instanceOrigin,
										desktopHandoffCode: rawCode,
									});
								} catch (switchError) {
									switchingInstanceRef.current = false;
									const detail = switchError instanceof Error ? switchError.message : String(switchError);
									setInstanceUrlError(detail);
								}
								return;
							}
						}
					}

					const result = await AuthenticationActionCreators.pollDesktopHandoffStatus(rawCode);

					if (result.status === 'completed' && result.token && result.user_id) {
						await onSuccess({token: result.token, userId: result.user_id});
						ModalActionCreators.pop();
						return;
					}

					if (result.status === 'pending') {
						setError(i18n._(msg`This code hasn't been used yet. Please complete login in your browser first.`));
					} else {
						setError(i18n._(msg`Invalid or expired code. Please try again.`));
					}
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					setError(message);
				} finally {
					if (!switchingInstanceRef.current) {
						setIsSubmitting(false);
					}
				}
			},
			[canSwitchInstanceUrl, i18n, instanceUrl, onSuccess, switchInstanceUrl],
		);

		const handleInstanceUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
			setInstanceUrl(e.target.value);
			setInstanceUrlError(null);
		}, []);

		const handleCodeChange = useCallback(
			(e: React.ChangeEvent<HTMLInputElement>) => {
				const rawCode = extractRawCode(e.target.value);
				setCode(rawCode);
				setError(null);
				setInstanceUrlError(null);

				if (VALID_CODE_PATTERN.test(rawCode)) {
					void handleSubmit(rawCode);
				}
			},
			[handleSubmit],
		);

		const handleOpenBrowser = useCallback(async () => {
			const fallbackUrl = targetWebAppUrl || currentWebAppUrl;
			let baseUrl = fallbackUrl;

			if (canSwitchInstanceUrl && instanceUrl.trim()) {
				try {
					baseUrl = normalizeInstanceOrigin(instanceUrl);
				} catch {
					setInstanceUrlError(
						i18n._(msg`Invalid instance URL. Try something like "example.com" or "https://example.com".`),
					);
					return;
				}
			}

			const loginUrl = new URL('/login', baseUrl);
			loginUrl.searchParams.set('desktop_handoff', '1');
			if (prefillEmail) {
				loginUrl.searchParams.set('email', prefillEmail);
			}

			await openExternalUrl(loginUrl.toString());
		}, [canSwitchInstanceUrl, currentWebAppUrl, i18n, instanceUrl, prefillEmail, targetWebAppUrl]);

		useEffect(() => {
			inputRef.current?.focus();
		}, []);

		return (
			<Modal.Root size="small" centered onClose={ModalActionCreators.pop}>
				<Modal.Header title={i18n._(msg`Add account`)} />
				<Modal.Content contentClassName={styles.content}>
					<p className={styles.description}>
						<Trans>Log in using your browser, then enter the code shown to add the account.</Trans>
					</p>

					{canSwitchInstanceUrl ? (
						<div className={styles.codeInputSection}>
							<Input
								label={i18n._(msg`Instance URL`)}
								value={instanceUrl}
								onChange={handleInstanceUrlChange}
								error={instanceUrlError ?? undefined}
								disabled={isSubmitting}
								autoComplete="url"
								placeholder="example.com"
								footer={
									instanceUrlHelper && !instanceUrlError ? (
										<p className={styles.inputHelper}>{instanceUrlHelper}</p>
									) : null
								}
							/>
						</div>
					) : null}

					<div className={styles.codeInputSection}>
						<Input
							ref={inputRef}
							label={i18n._(msg`Login code`)}
							value={formatCodeForDisplay(code)}
							onChange={handleCodeChange}
							error={error ?? undefined}
							disabled={isSubmitting}
							autoComplete="off"
						/>
					</div>

					{prefillEmail ? (
						<p className={styles.prefillHint}>
							<Trans>We will prefill {prefillEmail} once the browser login opens.</Trans>
						</p>
					) : null}
				</Modal.Content>

				<Modal.Footer>
					<Button variant="secondary" onClick={ModalActionCreators.pop} disabled={isSubmitting}>
						<Trans>Cancel</Trans>
					</Button>
					<Button variant="primary" onClick={handleOpenBrowser} submitting={isSubmitting}>
						<ArrowSquareOutIcon size={16} weight="bold" />
						<Trans>Open browser</Trans>
					</Button>
				</Modal.Footer>
			</Modal.Root>
		);
	},
);

export function showBrowserLoginHandoffModal(
	onSuccess: (payload: LoginSuccessPayload) => Promise<void>,
	targetWebAppUrl?: string,
	prefillEmail?: string,
): void {
	ModalActionCreators.push(
		modal(() => (
			<BrowserLoginHandoffModal
				onSuccess={async (payload) => {
					await onSuccess(payload);
				}}
				targetWebAppUrl={targetWebAppUrl}
				prefillEmail={prefillEmail}
			/>
		)),
	);
}

export default BrowserLoginHandoffModal;
