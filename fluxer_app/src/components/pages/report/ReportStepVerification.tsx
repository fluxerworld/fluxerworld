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

import {Input} from '@app/components/form/Input';
import styles from '@app/components/pages/ReportPage.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {Trans, useLingui} from '@lingui/react/macro';
import type React from 'react';

interface Props {
	email: string;
	verificationCode: string;
	errorMessage: string | null;
	isVerifying: boolean;
	isResending: boolean;
	resendCooldownSeconds: number;
	onChangeEmail: () => void;
	onResend: () => void;
	onVerify: () => void;
	onCodeChange: (value: string) => void;
	onStartOver: () => void;
}

export const ReportStepVerification: React.FC<Props> = ({
	email,
	verificationCode,
	errorMessage,
	isVerifying,
	isResending,
	resendCooldownSeconds,
	onChangeEmail,
	onResend,
	onVerify,
	onCodeChange,
	onStartOver,
}) => {
	const {t} = useLingui();
	const codeForValidation = verificationCode.trim().toUpperCase();
	const codeLooksValid = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codeForValidation);

	return (
		<div className={styles.card}>
			<header className={styles.cardHeader}>
				<p className={styles.eyebrow}>
					<Trans>Step 3</Trans>
				</p>
				<h1 className={styles.title}>
					<Trans>Enter verification code</Trans>
				</h1>
				<p className={styles.description}>
					<Trans>We sent a code to {email}.</Trans>
				</p>
			</header>

			<div className={styles.cardBody}>
				{errorMessage && (
					<div className={styles.errorBox} role="alert" aria-live="polite">
						{errorMessage}
					</div>
				)}

				<form
					className={styles.form}
					onSubmit={(e) => {
						e.preventDefault();
						onVerify();
					}}
				>
					<Input
						label={t`Verification Code`}
						type="text"
						value={verificationCode}
						onChange={(e) => onCodeChange(e.target.value)}
						placeholder="ABCD-1234"
						autoComplete="one-time-code"
					/>

					<div className={styles.actionRow}>
						<Button
							fitContent
							type="submit"
							disabled={!codeLooksValid || isVerifying}
							submitting={isVerifying}
							className={styles.actionButton}
						>
							<Trans>Verify Code</Trans>
						</Button>

						<Button
							variant="secondary"
							fitContent
							type="button"
							onClick={onResend}
							disabled={isResending || isVerifying || resendCooldownSeconds > 0}
							submitting={isResending}
						>
							{resendCooldownSeconds > 0 ? (
								<Trans>Resend ({resendCooldownSeconds}s)</Trans>
							) : (
								<Trans>Resend code</Trans>
							)}
						</Button>
					</div>
				</form>
			</div>

			<footer className={styles.footerLinks}>
				<p className={styles.linkRow}>
					<button type="button" className={styles.linkButton} onClick={onChangeEmail}>
						<Trans>Change email</Trans>
					</button>
					<span aria-hidden="true" className={styles.linkSeparator}>
						·
					</span>
					<button type="button" className={styles.linkButton} onClick={onStartOver}>
						<Trans>Start over</Trans>
					</button>
				</p>
			</footer>
		</div>
	);
};
