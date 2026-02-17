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

import * as GuildMemberActionCreators from '@app/actions/GuildMemberActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {Logger} from '@app/lib/Logger';
import type {UserRecord} from '@app/records/UserRecord';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useState} from 'react';
import styles from './RemoveTimeoutModal.module.css';

const logger = new Logger('RemoveTimeoutModal');

interface RemoveTimeoutModalProps {
	guildId: string;
	targetUser: UserRecord;
}

export const RemoveTimeoutModal: React.FC<RemoveTimeoutModalProps> = observer(({guildId, targetUser}) => {
	const {t} = useLingui();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleRemove = async () => {
		setIsSubmitting(true);
		try {
			await GuildMemberActionCreators.timeout(guildId, targetUser.id, null);
			ToastActionCreators.createToast({
				type: 'success',
				children: <Trans>Successfully removed timeout from {targetUser.tag}</Trans>,
			});
			ModalActionCreators.pop();
		} catch (error) {
			logger.error('Failed to remove timeout:', error);
			ToastActionCreators.createToast({
				type: 'error',
				children: <Trans>Failed to remove timeout. Please try again.</Trans>,
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={t`Remove Timeout`} />
			<Modal.Content>
				<p className={styles.description}>
					<Trans>
						Removing the timeout will allow <strong>{targetUser.tag}</strong> to send messages, react, and join voice
						channels again.
					</Trans>
				</p>
			</Modal.Content>
			<Modal.Footer>
				<Button variant="secondary" onClick={() => ModalActionCreators.pop()} disabled={isSubmitting}>
					<Trans>Cancel</Trans>
				</Button>
				<Button variant="danger-primary" onClick={handleRemove} disabled={isSubmitting}>
					<Trans>Remove Timeout</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
