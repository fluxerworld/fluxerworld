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
import * as ModalActionCreators from '@app/actions/ModalActionCreators';
import {modal} from '@app/actions/ModalActionCreators';
import * as NavigationActionCreators from '@app/actions/NavigationActionCreators';
import {GroupDMAvatar} from '@app/components/common/GroupDMAvatar';
import channelItemStyles from '@app/components/layout/ChannelItem.module.css';
import {ChannelItemIcon} from '@app/components/layout/ChannelItemIcon';
import channelItemSurfaceStyles from '@app/components/layout/ChannelItemSurface.module.css';
import styles from '@app/components/layout/ChannelListContent.module.css';
import {ChannelListSkeleton} from '@app/components/layout/ChannelListSkeleton';
import {computeVerticalDropPosition} from '@app/components/layout/dnd/DndDropPosition';
import favoritesChannelListStyles from '@app/components/layout/FavoritesChannelListContent.module.css';
import {GenericChannelItem} from '@app/components/layout/GenericChannelItem';
import {getChannelUnreadState} from '@app/components/layout/utils/ChannelUnreadState';
import {AddFavoriteChannelModal} from '@app/components/modals/AddFavoriteChannelModal';
import {ExternalLinkWarningModal} from '@app/components/modals/ExternalLinkWarningModal';
import {InviteModal} from '@app/components/modals/InviteModal';
import {FavoritesCategoryContextMenu} from '@app/components/uikit/context_menu/FavoritesCategoryContextMenu';
import {FavoritesChannelContextMenu} from '@app/components/uikit/context_menu/FavoritesChannelContextMenu';
import {FavoritesChannelListContextMenu} from '@app/components/uikit/context_menu/FavoritesChannelListContextMenu';
import FocusRing from '@app/components/uikit/focus_ring/FocusRing';
import {MentionBadge} from '@app/components/uikit/MentionBadge';
import {Scroller} from '@app/components/uikit/Scroller';
import {StatusAwareAvatar} from '@app/components/uikit/StatusAwareAvatar';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useMergeRefs} from '@app/hooks/useMergeRefs';
import {useLocation} from '@app/lib/router/React';
import {Routes} from '@app/Routes';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import type {GuildRecord} from '@app/records/GuildRecord';
import AccessibilityStore from '@app/stores/AccessibilityStore';
import ChannelStore from '@app/stores/ChannelStore';
import FavoritesStore, {type FavoriteChannel} from '@app/stores/FavoritesStore';
import GuildStore from '@app/stores/GuildStore';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import TrustedDomainStore from '@app/stores/TrustedDomainStore';
import TypingStore from '@app/stores/TypingStore';
import UserGuildSettingsStore from '@app/stores/UserGuildSettingsStore';
import UserStore from '@app/stores/UserStore';
import * as AvatarUtils from '@app/utils/AvatarUtils';
import * as ChannelUtils from '@app/utils/ChannelUtils';
import * as InviteUtils from '@app/utils/InviteUtils';
import {openExternalUrl} from '@app/utils/NativeUtils';
import {FAVORITES_GUILD_ID, ME} from '@fluxer/constants/src/AppConstants';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {useLingui} from '@lingui/react/macro';
import {CaretDownIcon, HashIcon, PlusIcon, UserPlusIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {ConnectableElement} from 'react-dnd';
import {useDrag, useDrop} from 'react-dnd';
import {getEmptyImage} from 'react-dnd-html5-backend';

const DND_TYPES = {
	FAVORITES_CHANNEL: 'favorites-channel',
	FAVORITES_CATEGORY: 'favorites-category',
} as const;

interface DragItem {
	type: string;
	channelId: string;
	parentId: string | null;
}

interface FavoriteChannelGroup {
	category: {id: string; name: string} | null;
	channels: Array<{
		favoriteChannel: FavoriteChannel;
		channel: ChannelRecord | null;
		guild: GuildRecord | null;
	}>;
}

const FavoriteChannelItem = observer(
	({
		favoriteChannel,
		channel,
		guild,
	}: {
		favoriteChannel: FavoriteChannel;
		channel: ChannelRecord | null;
		guild: GuildRecord | null;
	}) => {
		const {t} = useLingui();
		const elementRef = useRef<HTMLDivElement | null>(null);
		const [dropIndicator, setDropIndicator] = useState<{position: 'top' | 'bottom'; isValid: boolean} | null>(null);
		const location = useLocation();
		const isSelected = location.pathname === Routes.favoritesChannel(favoriteChannel.channelId);
		const shouldShowSelectedState = isSelected;
		useEffect(() => {
			if (isSelected) {
				elementRef.current?.scrollIntoView({block: 'nearest'});
			}
		}, [isSelected]);
		const [isFocused, setIsFocused] = useState(false);
		const {keyboardModeEnabled} = KeyboardModeStore;
		const showKeyboardAffordances = keyboardModeEnabled && isFocused;

		const [{isDragging}, dragRef, preview] = useDrag<DragItem, unknown, {isDragging: boolean}>({
			type: DND_TYPES.FAVORITES_CHANNEL,
			item: {
				type: DND_TYPES.FAVORITES_CHANNEL,
				channelId: favoriteChannel.channelId,
				parentId: favoriteChannel.parentId,
			},
			collect: (monitor) => ({
				isDragging: monitor.isDragging(),
			}),
		});

		const [{isOver}, dropRef] = useDrop<DragItem, unknown, {isOver: boolean}>({
			accept: DND_TYPES.FAVORITES_CHANNEL,
			hover: (_item, monitor) => {
				const node = elementRef.current;
				if (!node) return;
				const hoverBoundingRect = node.getBoundingClientRect();
				const clientOffset = monitor.getClientOffset();
				if (!clientOffset) return;
				const dropPos = computeVerticalDropPosition(clientOffset, hoverBoundingRect);
				setDropIndicator({
					position: dropPos === 'before' ? 'top' : 'bottom',
					isValid: true,
				});
			},
			drop: (item, monitor) => {
				setDropIndicator(null);
				if (item.channelId === favoriteChannel.channelId) return;

				const node = elementRef.current;
				if (!node) return;
				const hoverBoundingRect = node.getBoundingClientRect();
				const clientOffset = monitor.getClientOffset();
				if (!clientOffset) return;
				const dropPos = computeVerticalDropPosition(clientOffset, hoverBoundingRect);
				const position = dropPos === 'center' ? 'after' : dropPos;

				const channels = FavoritesStore.getChannelsInCategory(favoriteChannel.parentId);
				let targetIndex = channels.findIndex((ch) => ch.channelId === favoriteChannel.channelId);

				if (targetIndex !== -1) {
					if (position === 'after') {
						targetIndex += 1;
					}
					FavoritesStore.moveChannel(item.channelId, favoriteChannel.parentId, targetIndex);
				}
			},
			collect: (monitor) => ({
				isOver: monitor.isOver(),
			}),
		});

		useEffect(() => {
			if (!isOver) setDropIndicator(null);
		}, [isOver]);

		useEffect(() => {
			preview(getEmptyImage());
		}, [preview]);

		const dragConnectorRef = useCallback(
			(node: ConnectableElement | null) => {
				dragRef(node);
			},
			[dragRef],
		);
		const dropConnectorRef = useCallback(
			(node: ConnectableElement | null) => {
				dropRef(node);
			},
			[dropRef],
		);
		const refs = useMergeRefs([dragConnectorRef, dropConnectorRef, elementRef]);

		if (!channel) {
			return (
				<div className={favoritesChannelListStyles.notFoundItem}>
					<HashIcon weight="regular" className={favoritesChannelListStyles.notFoundIcon} />
					<span className={favoritesChannelListStyles.notFoundText}>{t`Channel not found`}</span>
				</div>
			);
		}

		const unreadCount = ReadStateStore.getUnreadCount(channel.id);
		const mentionCount = ReadStateStore.getMentionCount(channel.id);
		const isGroupDM = channel.isGroupDM();
		const isDM = channel.isDM();
		const recipientId = isDM ? (channel.recipientIds[0] ?? '') : '';
		const recipient = recipientId ? (UserStore.getUser(recipientId) ?? null) : null;
		const isTyping = recipientId ? TypingStore.isTyping(channel.id, recipientId) : false;

		const channelDisplayName = channel.isPrivate() ? ChannelUtils.getDMDisplayName(channel) : channel.name;
		const displayName = favoriteChannel.nickname || channelDisplayName || t`Unknown Channel`;

		const guildIconUrl = guild ? AvatarUtils.getGuildIconURL({id: guild.id, icon: guild.icon}) : null;

		const isMuted = channel.guildId ? UserGuildSettingsStore.isChannelMuted(channel.guildId, channel.id) : false;
		const unreadState = getChannelUnreadState({
			unreadCount,
			mentionCount,
			isMuted,
			showFadedUnreadOnMutedChannels: AccessibilityStore.showFadedUnreadOnMutedChannels,
		});

		const handleClick = () => {
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
				return;
			}

			NavigationActionCreators.selectChannel(FAVORITES_GUILD_ID, favoriteChannel.channelId);
		};

		const handleContextMenu = (event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
				<FavoritesChannelContextMenu
					favoriteChannel={favoriteChannel}
					channel={channel}
					guild={guild}
					onClose={onClose}
				/>
			));
		};

		const handleInvite = () => {
			ModalActionCreators.push(modal(() => <InviteModal channelId={channel.id} />));
		};

		const canInvite = channel.guildId && InviteUtils.canInviteToChannel(channel.id, channel.guildId);

		return (
			<GenericChannelItem
				ref={refs}
				containerClassName={favoritesChannelListStyles.favoriteItemContainer}
				style={{opacity: isDragging ? 0.5 : 1}}
				isOver={isOver}
				dropIndicator={dropIndicator}
				extraContent={
					unreadState.shouldShowUnreadIndicator ? (
						<div
							className={clsx(channelItemStyles.unreadIndicator, isMuted && channelItemStyles.unreadIndicatorMuted)}
						/>
					) : null
				}
				className={clsx(
					favoritesChannelListStyles.favoriteItem,
					shouldShowSelectedState && favoritesChannelListStyles.favoriteItemSelected,
					!shouldShowSelectedState && favoritesChannelListStyles.favoriteItemDefault,
					isOver && favoritesChannelListStyles.favoriteItemOver,
					isMuted && favoritesChannelListStyles.favoriteItemMuted,
					showKeyboardAffordances && favoritesChannelListStyles.keyboardFocus,
				)}
				isSelected={shouldShowSelectedState}
				onClick={handleClick}
				onContextMenu={handleContextMenu}
				onKeyDown={(e) => e.key === 'Enter' && handleClick()}
				onFocus={() => setIsFocused(true)}
				onBlur={() => setIsFocused(false)}
				onLongPress={() => {}}
			>
				<div className={favoritesChannelListStyles.avatarContainer}>
					{isGroupDM ? (
						<GroupDMAvatar channel={channel} size={24} />
					) : recipient ? (
						<StatusAwareAvatar
							user={recipient}
							size={24}
							isTyping={isTyping}
							showOffline={true}
							className={favoritesChannelListStyles.avatar}
						/>
					) : guildIconUrl ? (
						<img src={guildIconUrl} alt="" className={favoritesChannelListStyles.avatar} />
					) : (
						<div className={favoritesChannelListStyles.avatarPlaceholder}>
							{guild ? guild.name.charAt(0).toUpperCase() : 'DM'}
						</div>
					)}
					{!channel.isPrivate() && (
						<div
							className={clsx(
								favoritesChannelListStyles.channelBadge,
								shouldShowSelectedState && favoritesChannelListStyles.channelBadgeSelected,
							)}
						>
							{ChannelUtils.getIcon(channel, {
								className: clsx(
									favoritesChannelListStyles.channelBadgeIcon,
									shouldShowSelectedState && favoritesChannelListStyles.channelBadgeSelectedIcon,
								),
							})}
						</div>
					)}
				</div>

				<span className={favoritesChannelListStyles.displayName}>{displayName}</span>

				<div className={favoritesChannelListStyles.actionsContainer}>
					{canInvite && (
						<div className={favoritesChannelListStyles.hoverAffordance}>
							<ChannelItemIcon
								icon={UserPlusIcon}
								label={t`Invite People`}
								onClick={handleInvite}
								selected={shouldShowSelectedState}
							/>
						</div>
					)}
					{unreadState.hasMentions && <MentionBadge mentionCount={mentionCount} size="small" />}
				</div>
			</GenericChannelItem>
		);
	},
);

