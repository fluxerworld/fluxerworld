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
import {modal} from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as UserActionCreators from '@app/actions/UserActionCreators';
import {Form} from '@app/components/form/Form';
import {FormErrorText} from '@app/components/form/FormErrorText';
import * as Modal from '@app/components/modals/Modal';
import styles from '@app/components/modals/tabs/privacy_safety_tab/DataDeletionTab.module.css';
import {Button} from '@app/components/uikit/button/Button';
import {WarningAlert} from '@app/components/uikit/warning_alert/WarningAlert';
import {useFormSubmit} from '@app/hooks/useFormSubmit';
import UserStore from '@app/stores/UserStore';
import * as LocaleUtils from '@app/utils/LocaleUtils';
import {getFormattedDateTime} from '@fluxer/date_utils/src/DateFormatting';
import {formatNumber} from '@fluxer/number_utils/src/NumberFormatting';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useState} from 'react';
import {useForm} from 'react-hook-form';

interface DeleteAllMessagesFormInputs {
	form: string;
}

const DeleteAllMessagesModal = observer(() => {
	const {t} = useLingui();
	const form = useForm<DeleteAllMessagesFormInputs>();

	const onSubmit = async () => {
		await UserActionCreators.bulkDeleteAllMessages();
		ModalActionCreators.pop();
	};

	const {handleSubmit, isSubmitting} = useFormSubmit({
		form,
		onSubmit,
		defaultErrorField: 'form',
	});

	return (
		<Modal.Root size="small" centered>
			<Form form={form} onSubmit={handleSubmit} aria-label={t`Delete all messages form`}>
				<Modal.Header title={t`Delete All Messages`} />
				<Modal.Content>
					<Modal.ContentLayout>
						<div className={styles.infoSection}>
							<Modal.Description>
								<Trans>Are you sure you want to delete all your messages? This action cannot be undone.</Trans>
							</Modal.Description>
							<FormErrorText message={form.formState.errors.form?.message} />
							<div className={styles.infoBox}>
								<p className={styles.infoBoxTitle}>
									<Trans>What happens next:</Trans>
								</p>
								<ul className={styles.infoList}>
									<li>
										<Trans>Your deletion request will be queued and processed in the background</Trans>
									</li>
									<li>
										<Trans>The job starts 24 hours after you confirm and can be canceled or restarted anytime</Trans>
									</li>
									<li>
										<Trans>The time to complete depends on how many messages you have sent</Trans>
									</li>
									<li>
										<Trans>Once deleted, your messages cannot be recovered</Trans>
									</li>
								</ul>
							</div>
						</div>
					</Modal.ContentLayout>
				</Modal.Content>
				<Modal.Footer>
					<Button onClick={ModalActionCreators.pop} variant="secondary">
						<Trans>Cancel</Trans>
					</Button>
					<Button type="submit" submitting={isSubmitting} variant="danger-primary">
						<Trans>Delete All Messages</Trans>
					</Button>
				</Modal.Footer>
			</Form>
		</Modal.Root>
	);
});

export const DataDeletionTabContent: React.FC = observer(() => {
	const {t} = useLingui();
	const [isCancelling, setIsCancelling] = useState(false);
	const handleDeleteAllMessages = () => {
		ModalActionCreators.push(modal(() => <DeleteAllMessagesModal />));
	};
	const user = UserStore.currentUser;
	const pending = user?.getPendingBulkMessageDeletion();
	const locale = LocaleUtils.getCurrentLocale();
	const formattedChannelCount = formatNumber(pending?.channelCount ?? 0, locale);
	const formattedMessageCount = formatNumber(pending?.messageCount ?? 0, locale);
	const scheduledAtLabel = pending?.scheduledAt ? getFormattedDateTime(pending.scheduledAt, locale) : '';

	const handleCancelPendingDeletion = useCallback(async () => {
		setIsCancelling(true);
		try {
			await UserActionCreators.cancelBulkDeleteAllMessages();
			ToastActionCreators.createToast({type: 'success', children: t`Pending deletion canceled`});
		} catch (error) {
			ToastActionCreators.error(t`Failed to cancel the deletion. Please try again.`);
			throw error;
		} finally {
			setIsCancelling(false);
		}
	}, []);

	return (
		<div className={styles.deleteSection}>
			{pending && (
				<WarningAlert
					title={<Trans>Pending Deletion</Trans>}
					actions={
						<Button variant="secondary" onClick={handleCancelPendingDeletion} disabled={isCancelling}>
							<Trans>Cancel pending deletion</Trans>
						</Button>
					}
				>
					<Trans>
						Deletion will remove <strong>{formattedMessageCount}</strong> messages from{' '}
						<strong>{formattedChannelCount}</strong> channels. Scheduled to run on <strong>{scheduledAtLabel}</strong>.
					</Trans>
				</WarningAlert>
			)}
			<Modal.Description className={styles.warningText}>
				<Trans>
					Once deleted, your messages cannot be recovered. The deletion process runs in the background and may take some
					time depending on how many messages you have sent.
				</Trans>
			</Modal.Description>
			{!pending && (
				<Button variant="danger-primary" fitContainer={false} onClick={handleDeleteAllMessages}>
					<Trans>Delete all my messages</Trans>
				</Button>
			)}
		</div>
	);
});
