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

import * as ContextMenuActionCreators from '@app/actions/ContextMenuActionCreators';
import {ChannelHeaderIcon} from '@app/components/channel/channel_header_components/ChannelHeaderIcon';
import {ChannelNotificationSettingsDropdown} from '@app/components/channel/channel_header_components/ChannelNotificationSettingsDropdown';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import {useLingui} from '@lingui/react/macro';
import {BellIcon, BellSlashIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useState} from 'react';

interface ChannelNotificationSettingsButtonProps {
	channel: ChannelRecord;
}

export const ChannelNotificationSettingsButton = observer(({channel}: ChannelNotificationSettingsButtonProps) => {
	const {t} = useLingui();
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	const channelOverride = UserGuildSettingsStore.getChannelOverride(channel.guildId ?? null, channel.id);
	const isMuted = channelOverride?.muted ?? false;

	const handleClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			event.preventDefault();
			event.stopPropagation();
			setIsMenuOpen(true);

			ContextMenuActionCreators.openFromElementBottomRight(event, ({onClose}) => (
				<ChannelNotificationSettingsDropdown
					channel={channel}
					onClose={() => {
						setIsMenuOpen(false);
						onClose();
					}}
				/>
			));
		},
		[channel],
	);

	return (
		<ChannelHeaderIcon
			icon={isMuted ? BellSlashIcon : BellIcon}
			label={isMuted ? t`Notification Settings (Muted)` : t`Notification Settings`}
			isSelected={isMenuOpen || isMuted}
			onClick={handleClick}
		/>
	);
});
