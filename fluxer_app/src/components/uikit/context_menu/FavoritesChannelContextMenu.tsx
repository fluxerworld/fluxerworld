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
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import * as ToastActionCreators from '@app/actions/ToastActionCreators';
import {ExternalLinkWarningModal} from '@app/components/modals/ExternalLinkWarningModal';
import {RenameChannelModal} from '@app/components/modals/RenameChannelModal';
import {
	ChangeNicknameIcon,
	DeleteIcon,
	MoveToIcon,
	OpenInCommunityIcon,
	RemoveFromFavoritesIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import {
	ChannelNotificationSettingsMenuItem,
	CopyChannelIdMenuItem,
	DeleteChannelMenuItem,
	EditChannelMenuItem,
	InvitePeopleToChannelMenuItem,
	MarkChannelAsReadMenuItem,
	MuteChannelMenuItem,
} from '@app/components/uikit/context_menu/items/ChannelMenuItems';
import {DebugChannelMenuItem} from '@app/components/uikit/context_menu/items/DebugMenuItems';
import {MenuGroup} from '@app/components/uikit/context_menu/MenuGroup';
import {MenuItem} from '@app/components/uikit/context_menu/MenuItem';
import {MenuItemSubmenu} from '@app/components/uikit/context_menu/MenuItemSubmenu';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import FavoritesStore, {type FavoriteChannel} from '@app/stores/FavoritesStore';
import PermissionStore from '@app/stores/PermissionStore';
import TrustedDomainStore from '@app/stores/TrustedDomainStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';

interface FavoritesChannelContextMenuProps {
	favoriteChannel: FavoriteChannel;
	channel: ChannelRecord | null;
	guild: GuildRecord | null;
	onClose: () => void;
}

export const FavoritesChannelContextMenu: React.FC<FavoritesChannelContextMenuProps> = observer(
	({favoriteChannel, channel, guild: _guild, onClose}) => {
		const {t} = useLingui();

		const handleSetNickname = () => {
			onClose();
			ModalActionCreators.push(
				modal(() => (
					<RenameChannelModal
						currentName={favoriteChannel.nickname || channel?.name || ''}
						onSave={(nickname) => {
							FavoritesStore.setChannelNickname(favoriteChannel.channelId, nickname || null);
						}}
					/>
				)),
			);
		};

		const handleRemoveFromFavorites = () => {
			FavoritesStore.removeChannel(favoriteChannel.channelId);
			ToastActionCreators.createToast({type: 'success', children: t`Channel removed from favorites`});
			onClose();
		};

		const handleMoveTo = (categoryId: string | null) => {
			const currentChannel = FavoritesStore.getChannel(favoriteChannel.channelId);
			if (!currentChannel) return;

			const channelsInTarget = FavoritesStore.getChannelsInCategory(categoryId);
			const newPosition = channelsInTarget.length;

			FavoritesStore.moveChannel(favoriteChannel.channelId, categoryId, newPosition);
			onClose();
		};

		const handleOpenInGuild = () => {
			if (!channel?.guildId) return;

			const channelUrl = channel.url;
			if (channel.type === ChannelTypes.GUILD_LINK && channelUrl) {
				try {
					const parsedUrl = new URL(channelUrl);
					const isTrusted = TrustedDomainStore.isTrustedDomain(parsedUrl.hostname);
					if (!isTrusted) {
						ModalActionCreators.push(modal(() => <ExternalLinkWarningModal url={channelUrl} />));
					} else {
						void openExternalUrl(channelUrl);
					}
				} catch {}
				onClose();
				return;
			}

			NavigationActionCreators.selectChannel(channel.guildId, channel.id);
			onClose();
		};

		if (!channel) {
			return (
				<MenuGroup>
					<MenuItem icon={<DeleteIcon />} onClick={handleRemoveFromFavorites} danger>
						{t`Remove from Favorites`}
					</MenuItem>
				</MenuGroup>
			);
		}

		const canManageChannel =
			Boolean(channel.guildId) &&
			PermissionStore.can(Permissions.MANAGE_CHANNELS, {channelId: channel.id, guildId: channel.guildId});
		const developerMode = UserSettingsStore.developerMode;

		return (
			<>
				{channel.guildId && (
					<MenuGroup>
						<MarkChannelAsReadMenuItem channel={channel} onClose={onClose} />
						<InvitePeopleToChannelMenuItem channel={channel} onClose={onClose} />
					</MenuGroup>
				)}

				<MenuGroup>
					<MenuItem icon={<ChangeNicknameIcon />} onClick={handleSetNickname}>
						{t`Change Nickname`}
					</MenuItem>
					{channel.guildId && (
						<MenuItem icon={<OpenInCommunityIcon />} onClick={handleOpenInGuild}>
							{channel.type === ChannelTypes.GUILD_LINK ? t`Open Link` : t`Open in Community`}
						</MenuItem>
					)}
					{(favoriteChannel.parentId !== null ||
						FavoritesStore.sortedCategories.some((category) => category.id !== favoriteChannel.parentId)) && (
						<MenuItemSubmenu
							label={t`Move to`}
							icon={<MoveToIcon />}
							render={() => (
								<MenuGroup>
									{favoriteChannel.parentId !== null && (
										<MenuItem onClick={() => handleMoveTo(null)}>{t`Uncategorized`}</MenuItem>
									)}
									{FavoritesStore.sortedCategories
										.filter((category) => category.id !== favoriteChannel.parentId)
										.map((category) => (
											<MenuItem key={category.id} onClick={() => handleMoveTo(category.id)}>
												{category.name}
											</MenuItem>
										))}
								</MenuGroup>
							)}
						/>
					)}
				</MenuGroup>

				{channel.guildId && (
					<MenuGroup>
						<MuteChannelMenuItem channel={channel} onClose={onClose} />
						<ChannelNotificationSettingsMenuItem channel={channel} onClose={onClose} />
					</MenuGroup>
				)}

				{canManageChannel && (
					<MenuGroup>
						<EditChannelMenuItem channel={channel} onClose={onClose} />
						<DeleteChannelMenuItem channel={channel} onClose={onClose} />
					</MenuGroup>
				)}

				<MenuGroup>
					{developerMode && <DebugChannelMenuItem channel={channel} onClose={onClose} />}
					<CopyChannelIdMenuItem channel={channel} onClose={onClose} />
				</MenuGroup>

				<MenuGroup>
					<MenuItem icon={<RemoveFromFavoritesIcon />} onClick={handleRemoveFromFavorites} danger>
						{t`Remove from Favorites`}
					</MenuItem>
				</MenuGroup>
			</>
		);
	},
);
