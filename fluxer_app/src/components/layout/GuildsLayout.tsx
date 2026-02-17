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

import * as DimensionActionCreators from '@app/actions/DimensionActionCreators';
import * as UserSettingsActionCreators from '@app/actions/UserSettingsActionCreators';
import {useActiveNagbars, useNagbarConditions} from '@app/components/layout/app_layout/AppLayoutHooks';
import {NagbarContainer} from '@app/components/layout/app_layout/NagbarContainer';
import {TopNagbarContext} from '@app/components/layout/app_layout/TopNagbarContext';
import styles from '@app/components/layout/GuildsLayout.module.css';
import {AddGuildButton} from '@app/components/layout/guild_list/AddGuildButton';
import {DiscoveryButton} from '@app/components/layout/guild_list/DiscoveryButton';
import {DownloadButton} from '@app/components/layout/guild_list/DownloadButton';
import {FavoritesButton} from '@app/components/layout/guild_list/FavoritesButton';
import {FluxerButton} from '@app/components/layout/guild_list/FluxerButton';
import {GuildFolderItem} from '@app/components/layout/guild_list/GuildFolderItem';
import {DMListItem} from '@app/components/layout/guild_list/GuildListDMItem';
import {GuildListItem} from '@app/components/layout/guild_list/GuildListItem';
import {HelpButton} from '@app/components/layout/guild_list/HelpButton';
import {OutlineFrame} from '@app/components/layout/OutlineFrame';
import {ScrollIndicatorOverlay} from '@app/components/layout/ScrollIndicatorOverlay';
import {DND_TYPES, type GuildDragItem, type GuildDropResult} from '@app/components/layout/types/DndTypes';
import {UserArea} from '@app/components/layout/UserArea';
import {openClaimAccountModal} from '@app/components/modals/ClaimAccountModal';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {Tooltip} from '@app/components/uikit/tooltip/Tooltip';
import {useRovingFocusList} from '@app/hooks/useRovingFocusList';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import {Platform} from '@app/lib/Platform';
import {useLocation} from '@app/lib/router/React';
import {Routes} from '@app/Routes';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import CallStateStore from '@app/stores/CallStateStore';
import ChannelStore from '@app/stores/ChannelStore';
import DimensionStore from '@app/stores/DimensionStore';
import GuildAvailabilityStore from '@app/stores/GuildAvailabilityStore';
import GuildListStore, {type OrganizedItem} from '@app/stores/GuildListStore';
import GuildReadStateStore from '@app/stores/GuildReadStateStore';
import InitializationStore from '@app/stores/InitializationStore';
import KeyboardModeStore from '@app/stores/KeyboardModeStore';
import MobileLayoutStore from '@app/stores/MobileLayoutStore';
import NagbarStore from '@app/stores/NagbarStore';
import ReadStateStore from '@app/stores/ReadStateStore';
import UserSettingsStore, {type GuildFolder} from '@app/stores/UserSettingsStore';
import UserStore from '@app/stores/UserStore';
import MediaEngineStore from '@app/stores/voice/MediaEngineFacade';
import {ChannelTypes} from '@fluxer/constants/src/ChannelConstants';
import {DEFAULT_GUILD_FOLDER_ICON, UNCATEGORIZED_FOLDER_ID} from '@fluxer/constants/src/UserConstants';
import * as SnowflakeUtils from '@fluxer/snowflake/src/SnowflakeUtils';
import {useLingui} from '@lingui/react/macro';
import {ExclamationMarkIcon} from '@phosphor-icons/react';
import {clsx} from 'clsx';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDrop} from 'react-dnd';

const isSelectedPath = (pathname: string, path: string) => {
	return pathname.startsWith(path);
};

const DM_LIST_REMOVAL_DELAY_MS = 750;
const UNAVAILABLE_INDICATOR_DEBOUNCE_MS = 1500;
const GUILD_LIST_FOCUSABLE_SELECTOR = '[data-guild-list-focus-item="true"]';

const getUnreadDMChannels = () => {
	const dmChannels = ChannelStore.dmChannels;
	return dmChannels.filter((channel) => ReadStateStore.hasUnread(channel.id));
};

