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

import * as ChannelActionCreators from '@app/actions/ChannelActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {Form} from '@app/components/form/Form';
import {Input} from '@app/components/form/Input';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useForm} from 'react-hook-form';

interface FormInputs {
	name: string;
}

export const CategoryCreateModal = observer(({guildId}: {guildId: string}) => {
	const {t} = useLingui();
	const form = useForm<FormInputs>();

	const onSubmit = async (data: FormInputs) => {
		await ChannelActionCreators.create(guildId, {
			name: data.name,
			url: null,
			type: ChannelTypes.GUILD_CATEGORY,
			parent_id: null,
			bitrate: null,
			user_limit: null,
		});

		ModalActionCreators.pop();
	};

	const {handleSubmit} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'name',
	});

	return (
		<Modal.Root size="small" centered>
			<Form form={form} onSubmit={handleSubmit}>
				<Modal.Header title={t`Create Category`} />
				<Modal.Content>
					<Modal.ContentLayout>
						<Input
							{...form.register('name')}
							autoComplete="off"
							autoFocus={true}
							error={form.formState.errors.name?.message}
							label={t`Name`}
							maxLength={100}
							minLength={1}
							placeholder={t`New Category`}
							required={true}
						/>
					</Modal.ContentLayout>
				</Modal.Content>
				<Modal.Footer>
					<Button onClick={ModalActionCreators.pop} variant="secondary">
						{t`Cancel`}
					</Button>
					<Button type="submit" submitting={form.formState.isSubmitting}>
						{t`Create Category`}
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});
