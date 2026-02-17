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

import * as ReadStateActionCreators from '@app/actions/ReadStateActionCreators';
import * as UserGuildSettingsActionCreators from '@app/actions/UserGuildSettingsActionCreators';
import {getMuteDurationOptions} from '@app/components/channel/MuteOptions';
import {MarkAsReadIcon, MuteIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import ReadStateStore from '@app/stores/ReadStateStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import {getMutedText} from '@app/utils/ContextMenuUtils';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo} from 'react';

interface DMMenuItemProps {
	channel: ChannelRecord;
	onClose: () => void;
}

export const MarkDMAsReadMenuItem: React.FC<DMMenuItemProps> = observer(({channel, onClose}) => {
	const {t} = useLingui();
	const hasUnread = ReadStateStore.hasUnread(channel.id);

	const handleMarkAsRead = useCallback(() => {
		ReadStateActionCreators.ack(channel.id, true, true);
		onClose();
	}, [channel.id, onClose]);

	return (
		<MenuItem icon={<MarkAsReadIcon />} onClick={handleMarkAsRead} disabled={!hasUnread}>
			{t`Mark as Read`}
		</MenuItem>
	);
});

export const MuteDMMenuItem: React.FC<DMMenuItemProps> = observer(({channel, onClose}) => {
	const {t, i18n} = useLingui();
	const muteDurations = useMemo(() => getMuteDurationOptions(i18n), [i18n]);
	const channelOverride = UserGuildSettingsStore.getChannelOverride(null, channel.id);
	const isMuted = channelOverride?.muted ?? false;
	const muteConfig = channelOverride?.mute_config;

	const mutedText = getMutedText(isMuted, muteConfig);
	const dmDisplayName = ChannelUtils.getDMDisplayName(channel);
	const displayLabel = channel.isDM() ? `@${dmDisplayName}` : dmDisplayName;
	const muteLabel = t`Mute ${displayLabel}`;
	const unmuteLabel = t`Unmute ${displayLabel}`;

	const handleMute = useCallback(
		(duration: number | null) => {
			const muteConfig = duration
				? {
						selected_time_window: duration,
						end_time: new Date(Date.now() + duration).toISOString(),
					}
				: null;

			UserGuildSettingsActionCreators.updateChannelOverride(
				null,
				channel.id,
				{
					muted: true,
					mute_config: muteConfig,
				},
				{persistImmediately: true},
			);
			onClose();
		},
		[channel.id, onClose],
	);

	const handleUnmute = useCallback(() => {
		UserGuildSettingsActionCreators.updateChannelOverride(
			null,
			channel.id,
			{
				muted: false,
				mute_config: null,
			},
			{persistImmediately: true},
		);
		onClose();
	}, [channel.id, onClose]);

	if (isMuted) {
		return (
			<MenuItem icon={<MuteIcon />} onClick={handleUnmute} hint={mutedText ?? undefined}>
				{unmuteLabel}
			</MenuItem>
		);
	}

	return (
		<MenuItemSubmenu
			label={muteLabel}
			icon={<MuteIcon />}
			onTriggerSelect={() => handleMute(null)}
			render={() => (
				<MenuGroup>
					{muteDurations.map((duration) => (
						<MenuItem key={duration.value ?? 'until'} onClick={() => handleMute(duration.value)}>
							{duration.label}
						</MenuItem>
					))}
				</MenuGroup>
			)}
		/>
	);
});
