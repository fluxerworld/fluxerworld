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
import {ChannelDebugModal} from '@app/components/debug/ChannelDebugModal';
import {ChannelSettingsModal} from '@app/components/modals/ChannelSettingsModal';
import {ConfirmModal} from '@app/components/modals/ConfirmModal';
import {
	CollapseCategoryIcon,
	CopyIdIcon,
	DebugChannelIcon,
	DeleteIcon,
	MarkAsReadIcon,
	MuteIcon,
	SettingsIcon,
} from '@app/components/uikit/context_menu/ContextMenuIcons';
import type {MenuGroupType, MenuItemType} from '@app/components/uikit/menu_bottom_sheet/MenuBottomSheet';
import {Logger} from '@app/lib/Logger';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import ChannelStore from '@app/stores/ChannelStore';
import PermissionStore from '@app/stores/PermissionStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import {getMutedText} from '@app/utils/ContextMenuUtils';
import {ChannelTypes, Permissions} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {useMemo} from 'react';

const logger = new Logger('CategoryMenuData');

export interface CategoryMenuDataOptions {
	onClose: () => void;
	onOpenMuteSheet?: () => void;
}

export interface CategoryMenuData {
	groups: Array<MenuGroupType>;
	handlers: CategoryMenuHandlers;
	state: CategoryMenuState;
}

export interface CategoryMenuHandlers {
	handleMarkAsRead: () => void;
	handleToggleCollapse: () => void;
	handleToggleCollapseAll: () => void;
	handleOpenMuteSheet: () => void;
	handleEditCategory: () => void;
	handleDeleteCategory: () => void;
	handleCopyCategoryId: () => Promise<void>;
	handleDebugChannel: () => void;
}

export interface CategoryMenuState {
	hasUnread: boolean;
	isCollapsed: boolean;
	allCategoriesCollapsed: boolean;
	isMuted: boolean;
	mutedText: string | undefined;
	canManageChannels: boolean;
	developerMode: boolean;
}

function getCategoryMenuState(category: ChannelRecord): CategoryMenuState {
	const guildId = category.guildId!;
	const channels = ChannelStore.getGuildChannels(guildId);

	const channelsInCategory = channels.filter(
		(ch) => ch.parentId === category.id && ch.type !== ChannelTypes.GUILD_CATEGORY,
	);
	const hasUnread = channelsInCategory.some((ch) => ReadStateStore.hasUnread(ch.id));

	const isCollapsed = UserGuildSettingsStore.isChannelCollapsed(guildId, category.id);

	const categoryIds = channels.filter((ch) => ch.type === ChannelTypes.GUILD_CATEGORY).map((ch) => ch.id);
	const allCategoriesCollapsed =
		categoryIds.length > 0
			? categoryIds.every((categoryId) => UserGuildSettingsStore.isChannelCollapsed(guildId, categoryId))
			: false;

	const categoryOverride = UserGuildSettingsStore.getChannelOverride(guildId, category.id);
	const isMuted = categoryOverride?.muted ?? false;
	const muteConfig = categoryOverride?.mute_config;
	const mutedText = getMutedText(isMuted, muteConfig);

	const canManageChannels = PermissionStore.can(Permissions.MANAGE_CHANNELS, {
		channelId: category.id,
		guildId,
	});

	const developerMode = UserSettingsStore.developerMode;

	return {
		hasUnread,
		isCollapsed,
		allCategoriesCollapsed,
		isMuted,
		mutedText,
		canManageChannels,
		developerMode,
	};
}

