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

import * as ChannelActionCreators from '@app/actions/ChannelActionCreators';
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {GroupOwnershipTransferFailedModal} from '@app/components/alerts/GroupOwnershipTransferFailedModal';
import {GroupRemoveUserFailedModal} from '@app/components/alerts/GroupRemoveUserFailedModal';
import {ChangeGroupDMNicknameModal} from '@app/components/modals/ChangeGroupDMNicknameModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {
	ChangeNicknameIcon,
	EditIcon,
	RemoveFromGroupIcon,
	TransferOwnershipIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {DataMenuRenderer} from '@app/components/uikit/context_menu/DataMenuRenderer';
import {StartVoiceCallMenuItem} from '@app/components/uikit/context_menu/items/CallMenuItems';
import {CopyUserIdMenuItem} from '@app/components/uikit/context_menu/items/CopyMenuItems';
import {DebugUserMenuItem} from '@app/components/uikit/context_menu/items/DebugMenuItems';
import {useDMMenuData} from '@app/components/uikit/context_menu/items/DMMenuData';
import {MuteDMMenuItem} from '@app/components/uikit/context_menu/items/DMMenuItems';
import {InviteToCommunityMenuItem} from '@app/components/uikit/context_menu/items/InviteMenuItems';
import {MentionUserMenuItem} from '@app/components/uikit/context_menu/items/MentionUserMenuItem';
import {MessageUserMenuItem} from '@app/components/uikit/context_menu/items/MessageUserMenuItem';
import {
	BlockUserMenuItem,
	ChangeFriendNicknameMenuItem,
	RelationshipActionMenuItem,
	UnblockUserMenuItem,
} from '@app/components/uikit/context_menu/items/RelationshipMenuItems';
import {AddNoteMenuItem} from '@app/components/uikit/context_menu/items/UserNoteMenuItems';
import {UserProfileMenuItem} from '@app/components/uikit/context_menu/items/UserProfileMenuItem';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {Logger} from '@app/lib/Logger';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import ChannelStore from '@app/stores/ChannelStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import UserStore from '@app/stores/UserStore';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo} from 'react';

const logger = new Logger('GroupDMContextMenu');

interface GroupDMContextMenuProps {
	channel: ChannelRecord;
	onClose: () => void;
}

export const GroupDMContextMenu: React.FC<GroupDMContextMenuProps> = observer(({channel, onClose}) => {
	const {t} = useLingui();

	const {groups} = useDMMenuData(channel, null, {
		onClose,
	});

	const excludeLabels = useMemo(() => [t`Mute Conversation`, t`Unmute Conversation`], [t]);

	return (
		<>
			<DataMenuRenderer groups={groups} excludeLabels={excludeLabels} />

			<MenuGroup>
				<MuteDMMenuItem channel={channel} onClose={onClose} />
			</MenuGroup>
		</>
	);
});

interface GroupDMMemberContextMenuProps {
	userId: string;
	channelId: string;
	onClose: () => void;
}

