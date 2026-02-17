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
import {DMCloseFailedModal} from '@app/components/alerts/DMCloseFailedModal';
import {ChangeGroupDMNicknameModal} from '@app/components/modals/ChangeGroupDMNicknameModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {
	ChangeNicknameIcon,
	CloseDMIcon,
	RemoveFromGroupIcon,
	TransferOwnershipIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {RingUserMenuItem, StartVoiceCallMenuItem} from '@app/components/uikit/context_menu/items/CallMenuItems';
import {FavoriteChannelMenuItem} from '@app/components/uikit/context_menu/items/ChannelMenuItems';
import {CopyUserIdMenuItem} from '@app/components/uikit/context_menu/items/CopyMenuItems';
import {DebugUserMenuItem} from '@app/components/uikit/context_menu/items/DebugMenuItems';
import {MarkDMAsReadMenuItem} from '@app/components/uikit/context_menu/items/DMMenuItems';
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
import {
	LocalMuteParticipantMenuItem,
	ParticipantVolumeSlider,
} from '@app/components/uikit/context_menu/items/VoiceParticipantMenuItems';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {Logger} from '@app/lib/Logger';
import {Routes} from '@app/Routes';
import type {UserRecord} from '@app/records/UserRecord';
import AuthenticationStore from '@app/stores/AuthenticationStore';
import CallStateStore from '@app/stores/CallStateStore';
import ChannelStore from '@app/stores/ChannelStore';
import PermissionStore from '@app/stores/PermissionStore';
import RelationshipStore from '@app/stores/RelationshipStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import UserStore from '@app/stores/UserStore';
import * as RouterUtils from '@app/utils/RouterUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {Permissions} from '@fluxer/constants/src/ChannelConstants';
import {RelationshipTypes} from '@fluxer/constants/src/UserConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

const logger = new Logger('UserContextMenu');

interface UserContextMenuProps {
	user: UserRecord;
	onClose: () => void;
	guildId?: string;
	channelId?: string;
	isCallContext?: boolean;
}

