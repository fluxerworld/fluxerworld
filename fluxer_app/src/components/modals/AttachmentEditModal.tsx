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
import {Switch} from '@app/components/form/Switch';
import styles from '@app/components/modals/AttachmentEditModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {useCursorAtEnd} from '@app/hooks/useCursorAtEnd';
import {type CloudAttachment, CloudUpload} from '@app/lib/CloudUpload';
import {MessageAttachmentFlags} from '@fluxer/constants/src/ChannelConstants';
import {MAX_ATTACHMENT_ALT_TEXT_LENGTH} from '@fluxer/constants/src/LimitConstants';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useMemo} from 'react';
import {useForm} from 'react-hook-form';

interface FormInputs {
	filename: string;
	spoiler: boolean;
	description: string;
}

export const AttachmentEditModal = observer(
	({channelId, attachment}: {channelId: string; attachment: CloudAttachment}) => {
		const {t} = useLingui();
		const defaultSpoiler = (attachment.flags & MessageAttachmentFlags.IS_SPOILER) !== 0;

		const form = useForm<FormInputs>({
			defaultValues: {
				filename: attachment.filename,
				spoiler: defaultSpoiler,
				description: attachment.description ?? '',
			},
		});

		const filenameRef = useCursorAtEnd<HTMLInputElement>();

		const isAltTextSupported = useMemo(() => {
			const mimeType = attachment.file.type.toLowerCase();
			return mimeType.startsWith('image/') || mimeType.startsWith('video/');
		}, [attachment.file.type]);

		const onSubmit = useCallback(
			async (data: FormInputs) => {
				const nextFlags = data.spoiler
					? attachment.flags | MessageAttachmentFlags.IS_SPOILER
					: attachment.flags & ~MessageAttachmentFlags.IS_SPOILER;
				const nextDescription = data.description.trim();
				const updates: Partial<CloudAttachment> = {
					filename: data.filename,
					flags: nextFlags,
					spoiler: data.spoiler,
				};

				if (isAltTextSupported) {
					updates.description = nextDescription.length > 0 ? nextDescription : undefined;
				}

				CloudUpload.updateAttachment(channelId, attachment.id, updates);
				ModalActionCreators.pop();
			},
			[attachment, channelId, isAltTextSupported],
		);

		return (
			<Modal.Root size="small" centered>
				<Form form={form} onSubmit={onSubmit}>
					<Modal.Header title={t`Edit Attachment`} onClose={ModalActionCreators.pop} />
					<Modal.Content contentClassName={styles.content}>
						<Input
							{...form.register('filename')}
							ref={(el) => {
								filenameRef(el);
								form.register('filename').ref(el);
							}}
							autoFocus={true}
							label={t`Filename`}
							minLength={1}
							maxLength={512}
							required={true}
							type="text"
							spellCheck={false}
						/>
						{isAltTextSupported ? (
							<Textarea
								{...form.register('description')}
								label={t`Alt Text Description`}
								placeholder={t`Describe this media for screen readers`}
								minRows={3}
								maxRows={8}
								showCharacterCount={true}
								maxLength={MAX_ATTACHMENT_ALT_TEXT_LENGTH}
							/>
						) : null}
						<Switch
							label={t`Mark as Spoiler`}
							value={form.watch('spoiler')}
							onChange={(value) => form.setValue('spoiler', value)}
						/>
					</Modal.Content>
					<Modal.Footer>
						<Button onClick={ModalActionCreators.pop} variant="secondary">
							<Trans>Cancel</Trans>
						</Button>
						<Button type="submit">
							<Trans>Save</Trans>
						</Button>
					</Modal.Footer>
				</Form>
			</Modal.Root>
		);
	},
);
