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
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {Form} from '@app/components/form/Form';
import {Input} from '@app/components/form/Input';
import styles from '@app/components/modals/BaseChangeNicknameModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {useCursorAtEnd} from '@app/hooks/useCursorAtEnd';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import {Trans, useLingui} from '@lingui/react/macro';
import {XIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';
import {useForm} from 'react-hook-form';

interface FormInputs {
	nick: string;
}

interface BaseChangeNicknameModalProps {
	currentNick: string;
	displayName: string;
	onSave: (nick: string | null) => Promise<void>;
}

export const BaseChangeNicknameModal: React.FC<BaseChangeNicknameModalProps> = observer(
	({currentNick, displayName, onSave}) => {
		const {t} = useLingui();
		const form = useForm<FormInputs>({
			defaultValues: {
				nick: currentNick,
			},
		});

		const nickRef = useCursorAtEnd<HTMLInputElement>();

		const onSubmit = useCallback(
			async (data: FormInputs) => {
				const nick = data.nick.trim() || null;

				await onSave(nick);

				ToastActionCreators.createToast({
					type: 'success',
					children: <Trans>Nickname updated</Trans>,
				});

				ModalActionCreators.pop();
			},
			[onSave],
		);

		const {handleSubmit, isSubmitting} = useFormSubmit({
			form,
			onSubmit,
			defaultErrorField: 'nick',
		});

		const nickValue = form.watch('nick');

		return (
			<Modal.Root size="small" centered>
				<Form form={form} onSubmit={handleSubmit} aria-label={t`Change nickname form`}>
					<Modal.Header title={t`Change Nickname`} />
					<Modal.Content>
						<Modal.ContentLayout>
							<Input
								{...form.register('nick', {
									maxLength: {
										value: 32,
										message: t`Nickname must not exceed 32 characters`,
									},
								})}
								ref={(el) => {
									nickRef(el);
									form.register('nick').ref(el);
								}}
								autoFocus={true}
								type="text"
								label={t`Nickname`}
								placeholder={displayName}
								maxLength={32}
								error={form.formState.errors.nick?.message}
								rightElement={
									nickValue ? (
										<FocusRing offset={-2}>
											<button
												type="button"
												className={styles.clearButton}
												onClick={() => form.setValue('nick', '')}
												aria-label={t`Clear nickname`}
											>
												<XIcon size={16} weight="bold" />
											</button>
										</FocusRing>
									) : undefined
								}
							/>
						</Modal.ContentLayout>
					</Modal.Content>
					<Modal.Footer>
						<Button type="submit" submitting={isSubmitting}>
							<Trans>Save</Trans>
						</Button>
					</Modal.Footer>
				</Form>
			</Modal.Root>
		);
	},
);
