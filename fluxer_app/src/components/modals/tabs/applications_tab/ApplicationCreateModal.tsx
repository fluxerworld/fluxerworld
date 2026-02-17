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
import styles from '@app/components/modals/tabs/applications_tab/ApplicationsTab.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {Endpoints} from '@app/Endpoints';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import HttpClient from '@app/lib/HttpClient';
import type {DeveloperApplication} from '@app/records/DeveloperApplicationRecord';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useRef} from 'react';
import {useForm} from 'react-hook-form';

interface ApplicationCreateModalProps {
	onCreated: (application: DeveloperApplication) => void;
}

interface CreateFormValues {
	name: string;
}

export const ApplicationCreateModal: React.FC<ApplicationCreateModalProps> = observer(({onCreated}) => {
	const {t} = useLingui();
	const form = useForm<CreateFormValues>({
		defaultValues: {
			name: '',
		},
	});
	const nameField = form.register('name', {required: true, maxLength: 100});
	const nameInputRef = useRef<HTMLInputElement | null>(null);
	const handleCancel = useCallback(() => {
		form.reset();
		form.clearErrors();
		ModalActionCreators.pop();
	}, [form]);

	const onSubmit = useCallback(
		async (data: CreateFormValues) => {
			const response = await HttpClient.post<DeveloperApplication>(Endpoints.OAUTH_APPLICATIONS, {
				name: data.name.trim(),
				redirect_uris: [],
			});
			onCreated(response.body);
			form.reset();
			ModalActionCreators.pop();
		},
		[form, onCreated],
	);

	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'name',
	});

	return (
		<Modal.Root size="small" centered initialFocusRef={nameInputRef}>
			<Form form={form} onSubmit={handleSubmit}>
				<Modal.Header title={t`Create Application`} />
				<Modal.Content className={styles.createForm}>
					<Input
						type="text"
						label={t`Application Name`}
						{...nameField}
						ref={(el) => {
							nameField.ref(el);
							nameInputRef.current = el;
						}}
						placeholder={t`My Application`}
						maxLength={100}
						required
						disabled={isSubmitting}
						autoFocus
						error={form.formState.errors.name?.message}
					/>
				</Modal.Content>
				<Modal.Footer>
					<Button type="button" variant="secondary" onClick={handleCancel} disabled={isSubmitting}>
						{t`Cancel`}
					</Button>
					<Button type="submit" variant="primary" submitting={isSubmitting}>
						{t`Create`}
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});
