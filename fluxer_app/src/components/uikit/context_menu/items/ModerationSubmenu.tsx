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
import {modal} from '@app/actions/ModalActionCreators';
import * as SoundActionCreators from '@app/actions/SoundActionCreators';
import {BanMemberModal} from '@app/components/modals/BanMemberModal';
import {KickMemberModal} from '@app/components/modals/KickMemberModal';
import {RemoveTimeoutModal} from '@app/components/modals/RemoveTimeoutModal';
import {TimeoutMemberModal} from '@app/components/modals/TimeoutMemberModal';
import {TransferOwnershipModal} from '@app/components/modals/TransferOwnershipModal';
import {CheckboxItem} from '@app/components/uikit/context_menu/ContextMenu';
import {
	BanMemberIcon,
	DisconnectIcon,
	GuildDeafenIcon,
	GuildMuteIcon,
	KickMemberIcon,
	TimeoutIcon,
	TransferOwnershipIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import {Logger} from '@app/lib/Logger';
import type {GuildMemberRecord} from '@app/records/GuildMemberRecord';
import type {UserRecord} from '@app/records/UserRecord';
import {SoundType} from '@app/utils/SoundUtils';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback} from 'react';

const logger = new Logger('ModerationSubmenu');

interface ModerationSubmenuProps {
	guildId: string;
	user: UserRecord;
	member: GuildMemberRecord | null;
	connectionId?: string;
	isParentGroupedItem?: boolean;
	canMuteMembers: boolean;
	canMoveMembers: boolean;
	canKickTarget: boolean;
	canBanTarget: boolean;
	canTimeoutTarget: boolean;
	canTransferOwnership: boolean;
	onClose: () => void;
}

export const ModerationSubmenu: React.FC<ModerationSubmenuProps> = observer(
	({
		guildId,
		user,
		member,
		connectionId,
		isParentGroupedItem = false,
		canMuteMembers,
		canMoveMembers,
		canKickTarget,
		canBanTarget,
		canTimeoutTarget,
		canTransferOwnership,
		onClose,
	}) => {
		const {t} = useLingui();

		const handleToggleMute = useCallback(
			async (checked: boolean) => {
				try {
					await GuildMemberActionCreators.update(guildId, user.id, {mute: checked});
					if (checked) SoundActionCreators.playSound(SoundType.Mute);
					else SoundActionCreators.playSound(SoundType.Unmute);
				} catch {}
			},
			[guildId, user.id],
		);

		const handleToggleDeafen = useCallback(
			async (checked: boolean) => {
				try {
					await GuildMemberActionCreators.update(guildId, user.id, {deaf: checked});
					if (checked) SoundActionCreators.playSound(SoundType.Deaf);
					else SoundActionCreators.playSound(SoundType.Undeaf);
				} catch {}
			},
			[guildId, user.id],
		);

		const handleDisconnect = useCallback(async () => {
			try {
				await GuildMemberActionCreators.update(guildId, user.id, {
					channel_id: null,
					connection_id: connectionId,
				});
			} catch (error) {
				logger.error('Failed to disconnect participant:', error);
			}
			onClose();
		}, [guildId, user.id, connectionId, onClose]);

		const handleTimeout = useCallback(() => {
			onClose();
			ModalActionCreators.push(modal(() => <TimeoutMemberModal guildId={guildId} targetUser={user} />));
		}, [guildId, user, onClose]);

		const handleRemoveTimeout = useCallback(() => {
			onClose();
			ModalActionCreators.push(modal(() => <RemoveTimeoutModal guildId={guildId} targetUser={user} />));
		}, [guildId, user, onClose]);

		const handleKickMember = useCallback(() => {
			onClose();
			ModalActionCreators.push(modal(() => <KickMemberModal guildId={guildId} targetUser={user} />));
		}, [guildId, user, onClose]);

		const handleBanMember = useCallback(() => {
			onClose();
			ModalActionCreators.push(modal(() => <BanMemberModal guildId={guildId} targetUser={user} />));
		}, [guildId, user, onClose]);

		const handleTransferOwnership = useCallback(() => {
			onClose();
			ModalActionCreators.push(
				modal(() => <TransferOwnershipModal guildId={guildId} targetUser={user} targetMember={member!} />),
			);
		}, [guildId, user, member, onClose]);

		const isGuildMuted = member?.mute ?? false;
		const isGuildDeafened = member?.deaf ?? false;
		const isTimedOut = member?.isTimedOut() ?? false;

		return (
			<MenuItemSubmenu
				label={t`Moderation`}
				render={() => (
					<MenuGroup>
						{canMuteMembers && (
							<>
								<CheckboxItem
									icon={<GuildMuteIcon size={16} />}
									checked={isGuildMuted}
									onCheckedChange={handleToggleMute}
								>
									{t`Community Mute`}
								</CheckboxItem>
								<CheckboxItem
									icon={<GuildDeafenIcon size={16} />}
									checked={isGuildDeafened}
									onCheckedChange={handleToggleDeafen}
								>
									{t`Community Deafen`}
								</CheckboxItem>
							</>
						)}
						{canMoveMembers && !isParentGroupedItem && (
							<MenuItem icon={<DisconnectIcon size={16} />} onClick={handleDisconnect} danger>
								{connectionId ? t`Disconnect Device` : t`Disconnect`}
							</MenuItem>
						)}
						{canTransferOwnership && member && (
							<MenuItem icon={<TransferOwnershipIcon size={16} />} onClick={handleTransferOwnership} danger>
								{t`Transfer Ownership`}
							</MenuItem>
						)}
						{canTimeoutTarget && member && (
							<MenuItem
								icon={<TimeoutIcon size={16} />}
								onClick={isTimedOut ? handleRemoveTimeout : handleTimeout}
								danger={!isTimedOut}
							>
								{isTimedOut ? t`Remove Timeout` : t`Timeout`}
							</MenuItem>
						)}
						{canKickTarget && (
							<MenuItem icon={<KickMemberIcon size={16} />} onClick={handleKickMember} danger>
								{t`Kick Member`}
							</MenuItem>
						)}
						{canBanTarget && (
							<MenuItem icon={<BanMemberIcon size={16} />} onClick={handleBanMember} danger>
								{t`Ban Member`}
							</MenuItem>
						)}
					</MenuGroup>
				)}
			/>
		);
	},
);
