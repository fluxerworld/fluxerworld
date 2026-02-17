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
import {AuthRouterLink} from '@app/components/auth/AuthRouterLink';
import FormField from '@app/components/auth/FormField';
import styles from '@app/components/pages/ForgotPasswordPage.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {useFluxerDocumentTitle} from '@app/hooks/useFluxerDocumentTitle';
import {useForm} from '@app/hooks/useForm';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useEffect, useId, useState} from 'react';

const ForgotPasswordPage = observer(function ForgotPasswordPage() {
	const {t} = useLingui();
	const emailId = useId();
	const [isSuccess, setIsSuccess] = useState(false);
	const [_error, setError] = useState<string | null>(null);

	useFluxerDocumentTitle(t`Forgot Password`);

	const form = useForm({
		initialValues: {email: ''},
		onSubmit: async (values) => {
			setError(null);

			try {
				await AuthenticationActionCreators.forgotPassword(values.email);
				setIsSuccess(true);
			} catch (_err) {
				form.setErrors({email: 'There was an error sending the reset link. Please try again.'});
			}
		},
	});

	useEffect(() => {
		setError(null);
	}, []);

	if (isSuccess) {
		return (
			<div className={styles.container}>
				<h1 className={styles.title}>
					<Trans>Check your email</Trans>
				</h1>

				<p className={styles.description}>
					<Trans>
						We've sent password reset instructions to your email address. Please check your inbox and follow the link to
						reset your password.
					</Trans>
				</p>

				<div className={styles.footer}>
					<AuthRouterLink to="/login" className={styles.primaryLink}>
						<Trans>Return to login</Trans>
					</AuthRouterLink>
				</div>
			</div>
		);
	}

	return (
		<>
			<h1 className={styles.title}>
				<Trans>Forgot your password?</Trans>
			</h1>

			<p className={styles.description}>
				<Trans>Enter your email address and we'll send you a link to reset your password.</Trans>
			</p>

			<form className={styles.form} onSubmit={form.handleSubmit}>
				<FormField
					id={emailId}
					name="email"
					type="email"
					autoComplete="email"
					required
					label={t`Email`}
					value={form.getValue('email')}
					onChange={(value) => form.setValue('email', value)}
					error={form.getError('email')}
				/>

				<Button type="submit" fitContainer disabled={form.isSubmitting}>
					<Trans>Send reset link</Trans>
				</Button>
			</form>

			<div className={styles.footer}>
				<div>
					<AuthRouterLink to="/login" className={styles.link}>
						<Trans>Back to login</Trans>
					</AuthRouterLink>
				</div>

				<div>
					<span className={styles.footerLabel}>
						<Trans>Don't have an account?</Trans>{' '}
					</span>
					<AuthRouterLink to="/register" className={styles.primaryLink}>
						<Trans>Register</Trans>
					</AuthRouterLink>
				</div>
			</div>
		</>
	);
});

export default ForgotPasswordPage;
