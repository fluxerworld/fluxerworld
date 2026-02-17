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

import styles from '@app/components/alerts/VoiceConnectionConfirmModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {
	useVoiceConnectionConfirmModalLogic,
	type VoiceConnectionConfirmModalProps,
} from '@app/utils/alerts/VoiceConnectionConfirmModalUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

export const VoiceConnectionConfirmModal: React.FC<VoiceConnectionConfirmModalProps> = observer(
	({guildId, channelId, onSwitchDevice, onJustJoin, onCancel}) => {
		const {t} = useLingui();
		const {existingConnectionsCount, handleSwitchDevice, handleJustJoin, handleCancel} =
			useVoiceConnectionConfirmModalLogic({
				guildId,
				channelId,
				onSwitchDevice,
				onJustJoin,
				onCancel,
			});

		return (
			<Modal.Root size="small" centered>
				<Modal.Header title={t`Voice Connection Confirmation`} />
				<Modal.Content>
					{existingConnectionsCount === 1
						? t`You're already connected to this voice channel from ${existingConnectionsCount} other device. What would you like to do?`
						: t`You're already connected to this voice channel from ${existingConnectionsCount} other devices. What would you like to do?`}
				</Modal.Content>
				<Modal.Footer>
					<div className={styles.footer}>
						<Button variant="primary" onClick={handleSwitchDevice} className={styles.fullWidth}>
							<Trans>Switch to This Device</Trans>
						</Button>

						<Button variant="secondary" onClick={handleJustJoin} className={styles.fullWidth}>
							<Trans>Just Join (Keep Other Connections)</Trans>
						</Button>

						<Button variant="secondary" onClick={handleCancel} className={styles.fullWidth}>
							<Trans>Do nothing, I don't want to join</Trans>
						</Button>
					</div>
				</Modal.Footer>
			</Modal.Root>
		);
	},
);
