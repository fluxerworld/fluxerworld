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

import styles from '@app/components/modals/EmojiUploadModal.module.css';
import * as Modal from '@app/components/modals/Modal';
import {Spinner} from '@app/components/uikit/Spinner';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface EmojiUploadModalProps {
	count: number;
}

export const EmojiUploadModal: React.FC<EmojiUploadModalProps> = observer(({count}) => {
	const {t} = useLingui();
	const emojiText = count === 1 ? t`${count} emoji` : t`${count} emojis`;

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={<Trans>Uploading Emojis</Trans>} hideCloseButton />
			<Modal.Content>
				<Modal.ContentLayout className={styles.container}>
					<Spinner />
					<p className={styles.message}>
						<Trans>Uploading {emojiText}. This may take a little while.</Trans>
					</p>
				</Modal.ContentLayout>
			</Modal.Content>
		</Modal.Root>
	);
});
