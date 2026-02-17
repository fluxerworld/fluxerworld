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
import * as Modal from '@app/components/modals/Modal';
import {Button} from '@app/components/uikit/button/Button';
import {
	type ChannelDeleteModalProps,
	deleteChannel,
	getChannelDeleteInfo,
} from '@app/utils/modals/ChannelDeleteModalUtils';
import {Trans} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {useState} from 'react';

export const ChannelDeleteModal = observer(({channelId}: ChannelDeleteModalProps) => {
	const deleteInfo = getChannelDeleteInfo(channelId);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const onSubmit = async () => {
		if (!deleteInfo) return;

		setIsSubmitting(true);
		try {
			await deleteChannel(channelId);
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!deleteInfo) return null;

	const {channel, isCategory, title, confirmText} = deleteInfo;

	return (
		<Modal.Root size="small" centered>
			<Modal.Header title={title} />
			<Modal.Content>
				<Modal.ContentLayout>
					<Modal.Description>
						{isCategory ? (
							<Trans>
								Are you sure you want to delete <strong>{channel.name}</strong>? This cannot be undone.
							</Trans>
						) : (
							<Trans>
								Are you sure you want to delete <strong>{channel.name}</strong>? This cannot be undone.
							</Trans>
						)}
					</Modal.Description>
				</Modal.ContentLayout>
			</Modal.Content>
			<Modal.Footer>
				<Button onClick={ModalActionCreators.pop} variant="secondary">
					<Trans>Cancel</Trans>
				</Button>
				<Button onClick={onSubmit} submitting={isSubmitting} variant="danger-primary">
					<Trans>{confirmText}</Trans>
				</Button>
			</Modal.Footer>
		</Modal.Root>
	);
});
