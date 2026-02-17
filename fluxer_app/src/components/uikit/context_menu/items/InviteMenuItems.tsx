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

import * as InviteActionCreators from '@app/actions/InviteActionCreators';
import * as MessageActionCreators from '@app/actions/MessageActionCreators';
import * as PrivateChannelActionCreators from '@app/actions/PrivateChannelActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {InviteIcon, SendInviteToCommunityIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import {Logger} from '@app/lib/Logger';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import type {UserRecord} from '@app/records/UserRecord';
import ChannelStore from '@app/stores/ChannelStore';
import GuildMemberStore from '@app/stores/GuildMemberStore';
import GuildStore from '@app/stores/GuildStore';
import RuntimeConfigStore from '@app/stores/RuntimeConfigStore';
import SelectedChannelStore from '@app/stores/SelectedChannelStore';
import * as InviteUtils from '@app/utils/InviteUtils';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import type {Invite} from '@fluxer/schema/src/domains/invite/InviteSchemas';
import {fromTimestamp} from '@fluxer/snowflake/src/SnowflakeUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo} from 'react';

const logger = new Logger('InviteMenuItems');

interface InviteCandidate {
	guild: GuildRecord;
	channelId: string;
}

const canInviteInChannel = (channel: ChannelRecord | undefined): channel is ChannelRecord => {
	if (!channel || !channel.guildId) {
		return false;
	}
	return InviteUtils.canInviteToChannel(channel.id, channel.guildId);
};

const getDefaultInviteChannelId = (guildId: string): string | null => {
	const selectedChannelId = SelectedChannelStore.selectedChannelIds.get(guildId);
	if (selectedChannelId) {
		const selectedChannel = ChannelStore.getChannel(selectedChannelId);
		if (canInviteInChannel(selectedChannel)) {
			return selectedChannel!.id;
		}
	}

	const guildChannels = ChannelStore.getGuildChannels(guildId);
	for (const channel of guildChannels) {
		if (channel.type === ChannelTypes.GUILD_TEXT && canInviteInChannel(channel)) {
			return channel.id;
		}
	}

	return null;
};

interface InviteToCommunityMenuItemProps {
	user: UserRecord;
	onClose: () => void;
}

export const InviteToCommunityMenuItem: React.FC<InviteToCommunityMenuItemProps> = observer(({user, onClose}) => {
	const {t} = useLingui();
	const candidates = useMemo(() => {
		return GuildStore.getGuilds()
			.filter((guild) => !GuildMemberStore.getMember(guild.id, user.id))
			.map((guild): InviteCandidate | null => {
				const channelId = getDefaultInviteChannelId(guild.id);
				return channelId ? {guild, channelId} : null;
			})
			.filter((candidate): candidate is InviteCandidate => candidate !== null)
			.sort((a, b) => a.guild.name.localeCompare(b.guild.name));
	}, [user.id]);

	const handleSendInvite = useCallback(
		async (candidate: InviteCandidate) => {
			onClose();

			let invite: Invite;
			try {
				invite = await InviteActionCreators.create(candidate.channelId);
			} catch {
				return;
			}

			const inviteUrl = `${RuntimeConfigStore.inviteEndpoint}/${invite.code}`;
			const dmChannelId = await PrivateChannelActionCreators.ensureDMChannel(user.id);
			try {
				const result = await MessageActionCreators.send(dmChannelId, {
					content: inviteUrl,
					nonce: fromTimestamp(Date.now()),
				});

				if (result) {
					ToastActionCreators.createToast({
						type: 'success',
						children: <Trans>Invite sent for {candidate.guild.name}</Trans>,
					});
				}
			} catch (error) {
				logger.error('Failed to send invite via context menu:', error);
				ToastActionCreators.error(t`Failed to send invite. Please try again.`);
			}
		},
		[onClose, user.id],
	);

	if (user.bot || candidates.length === 0) {
		return null;
	}

	return (
		<MenuItemSubmenu
			label={t`Invite to Community`}
			icon={<InviteIcon />}
			render={() => (
				<MenuGroup>
					{candidates.map((candidate) => (
						<MenuItem
							key={candidate.guild.id}
							icon={<SendInviteToCommunityIcon />}
							onClick={() => handleSendInvite(candidate)}
						>
							{candidate.guild.name}
						</MenuItem>
					))}
				</MenuGroup>
			)}
		/>
	);
});
