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

import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Form} from '@app/components/form/Form';
import {Textarea} from '@app/components/form/Input';
import styles from '@app/components/modals/AttachmentEditModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {Endpoints} from '@app/Endpoints';
import {useCursorAtEnd} from '@app/hooks/useCursorAtEnd';
import http from '@app/lib/HttpClient';
import {Logger} from '@app/lib/Logger';
import type {MessageRecord} from '@app/records/MessageRecord';
import {MAX_ATTACHMENT_ALT_TEXT_LENGTH} from '@fluxer/constants/src/LimitConstants';
import type {Message} from '@fluxer/schema/src/domains/message/MessageResponseSchemas';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useForm} from 'react-hook-form';

const logger = new Logger('EditAltTextModal');

interface FormInputs {
	description: string;
}

interface EditAltTextModalProps {
	message: MessageRecord;
	attachmentId: string;
	currentDescription?: string | null;
	onClose: () => void;
}

export const EditAltTextModal = observer(
	({message, attachmentId, currentDescription, onClose}: EditAltTextModalProps) => {
		const {t} = useLingui();
		const [isSubmitting, setIsSubmitting] = useState(false);
		const textareaRef = useCursorAtEnd<HTMLTextAreaElement>();

		const form = useForm<FormInputs>({
			defaultValues: {
				description: currentDescription ?? '',
			},
		});

		const currentDescriptionValue = form.watch('description');
		const currentLength = useMemo(() => currentDescriptionValue.length, [currentDescriptionValue]);
		const isOverLimit = currentLength > MAX_ATTACHMENT_ALT_TEXT_LENGTH;
		const canSubmit = !isOverLimit && !isSubmitting;

		const onSubmit = useCallback(
			async (data: FormInputs) => {
				if (!canSubmit) return;

				setIsSubmitting(true);
				logger.debug(`Updating alt text for attachment ${attachmentId} in message ${message.id}`);

				try {
					const attachmentUpdates = message.attachments.map((att) => {
						if (att.id === attachmentId) {
							return {
								id: att.id,
								description: data.description || null,
							};
						}
						return {id: att.id};
					});

					await http.patch<Message>({
						url: Endpoints.CHANNEL_MESSAGE(message.channelId, message.id),
						body: {
							content: message.content,
							attachments: attachmentUpdates,
						},
					});

					logger.debug(`Successfully updated alt text for attachment ${attachmentId}`);
					ToastActionCreators.success(t`Alt text updated`);
					onClose();
				} catch (error) {
					logger.error('Failed to update alt text:', error);
					ToastActionCreators.error(t`Failed to update alt text`);
				} finally {
					setIsSubmitting(false);
				}
			},
			[canSubmit, attachmentId, message, onClose, t],
		);

		useEffect(() => {
			function handleKeyDown(event: KeyboardEvent) {
				if (event.key === 'Escape') {
					event.preventDefault();
					event.stopPropagation();
					onClose();
				} else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
					event.preventDefault();
					event.stopPropagation();
					if (canSubmit) {
						void form.handleSubmit(onSubmit)();
					}
				}
			}

			document.addEventListener('keydown', handleKeyDown);
			return () => document.removeEventListener('keydown', handleKeyDown);
		}, [onClose, canSubmit, form, onSubmit]);

		const handleCancel = useCallback(() => {
			onClose();
		}, [onClose]);

		return (
			<Modal.Root size="small" centered onClose={onClose}>
				<Form form={form} onSubmit={onSubmit} aria-label={t`Edit alt text form`}>
					<Modal.Header title={t`Edit Alt Text`} onClose={onClose} />
					<Modal.Content className={styles.content}>
						<Textarea
							{...form.register('description')}
							ref={(el) => {
								textareaRef(el);
								form.register('description').ref(el);
							}}
							autoFocus={true}
							value={currentDescriptionValue}
							label={t`Alt Text Description`}
							placeholder={t`Describe this media for screen readers`}
							minRows={3}
							maxRows={8}
							showCharacterCount={true}
							maxLength={MAX_ATTACHMENT_ALT_TEXT_LENGTH}
							disabled={isSubmitting}
						/>
					</Modal.Content>
					<Modal.Footer>
						<Button onClick={handleCancel} variant="secondary" disabled={isSubmitting}>
							<Trans>Cancel</Trans>
						</Button>
						<Button type="submit" disabled={!canSubmit}>
							<Trans>Save</Trans>
						</Button>
					</Modal.Footer>
				</Form>
			</Modal.Root>
		);
	},
);
