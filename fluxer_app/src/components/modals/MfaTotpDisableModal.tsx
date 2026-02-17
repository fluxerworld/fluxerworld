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

import * as MfaActionCreators from '@app/actions/MfaActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Form} from '@app/components/form/Form';
import {Input} from '@app/components/form/Input';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useForm} from 'react-hook-form';

interface FormInputs {
	code: string;
}

export const MfaTotpDisableModal = observer(() => {
	const {t} = useLingui();
	const form = useForm<FormInputs>();

	const onSubmit = async (data: FormInputs) => {
		await MfaActionCreators.disableMfaTotp(data.code.split(' ').join(''));
		ModalActionCreators.pop();
		ToastActionCreators.createToast({type: 'success', children: <Trans>Two-factor authentication disabled</Trans>});
	};

	const {handleSubmit} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'code',
	});

	return (
		<Modal.Root size="small" centered>
			<Form form={form} onSubmit={handleSubmit} aria-label={t`Disable two-factor authentication form`}>
				<Modal.Header title={t`Remove Authenticator App`} />
				<Modal.Content>
					<Modal.ContentLayout>
						<Input
							{...form.register('code')}
							autoComplete="one-time-code"
							autoFocus={true}
							error={form.formState.errors.code?.message}
							label={t`Code`}
							required={true}
							footer={
								<Modal.Description>
									<Trans>Enter the 6-digit code from your authenticator app.</Trans>
								</Modal.Description>
							}
						/>
					</Modal.ContentLayout>
				</Modal.Content>
				<Modal.Footer>
					<Button onClick={ModalActionCreators.pop} variant="secondary">
						<Trans>Cancel</Trans>
					</Button>
					<Button type="submit" submitting={form.formState.isSubmitting}>
						<Trans>Continue</Trans>
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});