function getOrganizedItemKey(item: OrganizedItem): string {
	if (item.type === 'folder') {
		return `folder-${item.folder.id}`;
	}
	return item.guild.id;
}

interface TopLevelGuildItem {
	type: 'guild';
	guildId: string;
}

interface TopLevelGuildFolderItem {
	type: 'folder';
	folder: GuildFolder;
}

type TopLevelItem = TopLevelGuildItem | TopLevelGuildFolderItem;

function cloneGuildFolder(folder: GuildFolder): GuildFolder {
	return {
		id: folder.id,
		name: folder.name,
		color: folder.color,
		flags: folder.flags,
		icon: folder.icon,
		guildIds: [...folder.guildIds],
	};
}

function getFolderIdFromKey(itemKey: string): number | null {
	if (!itemKey.startsWith('folder-')) return null;
	const folderIdRaw = itemKey.slice('folder-'.length);
	if (folderIdRaw === 'null') return null;
	const parsedFolderId = Number(folderIdRaw);
	if (Number.isNaN(parsedFolderId)) return null;
	return parsedFolderId;
}

function getNextFolderId(guildFolders: ReadonlyArray<GuildFolder>): number {
	let maxId = 0;
	for (const folder of guildFolders) {
		if (folder.id !== null && folder.id > maxId) {
			maxId = folder.id;
		}
	}
	return maxId + 1;
}

function buildTopLevelItems(guildFolders: ReadonlyArray<GuildFolder>): Array<TopLevelItem> {
	const topLevelItems: Array<TopLevelItem> = [];

	for (const folder of guildFolders) {
		if (folder.id === UNCATEGORIZED_FOLDER_ID) {
			for (const guildId of folder.guildIds) {
				topLevelItems.push({
					type: 'guild',
					guildId,
				});
			}
			continue;
		}

		if (folder.guildIds.length === 0) {
			continue;
		}

		topLevelItems.push({
			type: 'folder',
			folder: cloneGuildFolder(folder),
		});
	}

	return topLevelItems;
}

function buildGuildFoldersFromTopLevelItems(topLevelItems: ReadonlyArray<TopLevelItem>): Array<GuildFolder> {
	const guildFolders: Array<GuildFolder> = [];
	let pendingUncategorizedGuildIds: Array<string> = [];

	function flushUncategorized(): void {
		if (pendingUncategorizedGuildIds.length === 0) return;
		guildFolders.push({
			id: UNCATEGORIZED_FOLDER_ID,
			name: null,
			color: null,
			flags: 0,
			icon: DEFAULT_GUILD_FOLDER_ICON,
			guildIds: pendingUncategorizedGuildIds,
		});
		pendingUncategorizedGuildIds = [];
	}

	for (const topLevelItem of topLevelItems) {
		if (topLevelItem.type === 'guild') {
			pendingUncategorizedGuildIds.push(topLevelItem.guildId);
			continue;
		}

		flushUncategorized();
		if (topLevelItem.folder.guildIds.length === 0) {
			continue;
		}
		guildFolders.push(cloneGuildFolder(topLevelItem.folder));
	}

	flushUncategorized();
	return guildFolders;
}

function removeGuildIdsFromGuildFolders(
	guildFolders: ReadonlyArray<GuildFolder>,
	guildIdsToRemove: ReadonlySet<string>,
): Array<GuildFolder> {
	return guildFolders
		.map((folder) => {
			const filteredGuildIds = folder.guildIds.filter((guildId) => !guildIdsToRemove.has(guildId));
			return {
				id: folder.id,
				name: folder.name,
				color: folder.color,
				flags: folder.flags,
				icon: folder.icon,
				guildIds: filteredGuildIds,
			};
		})
		.filter((folder) => folder.guildIds.length > 0);
}

interface BottomDropZoneProps {
	onGuildDrop: (item: GuildDragItem, result: GuildDropResult) => void;
	lastItemKey: string;
	lastItemIsFolder: boolean;
	isDragging: boolean;
}

