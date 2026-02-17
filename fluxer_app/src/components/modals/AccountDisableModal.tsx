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
import * as UserActionCreators from '@app/actions/UserActionCreators';
import {Form} from '@app/components/form/Form';
import {FormErrorText} from '@app/components/form/FormErrorText';
import styles from '@app/components/modals/AccountDisableModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import {Routes} from '@app/Routes';
import * as RouterUtils from '@app/utils/RouterUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useForm} from 'react-hook-form';

interface FormInputs {
	form: string;
}

export const AccountDisableModal = observer(() => {
	const {t} = useLingui();
	const form = useForm<FormInputs>();

	const onSubmit = async () => {
		await UserActionCreators.disableAccount();
		ModalActionCreators.pop();
		RouterUtils.transitionTo(Routes.LOGIN);
	};

	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'form',
	});

	return (
		<Modal.Root size="small" centered>
			<Form form={form} onSubmit={handleSubmit}>
				<Modal.Header title={t`Disable Account`} />
				<Modal.Content contentClassName={styles.content}>
					<div className={styles.description}>
						<Trans>
							Disabling your account will log you out of all sessions. You can re-enable your account at any time by
							logging in again.
						</Trans>
					</div>
					<FormErrorText message={form.formState.errors.form?.message} />
				</Modal.Content>
				<Modal.Footer>
					<Button onClick={ModalActionCreators.pop} variant="secondary">
						<Trans>Cancel</Trans>
					</Button>
					<Button type="submit" submitting={isSubmitting} variant="danger-primary">
						<Trans>Disable Account</Trans>
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});
