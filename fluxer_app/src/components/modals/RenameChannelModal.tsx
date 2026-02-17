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
import {useCursorAtEnd} from '@app/hooks/useCursorAtEnd';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useForm} from 'react-hook-form';

interface FormInputs {
	name: string;
}

export const RenameChannelModal = observer(
	({currentName, onSave}: {currentName: string; onSave: (name: string) => void}) => {
		const {t} = useLingui();
		const form = useForm<FormInputs>({
			defaultValues: {
				name: currentName,
			},
		});

		const nameRef = useCursorAtEnd<HTMLInputElement>();

		const onSubmit = async (data: FormInputs) => {
			onSave(data.name);
			ModalActionCreators.pop();
		};

		const {handleSubmit} = useFormSubmit({
			form,
			onSubmit,
			defaultErrorField: 'name',
		});

		return (
			<Modal.Root size="small" centered>
				<Form form={form} onSubmit={handleSubmit} aria-label={t`Rename channel form`}>
					<Modal.Header title={t`Change Nickname`} />
					<Modal.Content>
						<Modal.ContentLayout>
							<Input
								{...form.register('name')}
								ref={(el) => {
									nameRef(el);
									form.register('name').ref(el);
								}}
								autoFocus={true}
								autoComplete="off"
								error={form.formState.errors.name?.message}
								label={t`Nickname`}
								maxLength={100}
								placeholder={t`Channel nickname`}
							/>
						</Modal.ContentLayout>
					</Modal.Content>
					<Modal.Footer>
						<Button onClick={ModalActionCreators.pop} variant="secondary">
							{t`Cancel`}
						</Button>
						<Button type="submit" submitting={form.formState.isSubmitting}>
							{t`Save`}
						</Button>
					</Modal.Footer>
				</Form>
			</Modal.Root>
		);
	},
);