function BottomDropZone({onGuildDrop, lastItemKey, lastItemIsFolder, isDragging}: BottomDropZoneProps) {
	const [{isOver, canDrop}, dropRef] = useDrop(
		() => ({
			accept: [DND_TYPES.GUILD_ITEM, DND_TYPES.GUILD_FOLDER],
			drop: (item: GuildDragItem): GuildDropResult => {
				const result: GuildDropResult = {
					targetId: lastItemKey,
					position: 'after',
					targetIsFolder: lastItemIsFolder,
				};
				onGuildDrop(item, result);
				return result;
			},
			collect: (monitor) => ({
				isOver: monitor.isOver(),
				canDrop: monitor.canDrop(),
			}),
		}),
		[onGuildDrop, lastItemKey, lastItemIsFolder],
	);

	const isActive = isOver && canDrop;

	const setRef = useCallback(
		(node: HTMLDivElement | null) => {
			dropRef(node);
		},
		[dropRef],
	);

	return (
		<div
			ref={setRef}
			className={clsx(
				styles.guildListDropZone,
				styles.guildListDropZoneBottom,
				isDragging && styles.guildListDropZoneEnabled,
				isActive && styles.guildListDropZoneActive,
			)}
		/>
	);
}

const GuildList = observer(() => {
	const {t} = useLingui();
	const [isDragging, setIsDragging] = useState(false);
	const guilds = GuildListStore.guilds;
	const organizedItems = GuildListStore.getOrganizedGuildList();
	const unavailableGuilds = GuildAvailabilityStore.unavailableGuilds;
	const unavailableCount = unavailableGuilds.size;
	const unreadDMChannelsRaw = getUnreadDMChannels();
	const unreadDMChannelIds = unreadDMChannelsRaw.map((c) => c.id).join(',');
	const unreadDMChannels = useMemo(() => unreadDMChannelsRaw, [unreadDMChannelIds]);
	const scrollRef = useRef<ScrollerHandle>(null);
	const location = useLocation();
	const keyboardModeEnabled = KeyboardModeStore.keyboardModeEnabled;
	const [visibleUnavailableCount, setVisibleUnavailableCount] = useState(unavailableCount);
	const unavailableIndicatorHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hasUnavailableGuilds = visibleUnavailableCount > 0;
	const guildReadVersion = GuildReadStateStore.version;
	const readVersion = ReadStateStore.version;
	const guildIndicatorDependencies = useMemo(
		() => [guilds.length, guildReadVersion, readVersion, unreadDMChannelIds],
		[guilds.length, guildReadVersion, readVersion, unreadDMChannelIds],
	);
	const getGuildScrollContainer = useCallback(() => scrollRef.current?.getScrollerNode() ?? null, []);
	const [visibleDMChannels, setVisibleDMChannels] = useState(unreadDMChannels);
	const pinnedCallChannel =
		MediaEngineStore.connected && MediaEngineStore.channelId
			? (() => {
					const channel = ChannelStore.getChannel(MediaEngineStore.channelId);
					if (!channel) return null;
					if (channel.type !== ChannelTypes.DM && channel.type !== ChannelTypes.GROUP_DM) return null;
					const hasActiveCall = CallStateStore.hasActiveCall(channel.id);
					if (!hasActiveCall) return null;
					return channel;
				})()
			: null;
	const filteredDMChannels = pinnedCallChannel
		? visibleDMChannels.filter((channel) => channel.id !== pinnedCallChannel.id)
		: visibleDMChannels;
	const hasVisibleDMChannels = filteredDMChannels.length > 0 || Boolean(pinnedCallChannel);
	const shouldShowTopDivider = (guilds.length > 0 || hasUnavailableGuilds) && !hasVisibleDMChannels;
	const shouldShowEmptyStateDivider = !hasVisibleDMChannels && !hasUnavailableGuilds && guilds.length === 0;
	const shouldRenderGuildListItems = hasUnavailableGuilds || organizedItems.length > 0;
	const removalTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
	const guildListNavigationRef = useRovingFocusList<HTMLDivElement>({
		focusableSelector: GUILD_LIST_FOCUSABLE_SELECTOR,
		orientation: 'vertical',
		loop: true,
		enabled: keyboardModeEnabled,
		restoreFocusOnWindowFocus: false,
	});

	useEffect(() => {
		const unreadIds = new Set(unreadDMChannels.map((channel) => channel.id));

		setVisibleDMChannels((current) => {
			const leftover = current.filter((channel) => !unreadIds.has(channel.id));

			for (const channel of leftover) {
				if (!removalTimers.current.has(channel.id)) {
					const timer = setTimeout(() => {
						removalTimers.current.delete(channel.id);
						setVisibleDMChannels((latest) => latest.filter((latestChannel) => latestChannel.id !== channel.id));
					}, DM_LIST_REMOVAL_DELAY_MS);
					removalTimers.current.set(channel.id, timer);
				}
			}

			return [...unreadDMChannels, ...leftover];
		});

		for (const channel of unreadDMChannels) {
			const timer = removalTimers.current.get(channel.id);
			if (timer) {
				clearTimeout(timer);
				removalTimers.current.delete(channel.id);
			}
		}
	}, [unreadDMChannels]);

	useEffect(() => {
		if (unavailableCount > 0) {
			if (unavailableIndicatorHideTimer.current) {
				clearTimeout(unavailableIndicatorHideTimer.current);
				unavailableIndicatorHideTimer.current = null;
			}
			setVisibleUnavailableCount(unavailableCount);
			return;
		}

		if (unavailableIndicatorHideTimer.current) return;

		unavailableIndicatorHideTimer.current = setTimeout(() => {
			unavailableIndicatorHideTimer.current = null;
			setVisibleUnavailableCount(0);
		}, UNAVAILABLE_INDICATOR_DEBOUNCE_MS);
	}, [unavailableCount]);

	useEffect(() => {
		return () => {
			if (unavailableIndicatorHideTimer.current) {
				clearTimeout(unavailableIndicatorHideTimer.current);
				unavailableIndicatorHideTimer.current = null;
			}
			removalTimers.current.forEach((timer) => clearTimeout(timer));
			removalTimers.current.clear();
		};
	}, []);

	const renderDMListItems = (channels: Array<ChannelRecord>) =>
		channels.map((channel) => {
			const isSelected = isSelectedPath(location.pathname, Routes.dmChannel(channel.id));

			return (
				<div key={channel.id} className={styles.dmListItemWrapper}>
					<DMListItem channel={channel} isSelected={isSelected} />
				</div>
			);
		});

	const handleGuildDrop = useCallback(
		(item: GuildDragItem, result: GuildDropResult) => {
			const sourceKey = item.id;
			const targetKey = result.targetId;
			if (sourceKey === targetKey) return;

			const {position, targetIsFolder, targetFolderId} = result;

			if (position === 'inside' && targetIsFolder && !item.isFolder) {
				const sourceGuildId = item.id;
				const targetFolderId = getFolderIdFromKey(targetKey);
				const cleaned = removeGuildIdsFromGuildFolders(UserSettingsStore.guildFolders, new Set([sourceGuildId]));
				const newGuildFolders = cleaned.map((folder) => {
					if (folder.id !== targetFolderId) return folder;
					return {
						id: folder.id,
						name: folder.name,
						color: folder.color,
						flags: folder.flags,
						icon: folder.icon,
						guildIds: [...folder.guildIds, sourceGuildId],
					};
				});
				UserSettingsActionCreators.update({guildFolders: newGuildFolders});
				return;
			}

			if (
				targetFolderId != null &&
				targetFolderId !== UNCATEGORIZED_FOLDER_ID &&
				!item.isFolder &&
				(position === 'before' || position === 'after')
			) {
				const sourceGuildId = item.id;
				const targetGuildId = targetKey;
				const cleaned = removeGuildIdsFromGuildFolders(UserSettingsStore.guildFolders, new Set([sourceGuildId]));
				const newGuildFolders = cleaned.map((folder) => {
					if (folder.id !== targetFolderId) return folder;
					const guildIds = [...folder.guildIds];
					const targetIdx = guildIds.indexOf(targetGuildId);
					if (targetIdx !== -1) {
						const insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
						guildIds.splice(insertIdx, 0, sourceGuildId);
					} else {
						guildIds.push(sourceGuildId);
					}
					return {
						id: folder.id,
						name: folder.name,
						color: folder.color,
						flags: folder.flags,
						icon: folder.icon,
						guildIds,
					};
				});
				UserSettingsActionCreators.update({guildFolders: newGuildFolders});
				return;
			}

			if (position === 'combine' && !targetIsFolder && !item.isFolder && result.targetFolderId == null) {
				const sourceGuildId = item.id;
				const targetGuildId = targetKey;
				const cleaned = removeGuildIdsFromGuildFolders(UserSettingsStore.guildFolders, new Set([sourceGuildId]));
				const topLevelItems = buildTopLevelItems(cleaned);
				const targetIdx = topLevelItems.findIndex((tli) => tli.type === 'guild' && tli.guildId === targetGuildId);
				if (targetIdx === -1) return;
				const newFolder: GuildFolder = {
					id: getNextFolderId(UserSettingsStore.guildFolders),
					name: null,
					color: null,
					flags: 0,
					icon: DEFAULT_GUILD_FOLDER_ICON,
					guildIds: [targetGuildId, sourceGuildId],
				};
				topLevelItems[targetIdx] = {type: 'folder', folder: newFolder};
				const newGuildFolders = buildGuildFoldersFromTopLevelItems(topLevelItems);
				UserSettingsActionCreators.update({guildFolders: newGuildFolders});
				return;
			}

			if (
				!item.isFolder &&
				item.folderId != null &&
				item.folderId !== UNCATEGORIZED_FOLDER_ID &&
				targetIsFolder &&
				(position === 'before' || position === 'after')
			) {
				const sourceGuildId = item.id;
				const parsedTargetFolderId = getFolderIdFromKey(targetKey);
				const originalTopLevelItems = buildTopLevelItems(UserSettingsStore.guildFolders);
				const originalTargetIdx = originalTopLevelItems.findIndex(
					(tli) => tli.type === 'folder' && tli.folder.id === parsedTargetFolderId,
				);
				if (originalTargetIdx === -1) return;
				const cleaned = removeGuildIdsFromGuildFolders(UserSettingsStore.guildFolders, new Set([sourceGuildId]));
				const topLevelItems = buildTopLevelItems(cleaned);
				let targetIdx = topLevelItems.findIndex(
					(tli) => tli.type === 'folder' && tli.folder.id === parsedTargetFolderId,
				);
				if (targetIdx === -1) {
					targetIdx = Math.min(originalTargetIdx, topLevelItems.length);
				}
				const newItem: TopLevelGuildItem = {type: 'guild', guildId: sourceGuildId};
				const insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
				topLevelItems.splice(Math.min(insertIdx, topLevelItems.length), 0, newItem);
				const newGuildFolders = buildGuildFoldersFromTopLevelItems(topLevelItems);
				UserSettingsActionCreators.update({guildFolders: newGuildFolders});
				return;
			}

			if (
				!item.isFolder &&
				item.folderId != null &&
				item.folderId !== UNCATEGORIZED_FOLDER_ID &&
				!targetIsFolder &&
				result.targetFolderId == null &&
				(position === 'before' || position === 'after')
			) {
				const sourceGuildId = item.id;
				const targetGuildId = targetKey;
				const cleaned = removeGuildIdsFromGuildFolders(UserSettingsStore.guildFolders, new Set([sourceGuildId]));
				const topLevelItems = buildTopLevelItems(cleaned);
				const targetIdx = topLevelItems.findIndex((tli) => tli.type === 'guild' && tli.guildId === targetGuildId);
				if (targetIdx === -1) return;
				const newItem: TopLevelGuildItem = {type: 'guild', guildId: sourceGuildId};
				const insertIdx = position === 'after' ? targetIdx + 1 : targetIdx;
				topLevelItems.splice(insertIdx, 0, newItem);
				const newGuildFolders = buildGuildFoldersFromTopLevelItems(topLevelItems);
				UserSettingsActionCreators.update({guildFolders: newGuildFolders});
				return;
			}

			const oldIndex = organizedItems.findIndex((i) => getOrganizedItemKey(i) === sourceKey);
			const targetIndex = organizedItems.findIndex((i) => getOrganizedItemKey(i) === targetKey);
			if (oldIndex === -1 || targetIndex === -1) return;

			let newIndex = position === 'after' ? targetIndex + 1 : targetIndex;
			if (oldIndex < targetIndex && position === 'after') newIndex--;

			const newOrganizedItems = [...organizedItems];
			const [movedItem] = newOrganizedItems.splice(oldIndex, 1);
			newOrganizedItems.splice(newIndex, 0, movedItem);

			const topLevelItems: Array<TopLevelItem> = newOrganizedItems.map((oi) => {
				if (oi.type === 'folder') {
					return {type: 'folder' as const, folder: cloneGuildFolder(oi.folder)};
				}
				return {type: 'guild' as const, guildId: oi.guild.id};
			});
			const newGuildFolders = buildGuildFoldersFromTopLevelItems(topLevelItems);

			UserSettingsActionCreators.update({guildFolders: newGuildFolders});
		},
		[organizedItems],
	);

	const handleDragStateChange = useCallback((item: GuildDragItem | null) => {
		setIsDragging(item !== null);
	}, []);

	const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
		const scrollTop = event.currentTarget.scrollTop;
		DimensionActionCreators.updateGuildListScroll(scrollTop);
	}, []);

	useEffect(() => {
		const scrollTop = DimensionStore.getGuildListDimensions().scrollTop;
		const scrollNode = scrollRef.current?.getScrollerNode();
		if (scrollTop > 0 && scrollNode) {
			scrollNode.scrollTop = scrollTop;
		}
	}, []);

	return (
		<div className={styles.guildListScrollerWrapper}>
			<Scroller
				ref={scrollRef}
				className={styles.guildListScrollContainer}
				showTrack={false}
				onScroll={handleScroll}
				key="guild-list-scroller"
			>
				<div className={styles.guildListContent} ref={guildListNavigationRef}>
					<div className={styles.guildListTopSection}>
						<FluxerButton />
						<FavoritesButton />

						<div className={styles.dmListSection}>
							{pinnedCallChannel && (
								<div className={styles.dmListItemWrapper} key={`pinned-call-${pinnedCallChannel.id}`}>
									<DMListItem
										channel={pinnedCallChannel}
										isSelected={isSelectedPath(location.pathname, Routes.dmChannel(pinnedCallChannel.id))}
										voiceCallActive
									/>
								</div>
							)}
							{renderDMListItems(filteredDMChannels)}
						</div>

						{hasVisibleDMChannels && <div className={styles.guildDivider} />}
					</div>

					<div className={styles.guildListGuildsSection}>
						{shouldShowTopDivider && <div className={styles.guildDivider} />}

						{shouldRenderGuildListItems && (
							<div className={styles.guildListItems}>
								{hasUnavailableGuilds && (
									<div className={styles.guildListItemSlot} key="guild-outage-indicator">
										<Tooltip
											position="right"
											type={'error'}
											maxWidth="xl"
											size="large"
											text={() =>
												visibleUnavailableCount === 1
													? t`${visibleUnavailableCount} community is temporarily unavailable due to a flux capacitor malfunction.`
													: t`${visibleUnavailableCount} communities are temporarily unavailable due to a flux capacitor malfunction.`
											}
										>
											<div className={styles.unavailableContainer}>
												<div className={styles.unavailableBadge}>
													<ExclamationMarkIcon weight="regular" className={styles.unavailableIcon} />
												</div>
											</div>
										</Tooltip>
									</div>
								)}

								{organizedItems.length > 0 &&
									(() => {
										const selectedGuildIndex = guilds.findIndex((g) =>
											isSelectedPath(location.pathname, Routes.guildChannel(g.id)),
										);
										return organizedItems.map((item, index) => {
											if (item.type === 'folder') {
												const isFolderSelected = item.guilds.some((guild) =>
													isSelectedPath(location.pathname, Routes.guildChannel(guild.id)),
												);
												return (
													<div className={styles.guildListItemSlot} key={getOrganizedItemKey(item)}>
														<GuildFolderItem
															folder={item.folder}
															guilds={item.guilds}
															isSelected={isFolderSelected}
															onGuildDrop={handleGuildDrop}
															onDragStateChange={handleDragStateChange}
														/>
													</div>
												);
											}
											return (
												<div className={styles.guildListItemSlot} key={item.guild.id}>
													<GuildListItem
														isSortingList={isDragging}
														guild={item.guild}
														isSelected={isSelectedPath(location.pathname, Routes.guildChannel(item.guild.id))}
														guildIndex={index}
														selectedGuildIndex={selectedGuildIndex}
														onGuildDrop={handleGuildDrop}
														onDragStateChange={handleDragStateChange}
													/>
												</div>
											);
										});
									})()}

								{organizedItems.length > 0 && (
									<BottomDropZone
										onGuildDrop={handleGuildDrop}
										lastItemKey={getOrganizedItemKey(organizedItems[organizedItems.length - 1])}
										lastItemIsFolder={organizedItems[organizedItems.length - 1].type === 'folder'}
										isDragging={isDragging}
									/>
								)}
							</div>
						)}

						{shouldShowEmptyStateDivider && <div className={styles.guildDivider} />}

						<DiscoveryButton />
						<AddGuildButton />
						{!Platform.isElectron && !Platform.isPWA && <DownloadButton />}
						<HelpButton />
					</div>
				</div>
			</Scroller>
			<ScrollIndicatorOverlay
				getScrollContainer={getGuildScrollContainer}
				dependencies={guildIndicatorDependencies}
				label={t`New`}
			/>
		</div>
	);
});

