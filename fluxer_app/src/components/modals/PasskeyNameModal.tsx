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
import {Form} from '@app/components/form/Form';
import {Input} from '@app/components/form/Input';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useForm} from 'react-hook-form';

interface FormInputs {
	name: string;
}

export const PasskeyNameModal = observer(({onSubmit}: {onSubmit: (name: string) => void | Promise<void>}) => {
	const {t} = useLingui();
	const form = useForm<FormInputs>();
	const handleSubmit = async (data: FormInputs) => {
		await onSubmit(data.name);
		ModalActionCreators.pop();
	};

	return (
		<Modal.Root size="small" centered>
			<Form form={form} onSubmit={handleSubmit} aria-label={t`Name passkey form`}>
				<Modal.Header title={t`Name Passkey`} />
				<Modal.Content>
					<Modal.ContentLayout>
						<Input
							{...form.register('name')}
							autoFocus={true}
							error={form.formState.errors.name?.message}
							label={t`Passkey Name`}
							maxLength={64}
							minLength={1}
							placeholder={t`e.g., YubiKey, iPhone, Work Computer`}
							required={true}
							type="text"
						/>
					</Modal.ContentLayout>
				</Modal.Content>
				<Modal.Footer>
					<Button onClick={ModalActionCreators.pop} variant="secondary">
						<Trans>Cancel</Trans>
					</Button>
					<Button type="submit" submitting={form.formState.isSubmitting}>
						<Trans>Save</Trans>
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});
