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
import * as UserProfileActionCreators from '@app/actions/UserProfileActionCreators';
import {ChangeFriendNicknameModal} from '@app/components/modals/ChangeFriendNicknameModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {
	AddNoteIcon,
	ChangeNicknameIcon,
	MessageUserIcon,
	VoiceCallIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import {Logger} from '@app/lib/Logger';
import type {UserRecord} from '@app/records/UserRecord';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

const logger = new Logger('ActionsSubmenu');

interface ActionsSubmenuProps {
	user: UserRecord;
	onClose: () => void;
	relationshipType?: number;
}

export const ActionsSubmenu: React.FC<ActionsSubmenuProps> = observer(({user, onClose, relationshipType}) => {
	const {t} = useLingui();
	const isBlocked = relationshipType === RelationshipTypes.BLOCKED;

	const openDmChannel = useCallback(async () => {
		try {
			await PrivateChannelActionCreators.openDMChannel(user.id);
		} catch (error) {
			logger.error('Failed to open DM channel:', error);
		}
	}, [user.id]);

	const handleOpenDM = useCallback(async () => {
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

	const handleAddNote = useCallback(() => {
		onClose();
		UserProfileActionCreators.openUserProfile(user.id, undefined, true);
	}, [user.id, onClose]);

	const handleChangeFriendNickname = useCallback(() => {
		onClose();
		ModalActionCreators.push(modal(() => <ChangeFriendNicknameModal user={user} />));
	}, [user, onClose]);

	const handleStartVoiceCall = useCallback(async () => {
		onClose();
		try {
			await PrivateChannelActionCreators.ensureDMChannel(user.id);
			await PrivateChannelActionCreators.openDMChannel(user.id);
		} catch (error) {
			logger.error('Failed to start voice call:', error);
		}
	}, [user.id, onClose]);

	return (
		<MenuItemSubmenu
			label={t`Actions`}
			render={() => (
				<MenuGroup>
					<MenuItem icon={<MessageUserIcon size={16} />} onClick={isBlocked ? handleOpenBlockedDm : handleOpenDM}>
						{isBlocked ? t`Open DM` : t`Message`}
					</MenuItem>
					<MenuItem icon={<AddNoteIcon size={16} />} onClick={handleAddNote}>
						{t`Add Note`}
					</MenuItem>
					{relationshipType === RelationshipTypes.FRIEND && (
						<MenuItem icon={<ChangeNicknameIcon size={16} />} onClick={handleChangeFriendNickname}>
							{t`Change Friend Nickname`}
						</MenuItem>
					)}
					{!user.bot && (
						<MenuItem icon={<VoiceCallIcon size={16} />} onClick={handleStartVoiceCall}>
							{t`Start Voice Call`}
						</MenuItem>
					)}
				</MenuGroup>
			)}
		/>
	);
});
