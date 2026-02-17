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
import styles from '@app/components/modals/ChannelCreateModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {RadioGroup} from '@app/components/uikit/radio_group/RadioGroup';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import {
	channelTypeOptions,
	createChannel,
	type FormInputs,
	getDefaultValues,
} from '@app/utils/modals/ChannelCreateModalUtils';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {Controller, useForm} from 'react-hook-form';

export const ChannelCreateModal = observer(({guildId, parentId}: {guildId: string; parentId?: string}) => {
	const {t} = useLingui();
	const form = useForm<FormInputs>({
		defaultValues: getDefaultValues(),
	});

	const onSubmit = async (data: FormInputs) => {
		await createChannel(guildId, data, parentId);
	};

	const {handleSubmit} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'name',
	});

	return (
		<Modal.Root size="small" centered>
			<Form form={form} onSubmit={handleSubmit}>
				<Modal.Header title={t`Create Channel`} />
				<Modal.Content contentClassName={styles.content}>
					<div className={styles.channelTypeSection}>
						<div className={styles.channelTypeLabel}>{t`Channel Type`}</div>
						<Controller
							name="type"
							control={form.control}
							render={({field}) => (
								<RadioGroup
									aria-label={t`Channel type selection`}
									value={Number(field.value)}
									onChange={(value) => field.onChange(value.toString())}
									options={channelTypeOptions}
								/>
							)}
						/>
					</div>
					<Input
						{...form.register('name')}
						autoComplete="off"
						autoFocus={true}
						error={form.formState.errors.name?.message}
						label={t`Name`}
						maxLength={100}
						minLength={1}
						placeholder={t`new-channel`}
						required={true}
					/>
					{Number(form.watch('type') || '0') === ChannelTypes.GUILD_LINK && (
						<Input
							{...form.register('url')}
							error={form.formState.errors.url?.message}
							label={t`URL`}
							maxLength={1024}
							placeholder={t`https://example.com`}
							required={true}
							type="url"
						/>
					)}
				</Modal.Content>
				<Modal.Footer>
					<Button onClick={ModalActionCreators.pop} variant="secondary">
						{t`Cancel`}
					</Button>
					<Button type="submit" submitting={form.formState.isSubmitting}>
						{t`Create Channel`}
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});