const FavoriteCategoryItem = observer(
	({
		category,
		isCollapsed,
		onToggle,
		onAddChannel,
	}: {
		category: {id: string; name: string};
		isCollapsed: boolean;
		onToggle: () => void;
		onAddChannel: () => void;
	}) => {
		const {t} = useLingui();
		const [isFocused, setIsFocused] = useState(false);
		const {keyboardModeEnabled} = KeyboardModeStore;
		const showKeyboardAffordances = keyboardModeEnabled && isFocused;

		const [{isOver}, dropRef] = useDrop<DragItem, unknown, {isOver: boolean}>({
			accept: DND_TYPES.FAVORITES_CHANNEL,
			drop: (item) => {
				if (item.parentId === category.id) return;
				const channels = FavoritesStore.getChannelsInCategory(category.id);
				FavoritesStore.moveChannel(item.channelId, category.id, channels.length);
			},
			collect: (monitor) => ({
				isOver: monitor.isOver(),
			}),
		});

		const dropConnectorRef = useCallback(
			(node: ConnectableElement | null) => {
				dropRef(node);
			},
			[dropRef],
		);
		const refs = useMergeRefs([dropConnectorRef]);

		const handleContextMenu = (event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
				<FavoritesCategoryContextMenu category={category} onClose={onClose} onAddChannel={onAddChannel} />
			));
		};

		return (
			<GenericChannelItem
				ref={refs}
				className={clsx(
					favoritesChannelListStyles.categoryItem,
					isOver && favoritesChannelListStyles.favoriteItemOver,
					showKeyboardAffordances && favoritesChannelListStyles.keyboardFocus,
				)}
				isOver={isOver}
				onClick={onToggle}
				onContextMenu={handleContextMenu}
				onKeyDown={(e) => e.key === 'Enter' && onToggle()}
				onFocus={() => setIsFocused(true)}
				onBlur={() => setIsFocused(false)}
			>
				<div className={favoritesChannelListStyles.categoryContent}>
					<span className={favoritesChannelListStyles.categoryName}>{category.name}</span>
					<CaretDownIcon
						weight="bold"
						className={favoritesChannelListStyles.categoryIcon}
						style={{transform: `rotate(${isCollapsed ? -90 : 0}deg)`}}
					/>
				</div>
				<div className={favoritesChannelListStyles.categoryActions}>
					<div className={favoritesChannelListStyles.hoverAffordance}>
						<Tooltip text={t`Add Channel`}>
							<FocusRing offset={-2} ringClassName={channelItemSurfaceStyles.channelItemFocusRing}>
								<button
									type="button"
									className={favoritesChannelListStyles.addButton}
									onClick={(e) => {
										e.stopPropagation();
										onAddChannel();
									}}
								>
									<PlusIcon weight="bold" className={favoritesChannelListStyles.addButtonIcon} />
								</button>
							</FocusRing>
						</Tooltip>
					</div>
				</div>
			</GenericChannelItem>
		);
	},
);

