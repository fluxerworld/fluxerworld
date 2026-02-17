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
	errorMessage: string | null;
	isSending: boolean;
	onEmailChange: (value: string) => void;
	onSubmit: () => void;
	onStartOver: () => void;
}

export const ReportStepEmail: React.FC<Props> = ({
	email,
	errorMessage,
	isSending,
	onEmailChange,
	onSubmit,
	onStartOver,
}) => {
	const {t} = useLingui();
	const normalizedEmail = email.trim();
	const emailLooksValid = normalizedEmail.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

	return (
		<div className={styles.card}>
			<header className={styles.cardHeader}>
				<p className={styles.eyebrow}>
					<Trans>Step 2</Trans>
				</p>
				<h1 className={styles.title}>
					<Trans>Verify your email</Trans>
				</h1>
				<p className={styles.description}>
					<Trans>We'll send a short code to confirm you can receive updates about this report.</Trans>
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
						onSubmit();
					}}
				>
					<Input
						label={t`Email Address`}
						type="email"
						value={email}
						onChange={(e) => onEmailChange(e.target.value)}
						placeholder="you@example.com"
						autoComplete="email"
					/>

					<div className={styles.actionRow}>
						<Button
							fitContent
							type="submit"
							disabled={!emailLooksValid || isSending}
							submitting={isSending}
							className={styles.actionButton}
						>
							<Trans>Send Verification Code</Trans>
						</Button>

						<Button
							variant="secondary"
							fitContent
							type="button"
							onClick={onStartOver}
							disabled={isSending}
							className={styles.actionButton}
						>
							<Trans>Start over</Trans>
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
};
