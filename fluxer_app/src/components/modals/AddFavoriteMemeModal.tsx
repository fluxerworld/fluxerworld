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

import * as FavoriteMemeActionCreators from '@app/actions/FavoriteMemeActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {Form} from '@app/components/form/Form';
import * as Modal from '@app/components/modals/Modal';
import {MemeFormFields} from '@app/components/modals/meme_form/MemeFormFields';
import {Button} from '@app/components/uikit/button/Button';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';
import {useForm} from 'react-hook-form';

interface AddFavoriteMemeModalProps {
	channelId: string;
	messageId: string;
	attachmentId?: string;
	embedIndex?: number;
	defaultName?: string;
	defaultAltText?: string;
}

interface FormInputs {
	name: string;
	altText?: string;
	tags: Array<string>;
}

export const AddFavoriteMemeModal = observer(function AddFavoriteMemeModal({
	channelId,
	messageId,
	attachmentId,
	embedIndex,
	defaultName = '',
	defaultAltText = '',
}: AddFavoriteMemeModalProps) {
	const {t, i18n} = useLingui();
	const form = useForm<FormInputs>({
		defaultValues: {
			name: defaultName,
			altText: defaultAltText,
			tags: [],
		},
	});

	const onSubmit = useCallback(
		async (data: FormInputs) => {
			await FavoriteMemeActionCreators.createFavoriteMeme(i18n, {
				channelId,
				messageId,
				attachmentId,
				embedIndex,
				name: data.name.trim(),
				altText: data.altText?.trim() || undefined,
				tags: data.tags.length > 0 ? data.tags : undefined,
			});
			ModalActionCreators.pop();
		},
		[channelId, messageId, attachmentId, embedIndex],
	);

	const {handleSubmit: handleSave} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'name',
	});

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Add to Saved Media`} />
			<Modal.Content>
				<Form form={form} onSubmit={handleSave}>
					<Modal.ContentLayout>
						<MemeFormFields form={form} />
					</Modal.ContentLayout>
				</Form>
			</Modal.Content>
			<Modal.Footer>
				<Button variant="secondary" onClick={() => ModalActionCreators.pop()}>
					<Trans>Cancel</Trans>
				</Button>
				<Button onClick={handleSave} disabled={!form.watch('name')?.trim() || form.formState.isSubmitting}>
					<Trans>Save</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
