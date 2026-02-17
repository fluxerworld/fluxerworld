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

import * as GuildStickerActionCreators from '@app/actions/GuildStickerActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {Form} from '@app/components/form/Form';
import styles from '@app/components/modals/EditGuildStickerModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {StickerFormFields} from '@app/components/modals/sticker_form/StickerFormFields';
import {StickerPreview} from '@app/components/modals/sticker_form/StickerPreview';
import {Button} from '@app/components/uikit/button/Button';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import {useStickerAnimation} from '@app/hooks/useStickerAnimation';
import {Logger} from '@app/lib/Logger';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import type {GuildStickerWithUser} from '@fluxer/schema/src/domains/guild/GuildEmojiSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback} from 'react';
import {useForm} from 'react-hook-form';

const logger = new Logger('EditGuildStickerModal');

interface EditGuildStickerModalProps {
	guildId: string;
	sticker: GuildStickerWithUser;
	onUpdate: () => void;
}

interface FormInputs {
	name: string;
	description: string;
	tags: Array<string>;
}

export const EditGuildStickerModal = observer(function EditGuildStickerModal({
	guildId,
	sticker,
	onUpdate,
}: EditGuildStickerModalProps) {
	const {t} = useLingui();
	const {shouldAnimate} = useStickerAnimation();
	const form = useForm<FormInputs>({
		defaultValues: {
			name: sticker.name,
			description: sticker.description,
			tags: [...sticker.tags],
		},
	});

	const onSubmit = useCallback(
		async (data: FormInputs) => {
			try {
				await GuildStickerActionCreators.update(guildId, sticker.id, {
					name: data.name.trim(),
					description: data.description.trim(),
					tags: data.tags.length > 0 ? data.tags : [],
				});

				onUpdate();
				ModalActionCreators.pop();
			} catch (error: unknown) {
				logger.error('Failed to update sticker:', error);
				form.setError('name', {
					message: error instanceof Error ? error.message : t`Failed to update sticker`,
				});
			}
		},
		[guildId, sticker.id, onUpdate, form],
	);

	const {handleSubmit: handleSave} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'name',
	});

	const stickerUrl = AvatarUtils.getStickerURL({
		id: sticker.id,
		animated: shouldAnimate,
		size: 320,
	});

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Edit Sticker`} />
			<Modal.Content>
				<Form form={form} onSubmit={handleSave}>
					<div className={styles.content}>
						<StickerPreview imageUrl={stickerUrl} altText={sticker.name} />
						<StickerFormFields form={form} />
					</div>
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
