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
import {Input, Textarea} from '@app/components/form/Input';
import styles from '@app/components/modals/CreatePackModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import PackStore from '@app/stores/PackStore';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';
import {useForm} from 'react-hook-form';

interface FormInputs {
	name: string;
	description: string;
}

interface CreatePackModalProps {
	type: 'emoji' | 'sticker';
	onSuccess?: () => void;
}

export const CreatePackModal = observer(({type, onSuccess}: CreatePackModalProps) => {
	const {t} = useLingui();
	const form = useForm<FormInputs>({
		defaultValues: {
			name: '',
			description: '',
		},
	});

	const title = type === 'emoji' ? t`Create Emoji Pack` : t`Create Sticker Pack`;

	const submitHandler = useCallback(
		async (data: FormInputs) => {
			await PackStore.createPack(type, data.name.trim(), data.description.trim() || null);
			onSuccess?.();
			ModalActionCreators.pop();
		},
		[type, onSuccess],
	);

	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit: submitHandler,
		defaultErrorField: 'name',
	});

	return (
		<Modal.Root size="small" onClose={() => ModalActionCreators.pop()}>
			<Modal.Header title={title} />
			<Modal.Content>
				<p className={styles.description}>
					{type === 'emoji' ? (
						<Trans>Start curating a custom emoji pack that you can share and install.</Trans>
					) : (
						<Trans>Bundle your favorite stickers into a pack you can distribute.</Trans>
					)}
				</p>
				<Form className={styles.form} form={form} onSubmit={handleSubmit}>
					<div className={styles.formFields}>
						<Input
							id="pack-name"
							label={t`Pack Name`}
							error={form.formState.errors.name?.message}
							{...form.register('name', {
								required: t`Pack name is required`,
								minLength: {value: 2, message: t`Pack name must be at least 2 characters`},
								maxLength: {value: 64, message: t`Pack name must be at most 64 characters`},
							})}
							placeholder={t`My super pack`}
						/>
						<Textarea
							id="pack-description"
							label={t`Description`}
							error={form.formState.errors.description?.message}
							{...form.register('description', {maxLength: {value: 256, message: t`Maximum 256 characters`}})}
							placeholder={t`Describe what expressions are inside this pack.`}
							minRows={3}
						/>
					</div>
				</Form>
			</Modal.Content>
			<Modal.Footer>
				<Button variant="secondary" onClick={() => ModalActionCreators.pop()}>
					<Trans>Cancel</Trans>
				</Button>
				<Button onClick={handleSubmit} submitting={isSubmitting}>
					<Trans>Create</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
