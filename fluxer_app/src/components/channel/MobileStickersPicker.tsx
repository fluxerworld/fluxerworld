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
import mobileStyles from '@app/components/channel/MobileEmojiPicker.module.css';
import {PremiumUpsellBanner} from '@app/components/channel/PremiumUpsellBanner';
import premiumStyles from '@app/components/channel/PremiumUpsellBanner.module.css';
import stickerStyles from '@app/components/channel/StickersPicker.module.css';
import {PickerEmptyState} from '@app/components/channel/shared/PickerEmptyState';
import {useStickerCategories} from '@app/components/channel/sticker_picker/hooks/useStickerCategories';
import {useVirtualRows} from '@app/components/channel/sticker_picker/hooks/useVirtualRows';
import {StickerPickerCategoryList} from '@app/components/channel/sticker_picker/StickerPickerCategoryList';
import {STICKERS_PER_ROW_MOBILE} from '@app/components/channel/sticker_picker/StickerPickerConstants';
import {StickerPickerInspector} from '@app/components/channel/sticker_picker/StickerPickerInspector';
import {StickerPickerSearchBar} from '@app/components/channel/sticker_picker/StickerPickerSearchBar';
import {VirtualRowRenderer} from '@app/components/channel/sticker_picker/VirtualRow';
import {
	ExpressionPickerHeaderPortal,
	useExpressionPickerHeaderPortal,
} from '@app/components/popouts/ExpressionPickerPopout';
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
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';

export const MobileStickersPicker = observer(
	({
		channelId,
		handleSelect,
	}: {
		channelId?: string;
		handleSelect: (sticker: GuildStickerRecord, shiftKey?: boolean) => void;
	}) => {
		const {t, i18n} = useLingui();
		const headerPortalContext = useExpressionPickerHeaderPortal();
		const hasPortal = Boolean(headerPortalContext?.headerPortalElement);

		const [searchTerm, setSearchTerm] = useState('');
		const [hoveredSticker, setHoveredSticker] = useState<GuildStickerRecord | null>(null);
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
			STICKERS_PER_ROW_MOBILE,
		);

		const hasNoStickersAtAll = allItems.length === 0;

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
		const isSearching = searchTerm.trim().length > 0;
		const showPremiumUpsell =
			shouldShowPremiumFeatures() && shouldShowStickerPremiumUpsell(channel) && !isSearching && lockedStickerCount > 0;

		const handleCategoryClick = (category: string) => {
			const element = categoryRefs.current.get(category);
			if (element) {
				scrollerRef.current?.scrollIntoViewNode({node: element, shouldScrollToStart: true});
			}
		};

		const handleHover = (sticker: GuildStickerRecord | null) => {
			setHoveredSticker(sticker);
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

		if (hasNoStickersAtAll) {
			return (
				<PickerEmptyState
					icon={StickerIcon}
					title={t`No Stickers Available`}
					description={t`Join a community with stickers to get started!`}
				/>
			);
		}

		const searchBar = (
			<StickerPickerSearchBar
				searchTerm={searchTerm}
				setSearchTerm={setSearchTerm}
				hoveredSticker={hoveredSticker}
				inputRef={searchInputRef}
				selectedRow={-1}
				selectedColumn={-1}
				sections={[]}
				onSelect={() => {}}
				onSelectionChange={() => {}}
			/>
		);

		if (renderedStickers.length === 0 && searchTerm) {
			return (
				<div className={stickerStyles.searchResultsContainer}>
					{hasPortal ? <ExpressionPickerHeaderPortal>{searchBar}</ExpressionPickerHeaderPortal> : searchBar}
					<PickerEmptyState
						icon={SmileySadIcon}
						title={t`No Stickers Found`}
						description={t`Try a different search term`}
					/>
				</div>
			);
		}

		return (
			<div className={mobileStyles.container}>
				{hasPortal ? <ExpressionPickerHeaderPortal>{searchBar}</ExpressionPickerHeaderPortal> : null}
				<div className={mobileStyles.mobileEmojiPicker}>
					{!hasPortal && searchBar}
					<div className={mobileStyles.bodyWrapper}>
						<div className={mobileStyles.emojiPickerListWrapper} role="presentation">
							<Scroller
								ref={scrollerRef}
								className={`${mobileStyles.list} ${mobileStyles.listWrapper}`}
								key="mobile-stickers-picker-scroller"
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
										>
											<VirtualRowRenderer
												row={row}
												handleHover={handleHover}
												handleSelect={handleStickerSelect}
												gridColumns={STICKERS_PER_ROW_MOBILE}
												hoveredSticker={hoveredSticker}
												selectedRow={-1}
												selectedColumn={-1}
												stickerRowIndex={stickerRowIndex}
												shouldScrollOnSelection={false}
												stickerRefs={stickerRefs}
												channel={channel}
											/>
										</div>
									);
								})}
							</Scroller>
						</div>
					</div>
					<div className={mobileStyles.categoryListBottom}>
						<StickerPickerCategoryList
							stickersByGuildId={stickersByGuildId}
							handleCategoryClick={handleCategoryClick}
							horizontal={true}
						/>
					</div>
					<StickerPickerInspector hoveredSticker={hoveredSticker} />
				</div>
			</div>
		);
	},
);
