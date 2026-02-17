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
import * as VoiceStateActionCreators from '@app/actions/VoiceStateActionCreators';
import {MoveToChannelIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import {Logger} from '@app/lib/Logger';
import ChannelStore from '@app/stores/ChannelStore';
import PermissionStore from '@app/stores/PermissionStore';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo} from 'react';

const logger = new Logger('MoveToChannelSubmenu');

interface MoveToChannelSubmenuProps {
	userId: string;
	guildId: string;
	connectionId?: string;
	connectionIds?: Array<string>;
	onClose: () => void;
	label?: string;
}

export const MoveToChannelSubmenu: React.FC<MoveToChannelSubmenuProps> = observer(
	({userId, guildId, connectionId, connectionIds, onClose, label}) => {
		const {t} = useLingui();
		const channels = ChannelStore.getGuildChannels(guildId);
		const userVoiceState = MediaEngineStore.getVoiceState(guildId, userId);
		const currentUser = UserStore.currentUser;
		const isSelf = currentUser?.id === userId;

		const voiceChannels = useMemo(() => {
			return channels.filter((channel) => {
				if (channel.type !== ChannelTypes.GUILD_VOICE) {
					return false;
				}

				if (userVoiceState?.channel_id === channel.id) {
					return false;
				}

				if (!isSelf) {
					const canMoveMembers = PermissionStore.can(Permissions.MOVE_MEMBERS, {
						guildId,
						channelId: channel.id,
					});
					return canMoveMembers;
				}

				const canConnect = PermissionStore.can(Permissions.CONNECT, {
					guildId,
					channelId: channel.id,
				});

				return canConnect;
			});
		}, [channels, guildId, userVoiceState, isSelf]);

		const handleMoveToChannel = useCallback(
			async (channelId: string) => {
				onClose();

				if (connectionIds && connectionIds.length > 0) {
					try {
						await VoiceStateActionCreators.bulkMoveConnections(connectionIds, channelId);
					} catch (error) {
						logger.error('Failed to bulk move connections:', error);
					}
					return;
				}

				if (isSelf) {
					await MediaEngineStore.connectToVoiceChannel(guildId, channelId);
				} else {
					try {
						await GuildMemberActionCreators.update(guildId, userId, {
							channel_id: channelId,
							connection_id: connectionId,
						});
					} catch (error) {
						logger.error('Failed to move member to channel:', error);
					}
				}
			},
			[guildId, userId, connectionId, connectionIds, onClose, isSelf],
		);

		if (voiceChannels.length === 0) {
			return null;
		}

		const menuLabel = useMemo(() => {
			if (label) {
				return label;
			}

			if (connectionId) {
				return t`Move Device To...`;
			}

			if (isSelf) {
				return t`Switch To...`;
			}

			return t`Move To...`;
		}, [label, connectionId, isSelf, t]);

		return (
			<MenuItemSubmenu
				icon={<MoveToChannelIcon size={16} />}
				label={menuLabel}
				render={() => (
					<MenuGroup>
						{voiceChannels.map((channel) => (
							<MenuItem key={channel.id} onClick={() => handleMoveToChannel(channel.id)}>
								{channel.name}
							</MenuItem>
						))}
					</MenuGroup>
				)}
			/>
		);
	},
);
