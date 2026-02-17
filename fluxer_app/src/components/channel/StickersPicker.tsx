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

import * as StickerPickerActionCreators from '@app/actions/StickerPickerActionCreators';
import styles from '@app/components/channel/EmojiPicker.module.css';
import gifStyles from '@app/components/channel/GifPicker.module.css';
import {PremiumUpsellBanner} from '@app/components/channel/PremiumUpsellBanner';
import premiumStyles from '@app/components/channel/PremiumUpsellBanner.module.css';
import {PickerEmptyState} from '@app/components/channel/shared/PickerEmptyState';
import {useStickerCategories} from '@app/components/channel/sticker_picker/hooks/useStickerCategories';
import {useVirtualRows} from '@app/components/channel/sticker_picker/hooks/useVirtualRows';
import {StickerPickerCategoryList} from '@app/components/channel/sticker_picker/StickerPickerCategoryList';
import {STICKERS_PER_ROW} from '@app/components/channel/sticker_picker/StickerPickerConstants';
import {StickerPickerInspector} from '@app/components/channel/sticker_picker/StickerPickerInspector';
import {StickerPickerSearchBar} from '@app/components/channel/sticker_picker/StickerPickerSearchBar';
import {VirtualRowWrapper} from '@app/components/channel/sticker_picker/VirtualRow';
import {ExpressionPickerHeaderPortal} from '@app/components/popouts/ExpressionPickerPopout';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {usePremiumUpsellData} from '@app/hooks/usePremiumUpsellData';
import {useSearchInputAutofocus} from '@app/hooks/useSearchInputAutofocus';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import type {GuildStickerRecord} from '@app/records/GuildStickerRecord';
import ChannelStore from '@app/stores/ChannelStore';
import PermissionStore from '@app/stores/PermissionStore';
import StickerStore from '@app/stores/StickerStore';
import {checkStickerAvailability, shouldShowStickerPremiumUpsell} from '@app/utils/ExpressionPermissionUtils';
import {shouldShowPremiumFeatures} from '@app/utils/PremiumUtils';
import {Trans, useLingui} from '@lingui/react/macro';
import {SmileySadIcon, StickerIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';

export const StickersPicker = observer(
	({
		channelId,
		handleSelect,
	}: {
		channelId?: string;
		handleSelect: (sticker: GuildStickerRecord, shiftKey?: boolean) => void;
	}) => {
		const {t, i18n} = useLingui();
		const [searchTerm, setSearchTerm] = useState('');
		const [hoveredSticker, setHoveredSticker] = useState<GuildStickerRecord | null>(null);
		const [selectedRow, setSelectedRow] = useState(-1);
		const [selectedColumn, setSelectedColumn] = useState(-1);
		const [shouldScrollOnSelection, setShouldScrollOnSelection] = useState(false);
		const scrollerRef = useRef<ScrollerHandle>(null);
		const searchInputRef = useRef<HTMLInputElement>(null);
		const stickerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

		const channel = channelId ? (ChannelStore.getChannel(channelId) ?? null) : null;
		const categoryRefs = useRef<Map<string, HTMLDivElement>>(new Map());
		const [stickerDataVersion, setStickerDataVersion] = useState(0);
		const permissionVersion = useSyncExternalStore(
			PermissionStore.subscribe.bind(PermissionStore),
			() => PermissionStore.version,
		);
		const getStickerAvailability = useCallback(
			(sticker: GuildStickerRecord) => checkStickerAvailability(i18n, sticker, channel),
			[channel, i18n, permissionVersion],
		);
		const getStickerGuildId = useCallback((sticker: GuildStickerRecord) => sticker.guildId, []);

		const renderStickerPreviewItem = useCallback(
			(sticker: GuildStickerRecord) => (
				<div className={premiumStyles.previewItem} key={`${sticker.guildId ?? 'guild'}-${sticker.id}`}>
					<img src={sticker.url} alt={sticker.name} loading="lazy" />
				</div>
			),
			[],
		);

		useEffect(() => {
			const handleStickerDataUpdated = () => {
				setStickerDataVersion((version) => version + 1);
			};
			return ComponentDispatch.subscribe('STICKER_PICKER_RERENDER', handleStickerDataUpdated);
		}, []);

		useSearchInputAutofocus(searchInputRef);

		const searchItems = useMemo(
			() => StickerStore.searchWithChannel(channel, searchTerm),
			[channel, searchTerm, stickerDataVersion],
		);
		const searchUpsell = usePremiumUpsellData({
			items: searchItems,
			getAvailability: getStickerAvailability,
			getGuildId: getStickerGuildId,
		});
		const renderedStickers = searchUpsell.accessibleItems;

		const allItems = StickerStore.getAllStickers();
		const allUpsell = usePremiumUpsellData({
			items: allItems,
			getAvailability: getStickerAvailability,
			getGuildId: getStickerGuildId,
			renderPreviewItem: renderStickerPreviewItem,
			previewLimit: 4,
		});

		const {favoriteStickers, frequentlyUsedStickers, stickersByGuildId} = useStickerCategories(
			allUpsell.accessibleItems,
			renderedStickers,
		);
		const virtualRows = useVirtualRows(
			searchTerm,
			renderedStickers,
			favoriteStickers,
			frequentlyUsedStickers,
			stickersByGuildId,
			STICKERS_PER_ROW,
		);

		const hasNoStickersAtAll = allItems.length === 0;

		const isSearching = searchTerm.trim().length > 0;
		const lockedStickerCount = allUpsell.summary.lockedItems.length;
		const previewContent = allUpsell.previewContent;
		const stickerCommunityCount = allUpsell.summary.communityCount;
		const stickerLabel =
			lockedStickerCount === 1 ? t`${lockedStickerCount} sticker` : t`${lockedStickerCount} stickers`;
		const communityLabel =
			stickerCommunityCount === 1 ? t`${stickerCommunityCount} community` : t`${stickerCommunityCount} communities`;
		const stickerUpsellMessage = (
			<Trans>
				Unlock {stickerLabel} from {communityLabel} with Plutonium.
			</Trans>
		);
		const showPremiumUpsell =
			shouldShowPremiumFeatures() && shouldShowStickerPremiumUpsell(channel) && !isSearching && lockedStickerCount > 0;

		const sections = useMemo(() => {
			const result: Array<number> = [];
			for (const row of virtualRows) {
				if (row.type === 'sticker-row') {
					result.push(row.stickers.length);
				}
			}
			return result;
		}, [virtualRows]);

		const handleCategoryClick = (category: string) => {
			const element = categoryRefs.current.get(category);
			if (element) {
				scrollerRef.current?.scrollIntoViewNode({node: element, shouldScrollToStart: true});
			}
		};

		const handleHover = (sticker: GuildStickerRecord | null, row?: number, column?: number) => {
			setHoveredSticker(sticker);
			if (sticker && row !== undefined && column !== undefined) {
				handleSelectionChange(row, column, false);
			}
		};

		const handleStickerSelect = useCallback(
			(sticker: GuildStickerRecord, shiftKey?: boolean) => {
				const availability = checkStickerAvailability(i18n, sticker, channel);
				if (!availability.canUse) {
					return;
				}

				StickerPickerActionCreators.trackStickerUsage(sticker);
				handleSelect(sticker, shiftKey);
			},
			[channel, handleSelect, i18n],
		);

		const handleSelectionChange = useCallback(
			(row: number, column: number, shouldScroll = false) => {
				if (row < 0 || column < 0) {
					return;
				}
				setSelectedRow(row);
				setSelectedColumn(column);
				setShouldScrollOnSelection(shouldScroll);

				let currentRow = 0;
				for (const virtualRow of virtualRows) {
					if (virtualRow.type === 'sticker-row') {
						if (currentRow === row && column < virtualRow.stickers.length) {
							const sticker = virtualRow.stickers[column];
							setHoveredSticker(sticker);
							break;
						}
						currentRow++;
					}
				}
			},
			[virtualRows],
		);

		useEffect(() => {
			if (renderedStickers.length > 0 && selectedRow === 0 && selectedColumn === 0 && !hoveredSticker) {
				handleSelectionChange(0, 0, false);
			}
		}, [renderedStickers, selectedRow, selectedColumn, hoveredSticker, handleSelectionChange]);

		const handleSelectSticker = useCallback(
			(row: number | null, column: number | null, event?: React.KeyboardEvent) => {
				if (row === null || column === null) {
					return;
				}

				let currentRow = 0;
				for (const virtualRow of virtualRows) {
					if (virtualRow.type === 'sticker-row') {
						if (currentRow === row && column < virtualRow.stickers.length) {
							const sticker = virtualRow.stickers[column];
							handleStickerSelect(sticker, event?.shiftKey);
							return;
						}
						currentRow++;
					}
				}
			},
			[virtualRows, handleStickerSelect],
		);

		if (hasNoStickersAtAll) {
			return (
				<div className={gifStyles.gifPickerContainer}>
					<div className={gifStyles.gifPickerMain}>
						<PickerEmptyState
							icon={StickerIcon}
							title={t`No Stickers Available`}
							description={t`Join a community with stickers to get started!`}
						/>
					</div>
				</div>
			);
		}

		const renderSearchBar = () => (
			<StickerPickerSearchBar
				searchTerm={searchTerm}
				setSearchTerm={setSearchTerm}
				hoveredSticker={hoveredSticker}
				inputRef={searchInputRef}
				selectedRow={selectedRow}
				selectedColumn={selectedColumn}
				sections={sections}
				onSelect={handleSelectSticker}
				onSelectionChange={handleSelectionChange}
			/>
		);

		return (
			<div className={styles.container}>
				<ExpressionPickerHeaderPortal>{renderSearchBar()}</ExpressionPickerHeaderPortal>
				<div className={styles.emojiPicker}>
					<div className={styles.bodyWrapper}>
						<div className={styles.emojiPickerListWrapper} role="presentation">
							<Scroller
								ref={scrollerRef}
								className={`${styles.list} ${styles.listWrapper}`}
								fade={false}
								key="stickers-picker-scroller"
							>
								{showPremiumUpsell && (
									<PremiumUpsellBanner
										message={stickerUpsellMessage}
										communityIds={allUpsell.summary.lockedCommunityIds}
										communityCount={stickerCommunityCount}
										previewContent={previewContent}
									/>
								)}
								{virtualRows.map((row, index) => {
									const stickerRowIndex = virtualRows.slice(0, index).filter((r) => r.type === 'sticker-row').length;
									const needsSpacingAfter = row.type === 'sticker-row' && virtualRows[index + 1]?.type === 'header';

									return (
										<div
											key={`${row.type}-${row.index}`}
											ref={
												row.type === 'header'
													? (el) => {
															if (el && 'category' in row) {
																categoryRefs.current.set(row.category, el);
															}
														}
													: undefined
											}
											style={row.type === 'sticker-row' && needsSpacingAfter ? {marginBottom: '12px'} : undefined}
										>
											<VirtualRowWrapper
												row={row}
												handleHover={handleHover}
												handleSelect={handleStickerSelect}
												gridColumns={STICKERS_PER_ROW}
												hoveredSticker={hoveredSticker}
												selectedRow={selectedRow}
												selectedColumn={selectedColumn}
												stickerRowIndex={stickerRowIndex}
												shouldScrollOnSelection={shouldScrollOnSelection}
												stickerRefs={stickerRefs}
												channel={channel}
											/>
										</div>
									);
								})}
							</Scroller>
							{renderedStickers.length === 0 && (
								<div className={styles.emptyState}>
									<div className={styles.emptyStateInner}>
										<div className={styles.emptyIcon}>
											<SmileySadIcon weight="duotone" />
										</div>
										<div className={styles.emptyLabel}>{t`No stickers match your search`}</div>
									</div>
								</div>
							)}
						</div>
					</div>
					<StickerPickerInspector hoveredSticker={hoveredSticker} />
				</div>
				<StickerPickerCategoryList stickersByGuildId={stickersByGuildId} handleCategoryClick={handleCategoryClick} />
			</div>
		);
	},
);