export function useCategoryMenuData(category: ChannelRecord, options: CategoryMenuDataOptions): CategoryMenuData {
	const {t, i18n} = useLingui();
	const {onClose, onOpenMuteSheet} = options;

	const state = useMemo(() => getCategoryMenuState(category), [category]);

	const handlers = useMemo(
		() => ({
			handleMarkAsRead: () => {
				const guildId = category.guildId!;
				const channels = ChannelStore.getGuildChannels(guildId);
				const channelsInCategory = channels.filter(
					(ch) => ch.parentId === category.id && ch.type !== ChannelTypes.GUILD_CATEGORY,
				);
				for (const channel of channelsInCategory) {
					ReadStateActionCreators.ack(channel.id, true, true);
				}
				onClose();
			},
			handleToggleCollapse: () => {
				UserGuildSettingsActionCreators.toggleChannelCollapsed(category.guildId!, category.id);
				onClose();
			},
			handleToggleCollapseAll: () => {
				const guildId = category.guildId!;
				const channels = ChannelStore.getGuildChannels(guildId);
				const categoryIds = channels.filter((ch) => ch.type === ChannelTypes.GUILD_CATEGORY).map((ch) => ch.id);
				UserGuildSettingsActionCreators.toggleAllCategoriesCollapsed(guildId, categoryIds);
				onClose();
			},
			handleOpenMuteSheet: () => {
				onOpenMuteSheet?.();
			},
			handleEditCategory: () => {
				onClose();
				ModalActionCreators.push(modal(() => <ChannelSettingsModal channelId={category.id} />));
			},
			handleDeleteCategory: () => {
				onClose();

				const guildId = category.guildId!;
				const categoryName = category.name ?? '';
				const channels = ChannelStore.getGuildChannels(guildId);
				const channelsInCategory = channels.filter(
					(ch) => ch.parentId === category.id && ch.type !== ChannelTypes.GUILD_CATEGORY,
				);
				const channelCount = channelsInCategory.length;
				let description = t`Are you sure you want to delete the category "${categoryName}"? This cannot be undone.`;

				if (channelCount > 0) {
					if (channelCount === 1) {
						description = t`Are you sure you want to delete the category "${categoryName}"? All ${channelCount} channel inside will be moved to the top of the channel list.`;
					} else {
						description = t`Are you sure you want to delete the category "${categoryName}"? All ${channelCount} channels inside will be moved to the top of the channel list.`;
					}
				}

				ModalActionCreators.push(
					modal(() => (
						<ConfirmModal
							title={t`Delete Category`}
							description={description}
							primaryText={t`Delete Category`}
							primaryVariant="danger-primary"
							onPrimary={async () => {
								try {
									await ChannelActionCreators.remove(category.id);
									ToastActionCreators.createToast({
										type: 'success',
										children: t`Category deleted`,
									});
								} catch (error) {
									logger.error('Failed to delete category:', error);
									ToastActionCreators.createToast({
										type: 'error',
										children: t`Failed to delete category`,
									});
								}
							}}
						/>
					)),
				);
			},
			handleCopyCategoryId: async () => {
				await TextCopyActionCreators.copy(i18n, category.id, true);
				ToastActionCreators.createToast({
					type: 'success',
					children: t`Category ID copied`,
				});
				onClose();
			},
			handleDebugChannel: () => {
				onClose();
				ModalActionCreators.push(modal(() => <ChannelDebugModal title={t`Channel Debug`} channel={category} />));
			},
		}),
		[category, i18n, onClose, onOpenMuteSheet, t],
	);

	const groups = useMemo(() => {
		const menuGroups: Array<MenuGroupType> = [];

		menuGroups.push({
			items: [
				{
					icon: <MarkAsReadIcon size={20} />,
					label: t`Mark as Read`,
					onClick: handlers.handleMarkAsRead,
					disabled: !state.hasUnread,
				},
			],
		});

		const collapseItems: Array<MenuItemType> = [
			{
				icon: <CollapseCategoryIcon collapsed={state.isCollapsed} size={20} />,
				label: t`Collapse Category`,
				onClick: handlers.handleToggleCollapse,
			},
			{
				icon: <CollapseCategoryIcon collapsed={state.allCategoriesCollapsed} size={20} />,
				label: t`Collapse All Categories`,
				onClick: handlers.handleToggleCollapseAll,
			},
		];
		menuGroups.push({items: collapseItems});

		menuGroups.push({
			items: [
				{
					icon: <MuteIcon size={20} />,
					label: state.isMuted ? t`Unmute Category` : t`Mute Category`,
					onClick: handlers.handleOpenMuteSheet,
					hint: state.mutedText,
				},
			],
		});

		if (state.canManageChannels) {
			menuGroups.push({
				items: [
					{
						icon: <SettingsIcon size={20} />,
						label: t`Edit Category`,
						onClick: handlers.handleEditCategory,
					},
					{
						icon: <DeleteIcon size={20} />,
						label: t`Delete Category`,
						onClick: handlers.handleDeleteCategory,
						danger: true,
					},
				],
			});
		}

		const utilityItems: Array<MenuItemType> = [
			{
				icon: <CopyIdIcon size={20} />,
				label: t`Copy Category ID`,
				onClick: handlers.handleCopyCategoryId,
			},
		];

		if (state.developerMode) {
			utilityItems.unshift({
				icon: <DebugChannelIcon size={20} />,
				label: t`Debug Channel`,
				onClick: handlers.handleDebugChannel,
			});
		}

		menuGroups.push({items: utilityItems});

		return menuGroups;
	}, [state, handlers, t]);

	return {
		groups,
		handlers,
		state,
	};
}
