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
import {modal} from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as UserActionCreators from '@app/actions/UserActionCreators';
import {Form} from '@app/components/form/Form';
import {Input} from '@app/components/form/Input';
import styles from '@app/components/modals/ClaimAccountModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import type {HttpError} from '@app/lib/HttpError';
import ModalStore from '@app/stores/ModalStore';
import * as FormUtils from '@app/utils/FormUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useEffect, useMemo, useState} from 'react';
import {useForm} from 'react-hook-form';

interface FormInputs {
	email: string;
	newPassword: string;
	verificationCode: string;
}

type Stage = 'collect' | 'verify';

export const ClaimAccountModal = observer(() => {
	const {t, i18n} = useLingui();
	const form = useForm<FormInputs>({
		defaultValues: {email: '', newPassword: '', verificationCode: ''},
	});
	const [stage, setStage] = useState<Stage>('collect');
	const [ticket, setTicket] = useState<string | null>(null);
	const [originalProof, setOriginalProof] = useState<string | null>(null);
	const [resendNewAt, setResendNewAt] = useState<Date | null>(null);
	const [submittingAction, setSubmittingAction] = useState<boolean>(false);
	const [now, setNow] = useState<number>(Date.now());

	useEffect(() => {
		const id = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(id);
	}, []);

	const canResendNew = useMemo(() => !resendNewAt || resendNewAt.getTime() <= now, [resendNewAt, now]);
	const resendSecondsRemaining = useMemo(() => {
		if (!resendNewAt) return 0;
		return Math.max(0, Math.ceil((resendNewAt.getTime() - now) / 1000));
	}, [resendNewAt, now]);

	const startEmailTokenFlow = async (data: FormInputs) => {
		let activeTicket = ticket;
		let activeProof = originalProof;
		if (!activeTicket || !activeProof) {
			const startResult = await UserActionCreators.startEmailChange();
			activeTicket = startResult.ticket;
			activeProof = startResult.original_proof ?? null;
			setTicket(startResult.ticket);
			setOriginalProof(activeProof);
			if (startResult.resend_available_at) {
				setResendNewAt(new Date(startResult.resend_available_at));
			}
		}

		if (!activeProof) {
			throw new Error('Missing original proof token');
		}

		const result = await UserActionCreators.requestEmailChangeNew(activeTicket!, data.email, activeProof);
		setResendNewAt(result.resend_available_at ? new Date(result.resend_available_at) : null);
		form.setValue('verificationCode', '');
		form.clearErrors('verificationCode');
		setStage('verify');
		ToastActionCreators.createToast({type: 'success', children: t`Verification code sent`});
	};

	const handleVerifyNew = async (data: FormInputs) => {
		if (!ticket || !originalProof) return;
		setSubmittingAction(true);
		try {
			const {email_token} = await UserActionCreators.verifyEmailChangeNew(ticket, data.verificationCode, originalProof);
			await UserActionCreators.update({
				email_token,
				new_password: data.newPassword,
			});
			ToastActionCreators.createToast({type: 'success', children: t`Account claimed successfully`});
			ModalActionCreators.pop();
		} catch (error: unknown) {
			FormUtils.handleError(i18n, form, error as HttpError, 'verificationCode', {
				pathMap: {new_password: 'newPassword'},
			});
		} finally {
			setSubmittingAction(false);
		}
	};

	const handleResendNew = async () => {
		if (!ticket || !canResendNew) return;
		setSubmittingAction(true);
		try {
			await UserActionCreators.resendEmailChangeNew(ticket);
			setResendNewAt(new Date(Date.now() + 30 * 1000));
			ToastActionCreators.createToast({type: 'success', children: t`Code resent`});
		} catch (error: unknown) {
			FormUtils.handleError(i18n, form, error as HttpError, 'verificationCode');
		} finally {
			setSubmittingAction(false);
		}
	};

	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit: startEmailTokenFlow,
		defaultErrorField: 'email',
	});

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Claim Your Account`} />
			{stage === 'collect' ? (
				<Form form={form} onSubmit={handleSubmit}>
					<Modal.Content>
						<Modal.ContentLayout>
							<Modal.Description>
								<Trans>
									Claim your account by adding an email and password. We will send a verification code to confirm your
									email before finishing.
								</Trans>
							</Modal.Description>
							<Modal.InputGroup>
								<Input
									{...form.register('email')}
									autoComplete="email"
									autoFocus={true}
									error={form.formState.errors.email?.message}
									label={t`Email`}
									maxLength={256}
									minLength={1}
									placeholder={t`marty@example.com`}
									required={true}
									type="email"
								/>
								<Input
									{...form.register('newPassword')}
									autoComplete="new-password"
									error={form.formState.errors.newPassword?.message}
									label={t`Password`}
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
						<Button type="submit" submitting={isSubmitting}>
							<Trans>Send code</Trans>
						</Button>
					</Modal.Footer>
				</Form>
			) : (
				<Form form={form} onSubmit={handleVerifyNew}>
					<Modal.Content>
						<Modal.ContentLayout>
							<Modal.Description>
								<Trans>
									Enter the code we sent to your email to verify it. Your password will be set once the code is
									confirmed.
								</Trans>
							</Modal.Description>
							<Modal.InputGroup>
								<Input
									{...form.register('verificationCode')}
									autoFocus={true}
									label={t`Verification Code`}
									placeholder="XXXX-XXXX"
									required={true}
									error={form.formState.errors.verificationCode?.message}
								/>
								<Input
									{...form.register('newPassword')}
									autoComplete="new-password"
									error={form.formState.errors.newPassword?.message}
									label={t`Password`}
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
						<Button onClick={ModalActionCreators.pop} variant="secondary" type="button">
							<Trans>Cancel</Trans>
						</Button>
						<Button type="button" onClick={handleResendNew} disabled={!canResendNew || submittingAction}>
							{canResendNew ? <Trans>Resend</Trans> : <Trans>Resend ({resendSecondsRemaining}s)</Trans>}
						</Button>
						<Button type="submit" submitting={submittingAction}>
							<Trans>Claim Account</Trans>
						</Button>
					</Modal.Footer>
				</Form>
			)}
		</Modal.Root>
	);
});

const CLAIM_ACCOUNT_MODAL_KEY = 'claim-account-modal';
let hasShownClaimAccountModalThisSession = false;

export const openClaimAccountModal = ({force = false}: {force?: boolean} = {}): void => {
	if (ModalStore.hasModal(CLAIM_ACCOUNT_MODAL_KEY)) {
		return;
	}
	if (!force && hasShownClaimAccountModalThisSession) {
		return;
	}
	hasShownClaimAccountModalThisSession = true;
	ModalActionCreators.pushWithKey(
		modal(() => <ClaimAccountModal />),
		CLAIM_ACCOUNT_MODAL_KEY,
	);
};