const UncategorizedGroup = ({children}: {children: React.ReactNode}) => {
	const [{isOver}, dropRef] = useDrop<DragItem, unknown, {isOver: boolean}>({
		accept: DND_TYPES.FAVORITES_CHANNEL,
		drop: (item, monitor) => {
			if (monitor.didDrop()) return;
			if (item.parentId === null) return;

			const channels = FavoritesStore.getChannelsInCategory(null);
			FavoritesStore.moveChannel(item.channelId, null, channels.length);
		},
		collect: (monitor) => ({
			isOver: monitor.isOver({shallow: true}),
		}),
	});

	const dropConnectorRef = useCallback(
		(node: ConnectableElement | null) => {
			dropRef(node);
		},
		[dropRef],
	);

	return (
		<div
			ref={dropConnectorRef}
			className={clsx(
				favoritesChannelListStyles.uncategorizedGroup,
				isOver && favoritesChannelListStyles.favoriteItemOver,
			)}
		>
			{children}
		</div>
	);
};

export const FavoritesChannelListContent = observer(() => {
	const {t} = useLingui();
	const favorites = FavoritesStore.sortedChannels;
	const categories = FavoritesStore.sortedCategories;
	const hideMutedChannels = FavoritesStore.hideMutedChannels;

	const channelGroups = useMemo(() => {
		const groups: Array<FavoriteChannelGroup> = [];
		const categoryMap = new Map<string | null, FavoriteChannelGroup>();

		categoryMap.set(null, {category: null, channels: []});

		for (const cat of categories) {
			categoryMap.set(cat.id, {category: cat, channels: []});
		}

		for (const fav of favorites) {
			const channel = ChannelStore.getChannel(fav.channelId);
			const guild = fav.guildId === ME ? null : GuildStore.getGuild(fav.guildId);

			if (hideMutedChannels && channel && channel.guildId) {
				if (UserGuildSettingsStore.isGuildOrChannelMuted(channel.guildId, channel.id)) {
					continue;
				}
			}

			const group = categoryMap.get(fav.parentId);
			if (group) {
				group.channels.push({favoriteChannel: fav, channel: channel ?? null, guild: guild ?? null});
			}
		}

		for (const [, group] of categoryMap) {
			if (group.category || group.channels.length > 0 || group === categoryMap.get(null)) {
				groups.push(group);
			}
		}

		return groups;
	}, [favorites, categories, hideMutedChannels]);

	const handleContextMenu = useCallback((event: React.MouseEvent) => {
		ContextMenuActionCreators.openFromEvent(event, ({onClose}) => (
			<FavoritesChannelListContextMenu onClose={onClose} />
		));
	}, []);

	if (favorites.length === 0) {
		return (
			<Scroller className={styles.channelListScroller} key="favorites-channel-list-empty-scroller">
				<div onContextMenu={handleContextMenu} role="region" aria-label={t`Empty favorites`}>
					<ChannelListSkeleton />
				</div>
			</Scroller>
		);
	}

	return (
		<Scroller className={styles.channelListScroller} key="favorites-channel-list-scroller">
			<div
				className={favoritesChannelListStyles.navigationContainer}
				onContextMenu={handleContextMenu}
				role="navigation"
			>
				<div className={favoritesChannelListStyles.channelGroupsContainer}>
					{channelGroups.map((group) => {
						const isCollapsed = group.category ? FavoritesStore.isCategoryCollapsed(group.category.id) : false;

						const handleAddChannel = () => {
							ModalActionCreators.push(modal(() => <AddFavoriteChannelModal categoryId={group.category?.id} />));
						};

						const content = (
							<>
								{group.category && (
									<FavoriteCategoryItem
										category={group.category}
										isCollapsed={isCollapsed}
										onToggle={() => FavoritesStore.toggleCategoryCollapsed(group.category!.id)}
										onAddChannel={handleAddChannel}
									/>
								)}

								{!isCollapsed &&
									group.channels.map(({favoriteChannel, channel, guild}) => (
										<FavoriteChannelItem
											key={favoriteChannel.channelId}
											favoriteChannel={favoriteChannel}
											channel={channel}
											guild={guild}
										/>
									))}
							</>
						);

						return (
							<div key={group.category?.id || 'uncategorized'} className={styles.channelGroup}>
								{group.category ? content : <UncategorizedGroup>{content}</UncategorizedGroup>}
							</div>
						);
					})}
				</div>
			</div>
		</Scroller>
	);
});
