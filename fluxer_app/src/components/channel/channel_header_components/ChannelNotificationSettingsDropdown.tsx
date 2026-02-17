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

import * as UserGuildSettingsActionCreators from '@app/actions/UserGuildSettingsActionCreators';
import {getMuteDurationOptions} from '@app/components/channel/MuteOptions';
import {ContextMenuCloseProvider} from '@app/components/uikit/context_menu/ContextMenu';
import {MuteIcon} from '@app/components/uikit/context_menu/ContextMenuIcons';
import itemStyles from '@app/components/uikit/context_menu/items/MenuItems.module.css';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import menuItemStyles from '@app/components/uikit/context_menu/MenuItem.module.css';
import {MenuItemRadio} from '@app/components/uikit/context_menu/MenuItemRadio';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import {getMutedText, getNotificationSettingsLabel} from '@app/utils/ContextMenuUtils';
import {MessageNotifications} from '@fluxer/constants/src/NotificationConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo} from 'react';

interface Props {
	channel: ChannelRecord;
	onClose: () => void;
}

export const ChannelNotificationSettingsDropdown: React.FC<Props> = observer(({channel, onClose}) => {
	const {t, i18n} = useLingui();
	const muteDurations = useMemo(() => getMuteDurationOptions(i18n), [i18n]);
	const guildId = channel.guildId;
	const isGuildChannel = guildId != null;

	const channelOverride = UserGuildSettingsStore.getChannelOverride(guildId ?? null, channel.id);
	const isMuted = channelOverride?.muted ?? false;
	const muteConfig = channelOverride?.mute_config;
	const mutedText = getMutedText(isMuted, muteConfig);

	const channelNotifications = channelOverride?.message_notifications;
	const currentNotificationLevel =
		channelNotifications ?? (isGuildChannel ? MessageNotifications.INHERIT : MessageNotifications.ALL_MESSAGES);

	const guildNotificationLevel = guildId
		? UserGuildSettingsStore.getGuildMessageNotifications(guildId)
		: MessageNotifications.ALL_MESSAGES;

	const categoryId = channel.parentId;
	const categoryOverride = guildId ? UserGuildSettingsStore.getChannelOverride(guildId, categoryId ?? '') : null;
	const categoryNotifications = categoryId ? categoryOverride?.message_notifications : undefined;

	const resolveEffectiveLevel = (level: number | undefined, fallback: number): number => {
		if (level === undefined || level === MessageNotifications.INHERIT) {
			return fallback;
		}
		return level;
	};

	const effectiveDefaultLevel = resolveEffectiveLevel(categoryNotifications, guildNotificationLevel);
	const hasCategory = categoryId != null;

	const handleMute = useCallback(
		(duration: number | null) => {
			const muteConfigValue = duration
				? {
						selected_time_window: duration,
						end_time: new Date(Date.now() + duration).toISOString(),
					}
				: null;

			UserGuildSettingsActionCreators.updateChannelOverride(
				guildId ?? null,
				channel.id,
				{
					muted: true,
					mute_config: muteConfigValue,
				},
				{persistImmediately: true},
			);
			onClose();
		},
		[guildId, channel.id, onClose],
	);

	const handleUnmute = useCallback(() => {
		UserGuildSettingsActionCreators.updateChannelOverride(
			guildId ?? null,
			channel.id,
			{
				muted: false,
				mute_config: null,
			},
			{persistImmediately: true},
		);
		onClose();
	}, [guildId, channel.id, onClose]);

	const handleNotificationLevelChange = useCallback(
		(level: number) => {
			if (level === MessageNotifications.INHERIT) {
				UserGuildSettingsActionCreators.updateChannelOverride(
					guildId ?? null,
					channel.id,
					{
						message_notifications: MessageNotifications.INHERIT,
					},
					{persistImmediately: true},
				);
			} else if (guildId) {
				UserGuildSettingsActionCreators.updateMessageNotifications(guildId, level, channel.id, {
					persistImmediately: true,
				});
			} else {
				UserGuildSettingsActionCreators.updateChannelOverride(
					null,
					channel.id,
					{
						message_notifications: level,
					},
					{persistImmediately: true},
				);
			}
		},
		[guildId, channel.id],
	);

	const defaultLabelParts = useMemo(
		() => ({
			main: hasCategory ? t`Use Category Default` : t`Use Community Default`,
			sub: getNotificationSettingsLabel(effectiveDefaultLevel) ?? null,
		}),
		[effectiveDefaultLevel, hasCategory],
	);

	return (
		<ContextMenuCloseProvider value={onClose}>
			<MenuGroup>
				{isMuted ? (
					<MenuItem icon={<MuteIcon />} onClick={handleUnmute} hint={mutedText ?? undefined}>
						{t`Unmute Channel`}
					</MenuItem>
				) : (
					<MenuItemSubmenu
						label={t`Mute Channel`}
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
				)}
			</MenuGroup>

			{isGuildChannel && (
				<MenuGroup>
					<MenuItemRadio
						selected={currentNotificationLevel === MessageNotifications.INHERIT}
						onSelect={() => handleNotificationLevelChange(MessageNotifications.INHERIT)}
					>
						<div className={itemStyles.flexColumn}>
							<span>{defaultLabelParts.main}</span>
							{defaultLabelParts.sub && <div className={menuItemStyles.subtext}>{defaultLabelParts.sub}</div>}
						</div>
					</MenuItemRadio>
				</MenuGroup>
			)}

			<MenuGroup>
				<MenuItemRadio
					selected={currentNotificationLevel === MessageNotifications.ALL_MESSAGES}
					onSelect={() => handleNotificationLevelChange(MessageNotifications.ALL_MESSAGES)}
				>
					{t`All Messages`}
				</MenuItemRadio>
				<MenuItemRadio
					selected={currentNotificationLevel === MessageNotifications.ONLY_MENTIONS}
					onSelect={() => handleNotificationLevelChange(MessageNotifications.ONLY_MENTIONS)}
				>
					{t`Only @mentions`}
				</MenuItemRadio>
				<MenuItemRadio
					selected={currentNotificationLevel === MessageNotifications.NO_MESSAGES}
					onSelect={() => handleNotificationLevelChange(MessageNotifications.NO_MESSAGES)}
				>
					{t`Nothing`}
				</MenuItemRadio>
			</MenuGroup>
		</ContextMenuCloseProvider>
	);
});
