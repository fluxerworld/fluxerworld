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

import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as UserActionCreators from '@app/actions/UserActionCreators';
import {Form} from '@app/components/form/Form';
import {Input} from '@app/components/form/Input';
import * as Modal from '@app/components/modals/Modal';
import styles from '@app/components/modals/PasswordChangeModal.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useForm} from 'react-hook-form';

type Stage = 'intro' | 'verifyEmail' | 'changePassword';

interface PasswordForm {
	new_password: string;
	confirm_password: string;
}

export const PasswordChangeModal = observer(() => {
	const {t} = useLingui();
	const passwordForm = useForm<PasswordForm>();
	const [stage, setStage] = useState<Stage>('intro');
	const [ticket, setTicket] = useState<string | null>(null);
	const [verificationProof, setVerificationProof] = useState<string | null>(null);
	const [code, setCode] = useState<string>('');
	const [resendAt, setResendAt] = useState<Date | null>(null);
	const [submitting, setSubmitting] = useState<boolean>(false);
	const [codeError, setCodeError] = useState<string | null>(null);
	const [now, setNow] = useState<number>(Date.now());

	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, []);

	const canResend = useMemo(() => !resendAt || resendAt.getTime() <= now, [resendAt, now]);
	const secondsRemaining = useMemo(
		() => (resendAt ? Math.max(0, Math.ceil((resendAt.getTime() - now) / 1000)) : 0),
		[resendAt, now],
	);

	const startFlow = useCallback(async () => {
		setSubmitting(true);
		try {
			const result = await UserActionCreators.startPasswordChange();
			setTicket(result.ticket);
			if (result.resend_available_at) {
				setResendAt(new Date(result.resend_available_at));
			}
			setStage('verifyEmail');
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : t`Unable to start password change`;
			ToastActionCreators.error(errorMessage);
		} finally {
			setSubmitting(false);
		}
	}, [t]);

	const handleVerify = useCallback(async () => {
		if (!ticket) return;
		setSubmitting(true);
		setCodeError(null);
		try {
			const result = await UserActionCreators.verifyPasswordChangeCode(ticket, code);
			setVerificationProof(result.verification_proof);
			setStage('changePassword');
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : t`Invalid or expired code`;
			setCodeError(errorMessage);
		} finally {
			setSubmitting(false);
		}
	}, [ticket, code, t]);

	const handleResend = useCallback(async () => {
		if (!ticket || !canResend) return;
		setSubmitting(true);
		try {
			await UserActionCreators.resendPasswordChangeCode(ticket);
			setResendAt(new Date(Date.now() + 30 * 1000));
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : t`Unable to resend code right now`;
			ToastActionCreators.error(errorMessage);
		} finally {
			setSubmitting(false);
		}
	}, [ticket, canResend, t]);

	const onPasswordSubmit = useCallback(
		async (data: PasswordForm) => {
			if (!ticket || !verificationProof) return;
			if (data.new_password !== data.confirm_password) {
				passwordForm.setError('confirm_password', {message: t`Passwords do not match`});
				return;
			}
			await UserActionCreators.completePasswordChange(ticket, verificationProof, data.new_password);
			ModalActionCreators.pop();
			ToastActionCreators.createToast({type: 'success', children: <Trans>Password changed</Trans>});
		},
		[ticket, verificationProof, passwordForm, t],
	);

	const {handleSubmit: handlePasswordSubmit, isSubmitting: isPasswordSubmitting} = useFormSubmit({
		form: passwordForm,
		onSubmit: onPasswordSubmit,
		defaultErrorField: 'new_password',
	});

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Update Your Password`} />
			{stage === 'intro' && (
				<>
					<Modal.Content>
						<Modal.ContentLayout>
							<Modal.Description>
								<Trans>We'll send a verification code to your email before you can change your password.</Trans>
							</Modal.Description>
						</Modal.ContentLayout>
					</Modal.Content>
					<Modal.Footer className={styles.footer}>
						<Button onClick={ModalActionCreators.pop} variant="secondary">
							<Trans>Cancel</Trans>
						</Button>
						<Button onClick={startFlow} submitting={submitting}>
							<Trans>Start</Trans>
						</Button>
					</Modal.Footer>
				</>
			)}

			{stage === 'verifyEmail' && (
				<>
					<Modal.Content>
						<Modal.ContentLayout>
							<Modal.Description>
								<Trans>Enter the code sent to your email address.</Trans>
							</Modal.Description>
							<Modal.InputGroup>
								<Input
									autoFocus={true}
									value={code}
									onChange={(event) => setCode(event.target.value)}
									label={t`Verification Code`}
									placeholder="XXXX-XXXX"
									required={true}
									error={codeError ?? undefined}
								/>
							</Modal.InputGroup>
						</Modal.ContentLayout>
					</Modal.Content>
					<Modal.Footer className={styles.footer}>
						<Button onClick={ModalActionCreators.pop} variant="secondary">
							<Trans>Cancel</Trans>
						</Button>
						<Button onClick={handleResend} disabled={!canResend || submitting}>
							{canResend ? <Trans>Resend</Trans> : <Trans>Resend ({secondsRemaining}s)</Trans>}
						</Button>
						<Button onClick={handleVerify} submitting={submitting}>
							<Trans>Verify</Trans>
						</Button>
					</Modal.Footer>
				</>
			)}

			{stage === 'changePassword' && (
				<Form form={passwordForm} onSubmit={handlePasswordSubmit} aria-label={t`Change password form`}>
					<Modal.Content>
						<Modal.ContentLayout>
							<Modal.Description>
								<Trans>Choose a new password.</Trans>
							</Modal.Description>
							<Modal.InputGroup>
								<Input
									{...passwordForm.register('new_password')}
									autoComplete="new-password"
									autoFocus={true}
									error={passwordForm.formState.errors.new_password?.message}
									label={t`New Password`}
									maxLength={128}
									minLength={8}
									placeholder={'•'.repeat(32)}
									required={true}
									type="password"
								/>
								<Input
									{...passwordForm.register('confirm_password')}
									autoComplete="new-password"
									error={passwordForm.formState.errors.confirm_password?.message}
									label={t`Confirm New Password`}
									maxLength={128}
									minLength={8}
									placeholder={'•'.repeat(32)}
									required={true}
									type="password"
								/>
							</Modal.InputGroup>
						</Modal.ContentLayout>
					</Modal.Content>
					<Modal.Footer className={styles.footer}>
						<Button onClick={ModalActionCreators.pop} variant="secondary">
							<Trans>Cancel</Trans>
						</Button>
						<Button type="submit" submitting={isPasswordSubmitting}>
							<Trans>Change Password</Trans>
						</Button>
					</Modal.Footer>
				</Form>
			)}
		</Modal.Root>
	);
});