export const GuildsLayout = observer(({children}: {children: React.ReactNode}) => {
	const mobileLayout = MobileLayoutStore;
	const user = UserStore.currentUser;
	const location = useLocation();
	const shouldReserveUserAreaSpace = !!user && !mobileLayout.enabled;
	const showGuildListOnMobile =
		mobileLayout.enabled &&
		(location.pathname === Routes.ME ||
			(Routes.isChannelRoute(location.pathname) && location.pathname.split('/').length === 3));

	const showBottomNav =
		mobileLayout.enabled &&
		(location.pathname === Routes.ME ||
			Routes.isFavoritesRoute(location.pathname) ||
			location.pathname === Routes.NOTIFICATIONS ||
			location.pathname === Routes.YOU ||
			(Routes.isGuildChannelRoute(location.pathname) && location.pathname.split('/').length === 3));

	const nagbarConditions = useNagbarConditions();
	const activeNagbars = useActiveNagbars(nagbarConditions);
	const prevNagbarCount = useRef(activeNagbars.length);
	const isReady = InitializationStore.isReady;

	useEffect(() => {
		if (prevNagbarCount.current !== activeNagbars.length) {
			prevNagbarCount.current = activeNagbars.length;
			ComponentDispatch.dispatch('LAYOUT_RESIZED');
		}
	}, [activeNagbars.length]);

	const THIRTY_MINUTES_MS = 30 * 60 * 1000;
	useEffect(() => {
		if (!isReady) return;
		if (!user) return;
		if (NagbarStore.claimAccountModalShownThisSession) return;
		if (user.isClaimed()) return;

		const accountAgeMs = SnowflakeUtils.age(user.id);
		if (accountAgeMs < THIRTY_MINUTES_MS) return;

		NagbarStore.markClaimAccountModalShown();
		openClaimAccountModal();
	}, [isReady, user, location.pathname]);

	const shouldShowSidebarDivider = !mobileLayout.enabled;

	return (
		<div
			className={clsx(
				styles.guildsLayoutContainer,
				mobileLayout.enabled && !showGuildListOnMobile && styles.guildsLayoutContainerMobile,
				shouldReserveUserAreaSpace && styles.guildsLayoutReserveSpace,
				showBottomNav && styles.guildsLayoutReserveMobileBottomNav,
			)}
		>
			{(!mobileLayout.enabled || showGuildListOnMobile) && <GuildList />}
			<div
				className={clsx(
					styles.contentContainer,
					mobileLayout.enabled && !showGuildListOnMobile && styles.contentContainerMobile,
				)}
			>
				<TopNagbarContext.Provider value={activeNagbars.length > 0}>
					<OutlineFrame
						className={styles.outlineFrame}
						sidebarDivider={shouldShowSidebarDivider}
						nagbar={
							activeNagbars.length > 0 ? (
								<div className={styles.nagbarStack}>
									<NagbarContainer nagbars={activeNagbars} />
								</div>
							) : null
						}
					>
						<div className={styles.contentInner}>{children}</div>
					</OutlineFrame>
				</TopNagbarContext.Provider>
			</div>
			{!mobileLayout.enabled && user && (
				<div className={styles.userAreaWrapper}>
					<UserArea user={user} />
				</div>
			)}
		</div>
	);
});