export const GroupDMMemberContextMenu: React.FC<GroupDMMemberContextMenuProps> = observer(
	({userId, channelId, onClose}) => {
		const {t} = useLingui();
		const currentUserId = AuthenticationStore.currentUserId;
		const channel = ChannelStore.getChannel(channelId);
		const user = UserStore.getUser(userId);
		const developerMode = UserSettingsStore.developerMode;

		const handleChangeNickname = useCallback(() => {
			if (!user) return;
			onClose();
			ModalActionCreators.push(modal(() => <ChangeGroupDMNicknameModal channelId={channelId} user={user} />));
		}, [channelId, onClose, user]);

		const handleRemoveFromGroup = useCallback(() => {
			if (!user) return;
			onClose();
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Remove from Group`}
						description={t`Are you sure you want to remove ${user.username} from the group?`}
						primaryText={t`Remove`}
						primaryVariant="danger-primary"
						onPrimary={async () => {
							try {
								await PrivateChannelActionCreators.removeRecipient(channelId, userId);
								ToastActionCreators.createToast({
									type: 'success',
									children: t`Removed from group`,
								});
							} catch (error) {
								logger.error('Failed to remove from group:', error);
								window.setTimeout(() => {
									ModalActionCreators.push(modal(() => <GroupRemoveUserFailedModal username={user.username} />));
								}, 0);
							}
						}}
					/>
				)),
			);
		}, [channelId, onClose, t, user, userId]);

		const handleMakeGroupOwner = useCallback(() => {
			if (!user) return;
			onClose();
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Transfer Ownership`}
						description={t`Are you sure you want to make ${user.username} the group owner? You will lose owner privileges.`}
						primaryText={t`Transfer Ownership`}
						onPrimary={async () => {
							try {
								await ChannelActionCreators.update(channelId, {owner_id: userId});
								ToastActionCreators.createToast({
									type: 'success',
									children: t`Ownership transferred`,
								});
							} catch (error) {
								logger.error('Failed to transfer ownership:', error);
								window.setTimeout(() => {
									ModalActionCreators.push(modal(() => <GroupOwnershipTransferFailedModal username={user.username} />));
								}, 0);
							}
						}}
					/>
				)),
			);
		}, [channelId, onClose, t, user, userId]);

		if (!user || !channel) {
			return null;
		}

		const isGroupDM = channel.type === ChannelTypes.GROUP_DM;
		if (!isGroupDM) {
			return null;
		}

		const isSelf = userId === currentUserId;
		const isOwner = channel.ownerId === currentUserId;
		const relationship = RelationshipStore.getRelationship(userId);
		const relationshipType = relationship?.type;

		if (isSelf) {
			return (
				<>
					<MenuGroup>
						<UserProfileMenuItem user={user} guildId={undefined} onClose={onClose} />
						<MentionUserMenuItem user={user} onClose={onClose} />
						<MenuItem icon={<EditIcon />} onClick={handleChangeNickname}>
							{t`Change My Group Nickname`}
						</MenuItem>
					</MenuGroup>

					{developerMode && (
						<MenuGroup>
							<DebugUserMenuItem user={user} onClose={onClose} />
						</MenuGroup>
					)}

					<MenuGroup>
						<CopyUserIdMenuItem user={user} onClose={onClose} />
					</MenuGroup>
				</>
			);
		}

		return (
			<>
				<MenuGroup>
					<UserProfileMenuItem user={user} guildId={undefined} onClose={onClose} />
					<MentionUserMenuItem user={user} onClose={onClose} />
					<MessageUserMenuItem user={user} onClose={onClose} />
					<StartVoiceCallMenuItem user={user} onClose={onClose} />
					<AddNoteMenuItem user={user} onClose={onClose} />
					<ChangeFriendNicknameMenuItem user={user} onClose={onClose} />
				</MenuGroup>

				{isOwner && (
					<MenuGroup>
						<MenuItem icon={<RemoveFromGroupIcon />} onClick={handleRemoveFromGroup} danger>
							{t`Remove from Group`}
						</MenuItem>
						<MenuItem icon={<TransferOwnershipIcon />} onClick={handleMakeGroupOwner} danger>
							{t`Make Group Owner`}
						</MenuItem>
						<MenuItem icon={<ChangeNicknameIcon />} onClick={handleChangeNickname}>
							{t`Change Group Nickname`}
						</MenuItem>
					</MenuGroup>
				)}

				<MenuGroup>
					<InviteToCommunityMenuItem user={user} onClose={onClose} />
					<RelationshipActionMenuItem user={user} onClose={onClose} />
					{relationshipType === RelationshipTypes.BLOCKED ? (
						<UnblockUserMenuItem user={user} onClose={onClose} />
					) : (
						<BlockUserMenuItem user={user} onClose={onClose} />
					)}
				</MenuGroup>

				{developerMode && (
					<MenuGroup>
						<DebugUserMenuItem user={user} onClose={onClose} />
					</MenuGroup>
				)}

				<MenuGroup>
					<CopyUserIdMenuItem user={user} onClose={onClose} />
				</MenuGroup>
			</>
		);
	},
);