export const UserContextMenu: React.FC<UserContextMenuProps> = observer(
	({user, onClose, guildId, channelId, isCallContext = false}) => {
		const {t} = useLingui();
		const channel = channelId ? ChannelStore.getChannel(channelId) : null;

		const canSendMessages = channel
			? channel.isPrivate() || PermissionStore.can(Permissions.SEND_MESSAGES, {channelId, guildId})
			: true;

		const canMention = channel !== null && canSendMessages;
		const isCurrentUser = user.id === AuthenticationStore.currentUserId;

		const relationship = RelationshipStore.getRelationship(user.id);
		const relationshipType = relationship?.type;

		const developerMode = UserSettingsStore.developerMode;
		const currentUserId = AuthenticationStore.currentUserId;
		const isSystemUser = user.system;
		const restrictUserActions = isSystemUser;

		const dmPartnerId = channel?.isDM()
			? (channel.recipientIds.find((id) => id !== currentUserId) ?? channel.recipientIds[0])
			: null;

		const dmPartner = dmPartnerId ? UserStore.getUser(dmPartnerId) : null;

		const isGroupDM = channel?.isGroupDM();
		const isOwner = channel?.ownerId === currentUserId;
		const isRecipient = channel?.recipientIds.includes(user.id);
		const isBot = user.bot;

		const call = channelId ? CallStateStore.getCall(channelId) : null;
		const showCallItems = isCallContext && call && !isCurrentUser;

		const handleChangeGroupNickname = useCallback(() => {
			if (!channel) return;
			onClose();
			ModalActionCreators.push(modal(() => <ChangeGroupDMNicknameModal channelId={channel.id} user={user} />));
		}, [channel, onClose, user]);

		const handleRemoveFromGroup = useCallback(() => {
			if (!channel) return;
			onClose();
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Remove from Group`}
						description={t`Are you sure you want to remove ${user.username} from the group?`}
						primaryText={t`Remove`}
						primaryVariant="danger-primary"
						onPrimary={() => PrivateChannelActionCreators.removeRecipient(channel.id, user.id)}
					/>
				)),
			);
		}, [channel, onClose, t, user.id, user.username]);

		const handleMakeGroupOwner = useCallback(() => {
			if (!channel) return;
			onClose();
			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Change Owner`}
						description={t`Are you sure you want to transfer ownership of the group to ${user.username}?`}
						primaryText={t`Transfer Ownership`}
						onPrimary={() => {
							ChannelActionCreators.update(channel.id, {owner_id: user.id});
						}}
					/>
				)),
			);
		}, [channel, onClose, t, user.id, user.username]);

		const handleCloseDM = useCallback(() => {
			if (!channel || !channel.isDM()) return;

			onClose();

			const displayName = dmPartner?.username ?? user.username;

			ModalActionCreators.push(
				modal(() => (
					<ConfirmModal
						title={t`Close DM`}
						description={t`Are you sure you want to close your DM with ${displayName}? You can always reopen it later.`}
						primaryText={t`Close DM`}
						primaryVariant="danger-primary"
						onPrimary={async () => {
							try {
								await ChannelActionCreators.remove(channel.id);

								const selectedChannel = SelectedChannelStore.selectedChannelIds.get(ME);
								if (selectedChannel === channel.id) {
									RouterUtils.transitionTo(Routes.ME);
								}

								ToastActionCreators.createToast({
									type: 'success',
									children: t`DM closed`,
								});
							} catch (error) {
								logger.error('Failed to close DM:', error);
								window.setTimeout(() => {
									ModalActionCreators.push(modal(() => <DMCloseFailedModal />));
								}, 0);
							}
						}}
					/>
				)),
			);
		}, [channel, dmPartner?.username, onClose, t, user.username]);

		const renderDmSelfMenu = (restricted: boolean) => {
			if (!channel) return renderDefaultMenu(restricted);

			return (
				<>
					<MenuGroup>
						<MarkDMAsReadMenuItem channel={channel} onClose={onClose} />
					</MenuGroup>

					<MenuGroup>
						<FavoriteChannelMenuItem channel={channel} onClose={onClose} />
					</MenuGroup>

					<MenuGroup>
						<UserProfileMenuItem user={user} guildId={guildId} onClose={onClose} />
						<MenuItem icon={<CloseDMIcon />} onClick={handleCloseDM}>
							{t`Close DM`}
						</MenuItem>
					</MenuGroup>

					<MenuGroup>{developerMode && <DebugUserMenuItem user={user} onClose={onClose} />}</MenuGroup>

					<MenuGroup>
						<CopyUserIdMenuItem user={user} onClose={onClose} />
					</MenuGroup>
				</>
			);
		};

		const renderDmOtherMenu = (restricted: boolean) => {
			if (!channel) return renderDefaultMenu(restricted);

			return (
				<>
					<MenuGroup>
						<MarkDMAsReadMenuItem channel={channel} onClose={onClose} />
					</MenuGroup>

					<MenuGroup>
						<FavoriteChannelMenuItem channel={channel} onClose={onClose} />
					</MenuGroup>

					<MenuGroup>
						<UserProfileMenuItem user={user} guildId={guildId} onClose={onClose} />
						{showCallItems && channelId && (
							<RingUserMenuItem userId={user.id} channelId={channelId} onClose={onClose} />
						)}
						{!restricted && !isBot && <StartVoiceCallMenuItem user={user} onClose={onClose} />}
						{!restricted && <AddNoteMenuItem user={user} onClose={onClose} />}
						{!restricted && <ChangeFriendNicknameMenuItem user={user} onClose={onClose} />}
						<MenuItem icon={<CloseDMIcon />} onClick={handleCloseDM}>
							{t`Close DM`}
						</MenuItem>
					</MenuGroup>

					{!restricted && (
						<MenuGroup>
							{!isBot && <InviteToCommunityMenuItem user={user} onClose={onClose} />}
							{!isBot && <RelationshipActionMenuItem user={user} onClose={onClose} />}
							{relationshipType === RelationshipTypes.BLOCKED ? (
								<UnblockUserMenuItem user={user} onClose={onClose} />
							) : (
								<BlockUserMenuItem user={user} onClose={onClose} />
							)}
						</MenuGroup>
					)}

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
		};

		const renderRestrictedMenu = () => (
			<>
				<MenuGroup>
					<UserProfileMenuItem user={user} guildId={guildId} onClose={onClose} />
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

		const renderDefaultMenu = (restricted: boolean) => {
			if (restricted) {
				return renderRestrictedMenu();
			}

			return (
				<>
					<MenuGroup>
						<UserProfileMenuItem user={user} guildId={guildId} onClose={onClose} />

						{isGroupDM && isCurrentUser && (
							<MenuItem icon={<ChangeNicknameIcon />} onClick={handleChangeGroupNickname}>
								{t`Change Group Nickname`}
							</MenuItem>
						)}

						{canMention && <MentionUserMenuItem user={user} onClose={onClose} />}
						{!isCurrentUser && <MessageUserMenuItem user={user} onClose={onClose} />}

						{showCallItems && channelId && (
							<RingUserMenuItem userId={user.id} channelId={channelId} onClose={onClose} />
						)}

						{!isCurrentUser && !isBot && !isCallContext && !restricted && (
							<StartVoiceCallMenuItem user={user} onClose={onClose} />
						)}

						{!isCurrentUser && !restricted && <AddNoteMenuItem user={user} onClose={onClose} />}

						{!restricted && <ChangeFriendNicknameMenuItem user={user} onClose={onClose} />}
					</MenuGroup>

					{showCallItems && !restricted && (
						<MenuGroup>
							<ParticipantVolumeSlider userId={user.id} />
						</MenuGroup>
					)}

					{isGroupDM && isOwner && isRecipient && !isCurrentUser && (
						<MenuGroup>
							<MenuItem icon={<RemoveFromGroupIcon />} onClick={handleRemoveFromGroup} danger>
								{t`Remove from Group`}
							</MenuItem>

							<MenuItem icon={<TransferOwnershipIcon />} onClick={handleMakeGroupOwner} danger>
								{t`Make Group Owner`}
							</MenuItem>

							<MenuItem icon={<ChangeNicknameIcon />} onClick={handleChangeGroupNickname}>
								{t`Change Group Nickname`}
							</MenuItem>
						</MenuGroup>
					)}

					{showCallItems && !restricted && (
						<MenuGroup>
							<LocalMuteParticipantMenuItem userId={user.id} onClose={onClose} />
						</MenuGroup>
					)}

					<MenuGroup>
						{!restricted && !isCurrentUser && !isBot && <InviteToCommunityMenuItem user={user} onClose={onClose} />}
						{!restricted && !isCurrentUser && !isBot && <RelationshipActionMenuItem user={user} onClose={onClose} />}

						{!restricted &&
							!isCurrentUser &&
							(relationshipType === RelationshipTypes.BLOCKED ? (
								<UnblockUserMenuItem user={user} onClose={onClose} />
							) : (
								<BlockUserMenuItem user={user} onClose={onClose} />
							))}
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
		};

		if (channel?.isDM()) {
			return isCurrentUser ? renderDmSelfMenu(restrictUserActions) : renderDmOtherMenu(restrictUserActions);
		}

		return renderDefaultMenu(restrictUserActions);
	},
);
