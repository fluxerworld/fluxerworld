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
import * as ReadStateActionCreators from '@app/actions/ReadStateActionCreators';
import * as TextCopyActionCreators from '@app/actions/TextCopyActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import * as UserGuildSettingsActionCreators from '@app/actions/UserGuildSettingsActionCreators';
import {createMuteConfig, getMuteDurationOptions} from '@app/components/channel/MuteOptions';
import {ChannelSettingsModal} from '@app/components/modals/ChannelSettingsModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {GuildNotificationSettingsModal} from '@app/components/modals/GuildNotificationSettingsModal';
import {InviteModal} from '@app/components/modals/InviteModal';
import {
	CopyIdIcon,
	CopyLinkIcon,
	DeleteIcon,
	EditSimpleIcon,
	FavoriteIcon,
	InviteIcon,
	MarkAsReadIcon,
	MuteIcon,
	NotificationSettingsIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import itemStyles from '@app/components/uikit/context_menu/items/MenuItems.module.css';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import menuItemStyles from '@app/components/uikit/context_menu/MenuItem.module.css';
import {MenuItemRadio} from '@app/components/uikit/context_menu/MenuItemRadio';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import {Logger} from '@app/lib/Logger';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import FavoritesStore from '@app/stores/FavoritesStore';
import PermissionStore from '@app/stores/PermissionStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import {getMutedText, getNotificationSettingsLabel} from '@app/utils/ContextMenuUtils';
import * as InviteUtils from '@app/utils/InviteUtils';
import {buildChannelLink} from '@app/utils/MessageLinkUtils';
import {ME} from '@fluxer/constants/src/AppConstants';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {MessageNotifications} from '@fluxer/constants/src/NotificationConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useMemo} from 'react';

const logger = new Logger('ChannelMenuItems');

interface ChannelMenuItemProps {
	channel: ChannelRecord;
	onClose: () => void;
}

export const MarkChannelAsReadMenuItem: React.FC<ChannelMenuItemProps> = observer(({channel, onClose}) => {
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

export const InvitePeopleToChannelMenuItem: React.FC<ChannelMenuItemProps> = observer(({channel, onClose}) => {
	const {t} = useLingui();
	const canInvite = InviteUtils.canInviteToChannel(channel.id, channel.guildId);

	const handleInvite = useCallback(() => {
		ModalActionCreators.push(modal(() => <InviteModal channelId={channel.id} />));
		onClose();
	}, [channel.id, onClose]);

	if (!canInvite) return null;

	return (
		<MenuItem icon={<InviteIcon />} onClick={handleInvite}>
			{t`Invite People`}
		</MenuItem>
	);
});

export const CopyChannelLinkMenuItem: React.FC<ChannelMenuItemProps> = observer(({channel, onClose}) => {
	const {t, i18n} = useLingui();
	const handleCopyLink = useCallback(() => {
		const channelLink = buildChannelLink({
			guildId: channel.guildId,
			channelId: channel.id,
		});
		TextCopyActionCreators.copy(i18n, channelLink);
		onClose();
	}, [channel.id, channel.guildId, onClose, i18n]);

	return (
		<MenuItem icon={<CopyLinkIcon />} onClick={handleCopyLink}>
			{t`Copy Link`}
		</MenuItem>
	);
});

export const MuteChannelMenuItem: React.FC<ChannelMenuItemProps> = observer(({channel, onClose}) => {
	const {t, i18n} = useLingui();
	const isChannelMuteable = channel.type === ChannelTypes.GUILD_TEXT || channel.type === ChannelTypes.GUILD_VOICE;
	if (!isChannelMuteable || !channel.guildId) return null;
	const guildId = channel.guildId;
	const channelOverride = UserGuildSettingsStore.getChannelOverride(guildId, channel.id);
	const isMuted = channelOverride?.muted ?? false;
	const muteConfig = channelOverride?.mute_config;

	const mutedText = getMutedText(isMuted, muteConfig);

	const handleMute = useCallback(
		(duration: number | null) => {
			UserGuildSettingsActionCreators.updateChannelOverride(
				channel.guildId!,
				channel.id,
				{
					muted: true,
					mute_config: createMuteConfig(duration),
				},
				{persistImmediately: true},
			);
			onClose();
		},
		[channel.guildId, channel.id, onClose],
	);

	const handleUnmute = useCallback(() => {
		UserGuildSettingsActionCreators.updateChannelOverride(
			channel.guildId!,
			channel.id,
			{
				muted: false,
				mute_config: null,
			},
			{persistImmediately: true},
		);
		onClose();
	}, [channel.guildId, channel.id, onClose]);

	if (isMuted) {
		return (
			<MenuItem icon={<MuteIcon />} onClick={handleUnmute} hint={mutedText ?? undefined}>
				{t`Unmute Channel`}
			</MenuItem>
		);
	}

	return (
		<MenuItemSubmenu
			label={t`Mute Channel`}
			icon={<MuteIcon />}
			onTriggerSelect={() => handleMute(null)}
			render={() => (
				<MenuGroup>
					{getMuteDurationOptions(i18n).map((option) => (
						<MenuItem key={option.label} onClick={() => handleMute(option.value)}>
							{option.label}
						</MenuItem>
					))}
				</MenuGroup>
			)}
		/>
	);
});

export const ChannelNotificationSettingsMenuItem: React.FC<ChannelMenuItemProps> = observer(({channel, onClose}) => {
	const {t} = useLingui();
	const guildId = channel.guildId;

	const handleNotificationLevelChange = useCallback(
		(level: number) => {
			if (!guildId) return;
			if (level === MessageNotifications.INHERIT) {
				UserGuildSettingsActionCreators.updateChannelOverride(
					guildId,
					channel.id,
					{
						message_notifications: MessageNotifications.INHERIT,
					},
					{persistImmediately: true},
				);
			} else {
				UserGuildSettingsActionCreators.updateMessageNotifications(guildId, level, channel.id, {
					persistImmediately: true,
				});
			}
		},
		[guildId, channel.id],
	);

	const handleOpenGuildNotificationSettings = useCallback(() => {
		if (!guildId) return;
		ModalActionCreators.push(modal(() => <GuildNotificationSettingsModal guildId={guildId} />));
		onClose();
	}, [guildId, onClose]);

	if (!guildId) return null;
	const channelNotifications = UserGuildSettingsStore.getChannelOverride(guildId, channel.id)?.message_notifications;
	const currentNotificationLevel = channelNotifications ?? MessageNotifications.INHERIT;

	const guildNotificationLevel = UserGuildSettingsStore.getGuildMessageNotifications(guildId);

	const categoryId = channel.parentId;
	const categoryOverride = UserGuildSettingsStore.getChannelOverride(guildId, categoryId ?? '');
	const categoryNotifications = categoryId ? categoryOverride?.message_notifications : undefined;

	const resolveEffectiveLevel = (level: number | undefined, fallback: number): number => {
		if (level === undefined || level === MessageNotifications.INHERIT) {
			return fallback;
		}
		return level;
	};

	const categoryDefaultLevel = resolveEffectiveLevel(categoryNotifications, guildNotificationLevel);
	const effectiveCurrentNotificationLevel =
		currentNotificationLevel === MessageNotifications.INHERIT ? categoryDefaultLevel : currentNotificationLevel;
	const hasCategory = categoryId != null;

	const currentStateText = getNotificationSettingsLabel(effectiveCurrentNotificationLevel);
	const defaultLabelParts = {
		main: hasCategory ? t`Category Default` : t`Community Default`,
		sub: getNotificationSettingsLabel(categoryDefaultLevel) ?? null,
	};

	return (
		<MenuItemSubmenu
			label={t`Notification Settings`}
			icon={<NotificationSettingsIcon />}
			hint={currentStateText}
			onTriggerSelect={handleOpenGuildNotificationSettings}
			render={() => (
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
			)}
		/>
	);
});

export const EditChannelMenuItem: React.FC<ChannelMenuItemProps> = observer(({channel, onClose}) => {
	const {t} = useLingui();
	const canManageChannels = PermissionStore.can(Permissions.MANAGE_CHANNELS, {
		channelId: channel.id,
		guildId: channel.guildId,
	});

	const handleEditChannel = useCallback(() => {
		ModalActionCreators.push(modal(() => <ChannelSettingsModal channelId={channel.id} />));
		onClose();
	}, [channel.id, onClose]);

	if (!canManageChannels) return null;

	return (
		<MenuItem icon={<EditSimpleIcon />} onClick={handleEditChannel}>
			{t`Edit Channel`}
		</MenuItem>
	);
});

export const DeleteChannelMenuItem: React.FC<ChannelMenuItemProps> = observer(({channel, onClose}) => {
	const {t} = useLingui();
	const canManageChannels = PermissionStore.can(Permissions.MANAGE_CHANNELS, {
		channelId: channel.id,
		guildId: channel.guildId,
	});

	const handleDeleteChannel = useCallback(() => {
		onClose();
		const channelType = channel.type === ChannelTypes.GUILD_VOICE ? t`Voice Channel` : t`Text Channel`;
		const channelName = channel.name ?? 'this channel';

		ModalActionCreators.push(
			modal(() => (
				<ConfirmModal
					title={t`Delete ${channelType}`}
					description={t`Are you sure you want to delete #${channelName}? This cannot be undone.`}
					primaryText={t`Delete Channel`}
					primaryVariant="danger-primary"
					onPrimary={async () => {
						try {
							await ChannelActionCreators.remove(channel.id);
							ToastActionCreators.createToast({
								type: 'success',
								children: t`Channel deleted`,
							});
						} catch (error) {
							logger.error('Failed to delete channel:', error);
							ToastActionCreators.createToast({
								type: 'error',
								children: t`Failed to delete channel`,
							});
						}
					}}
				/>
			)),
		);
	}, [channel.id, channel.name, channel.type, onClose]);

	if (!canManageChannels) return null;

	return (
		<MenuItem icon={<DeleteIcon />} onClick={handleDeleteChannel} danger>
			{t`Delete Channel`}
		</MenuItem>
	);
});

export const CopyChannelIdMenuItem: React.FC<ChannelMenuItemProps> = observer(({channel, onClose}) => {
	const {t, i18n} = useLingui();
	const handleCopyId = useCallback(() => {
		TextCopyActionCreators.copy(i18n, channel.id);
		onClose();
	}, [channel.id, onClose, i18n]);

	return (
		<MenuItem icon={<CopyIdIcon />} onClick={handleCopyId}>
			{t`Copy Channel ID`}
		</MenuItem>
	);
});

export const FavoriteChannelMenuItem: React.FC<ChannelMenuItemProps> = observer(({channel, onClose}) => {
	const {t} = useLingui();
	const categories = FavoritesStore.sortedCategories;
	const isAlreadyFavorite = !!FavoritesStore.getChannel(channel.id);
	const favoriteLabel = useMemo(() => {
		if (channel.isDM()) {
			return t`Favorite DM`;
		}
		if (channel.isGroupDM()) {
			return t`Favorite Group DM`;
		}
		return t`Favorite Channel`;
	}, [channel]);
	const unfavoriteLabel = useMemo(() => {
		if (channel.isDM()) {
			return t`Unfavorite DM`;
		}
		if (channel.isGroupDM()) {
			return t`Unfavorite Group DM`;
		}
		return t`Unfavorite Channel`;
	}, [channel]);

	const handleAddToCategory = useCallback(
		(categoryId: string | null) => {
			const guildId = channel.guildId ?? ME;
			FavoritesStore.addChannel(channel.id, guildId, categoryId);
			ToastActionCreators.createToast({type: 'success', children: t`Channel added to favorites`});
			onClose();
		},
		[channel.id, channel.guildId, onClose],
	);

	const handleRemoveFromFavorites = useCallback(() => {
		FavoritesStore.removeChannel(channel.id);
		ToastActionCreators.createToast({type: 'success', children: t`Channel removed from favorites`});
		onClose();
	}, [channel.id, onClose]);

	if (!AccessibilityStore.showFavorites) return null;

	if (isAlreadyFavorite) {
		return (
			<MenuItem icon={<FavoriteIcon filled />} onClick={handleRemoveFromFavorites}>
				{unfavoriteLabel}
			</MenuItem>
		);
	}

	if (categories.length === 0) {
		return (
			<MenuItem icon={<FavoriteIcon />} onClick={() => handleAddToCategory(null)}>
				{favoriteLabel}
			</MenuItem>
		);
	}

	return (
		<MenuItemSubmenu
			label={favoriteLabel}
			icon={<FavoriteIcon />}
			render={() => (
				<MenuGroup>
					<MenuItem onClick={() => handleAddToCategory(null)}>{t`Uncategorized`}</MenuItem>
					{categories.map((category) => (
						<MenuItem key={category.id} onClick={() => handleAddToCategory(category.id)}>
							{category.name}
						</MenuItem>
					))}
				</MenuGroup>
			)}
		/>
	);
});
