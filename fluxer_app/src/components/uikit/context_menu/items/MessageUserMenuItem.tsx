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
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {MessageUserIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {Logger} from '@app/lib/Logger';
import type {UserRecord} from '@app/records/UserRecord';
import RelationshipStore from '@app/stores/RelationshipStore';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

const logger = new Logger('MessageUserMenuItem');

interface MessageUserMenuItemProps {
	user: UserRecord;
	onClose: () => void;
}

export const MessageUserMenuItem: React.FC<MessageUserMenuItemProps> = observer(({user, onClose}) => {
	const {t} = useLingui();
	const relationshipType = RelationshipStore.getRelationship(user.id)?.type;
	const isBlocked = relationshipType === RelationshipTypes.BLOCKED;

	const openDmChannel = useCallback(async () => {
		try {
			await PrivateChannelActionCreators.openDMChannel(user.id);
		} catch (error) {
			logger.error('Failed to open DM channel:', error);
		}
	}, [user.id]);

	const handleMessageUser = useCallback(async () => {
		onClose();
		await openDmChannel();
	}, [onClose, openDmChannel]);

	const handleOpenBlockedDm = useCallback(() => {
		onClose();
		ModalActionCreators.push(
			modal(() => (
				<ConfirmModal
					title={t`Open DM`}
					description={t`You blocked ${user.username}. You won't be able to send messages unless you unblock them.`}
					primaryText={t`Open DM`}
					primaryVariant="primary"
					onPrimary={openDmChannel}
				/>
			)),
		);
	}, [onClose, openDmChannel, t, user.username]);

	return (
		<MenuItem icon={<MessageUserIcon size={16} />} onClick={isBlocked ? handleOpenBlockedDm : handleMessageUser}>
			{isBlocked ? t`Open DM` : t`Message`}
		</MenuItem>
	);
});
