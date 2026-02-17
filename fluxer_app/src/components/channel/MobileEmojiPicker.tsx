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

import {EmojiPickerCategoryList} from '@app/components/channel/emoji_picker/EmojiPickerCategoryList';
import {EMOJI_SPRITE_SIZE} from '@app/components/channel/emoji_picker/EmojiPickerConstants';
import {EmojiPickerSearchBar} from '@app/components/channel/emoji_picker/EmojiPickerSearchBar';
import {useEmojiCategories} from '@app/components/channel/emoji_picker/hooks/useEmojiCategories';
import {useVirtualRows} from '@app/components/channel/emoji_picker/hooks/useVirtualRows';
import {VirtualizedRow} from '@app/components/channel/emoji_picker/VirtualRow';
import mobileStyles from '@app/components/channel/MobileEmojiPicker.module.css';
import {PremiumUpsellBanner} from '@app/components/channel/PremiumUpsellBanner';
import premiumStyles from '@app/components/channel/PremiumUpsellBanner.module.css';
import {
	ExpressionPickerHeaderPortal,
	useExpressionPickerHeaderPortal,
} from '@app/components/popouts/ExpressionPickerPopout';
import {Scroller, type ScrollerHandle} from '@app/components/uikit/Scroller';
import {usePremiumUpsellData} from '@app/hooks/usePremiumUpsellData';
import {useSearchInputAutofocus} from '@app/hooks/useSearchInputAutofocus';
import {ComponentDispatch} from '@app/lib/ComponentDispatch';
import UnicodeEmojis, {EMOJI_SPRITES} from '@app/lib/UnicodeEmojis';
import ChannelStore from '@app/stores/ChannelStore';
import EmojiStore, {normalizeEmojiSearchQuery} from '@app/stores/EmojiStore';
import PermissionStore from '@app/stores/PermissionStore';
import UserSettingsStore from '@app/stores/UserSettingsStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {shouldUseNativeEmoji} from '@app/utils/EmojiUtils';
import {checkEmojiAvailability, shouldShowEmojiPremiumUpsell} from '@app/utils/ExpressionPermissionUtils';
import {shouldShowPremiumFeatures} from '@app/utils/PremiumUtils';
import {useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';

export const MobileEmojiPicker = observer(
	({
		channelId,
		handleSelect,
		externalSearchTerm,
		externalSetSearchTerm,
		hideSearchBar = false,
	}: {
		channelId?: string;
		handleSelect: (emoji: FlatEmoji, shiftKey?: boolean) => void;
		externalSearchTerm?: string;
		externalSetSearchTerm?: (term: string) => void;
		hideSearchBar?: boolean;
	}) => {
		const headerPortalContext = useExpressionPickerHeaderPortal();
		const hasPortal = Boolean(headerPortalContext?.headerPortalElement);
		const {i18n, t} = useLingui();

		const [internalSearchTerm, setInternalSearchTerm] = useState('');
		const [hoveredEmoji, setHoveredEmoji] = useState<FlatEmoji | null>(null);
		const scrollerRef = useRef<ScrollerHandle>(null);
		const searchInputRef = useRef<HTMLInputElement>(null);
		const emojiRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

		const channel = channelId ? (ChannelStore.getChannel(channelId) ?? null) : null;
		const categoryRefs = useRef<Map<string, HTMLDivElement>>(new Map());
		const [emojiDataVersion, setEmojiDataVersion] = useState(0);
		const permissionVersion = useSyncExternalStore(
			PermissionStore.subscribe.bind(PermissionStore),
			() => PermissionStore.version,
		);
		const getEmojiAvailability = useCallback(
			(emoji: FlatEmoji) => checkEmojiAvailability(i18n, emoji, channel),
			[channel, i18n, permissionVersion],
		);
		const getEmojiGuildId = useCallback((emoji: FlatEmoji) => emoji.guildId, []);
		const skinTone = EmojiStore.skinTone;
		const shouldAnimateEmoji = UserSettingsStore.getAnimateEmoji();

		const spriteSheetSizes = useMemo(() => {
			const nonDiversitySize = [
				`${EMOJI_SPRITE_SIZE * EMOJI_SPRITES.NonDiversityPerRow}px`,
				`${EMOJI_SPRITE_SIZE * Math.ceil(UnicodeEmojis.numNonDiversitySprites / EMOJI_SPRITES.NonDiversityPerRow)}px`,
			].join(' ');

			const diversitySize = [
				`${EMOJI_SPRITE_SIZE * EMOJI_SPRITES.DiversityPerRow}px`,
				`${EMOJI_SPRITE_SIZE * Math.ceil(UnicodeEmojis.numDiversitySprites / EMOJI_SPRITES.DiversityPerRow)}px`,
			].join(' ');

			return {nonDiversitySize, diversitySize};
		}, []);

		const searchTerm = externalSearchTerm ?? internalSearchTerm;
		const setSearchTerm = externalSetSearchTerm ?? setInternalSearchTerm;
		const normalizedSearchTerm = useMemo(() => normalizeEmojiSearchQuery(searchTerm), [searchTerm]);

		useEffect(() => {
			const handleEmojiDataUpdated = () => {
				setEmojiDataVersion((version) => version + 1);
			};
			return ComponentDispatch.subscribe('EMOJI_PICKER_RERENDER', handleEmojiDataUpdated);
		}, []);

		const searchItems = useMemo(
			() => EmojiStore.search(channel, normalizedSearchTerm).slice(),
			[channel, normalizedSearchTerm, emojiDataVersion],
		);
		const searchUpsell = usePremiumUpsellData({
			items: searchItems,
			getAvailability: getEmojiAvailability,
			getGuildId: getEmojiGuildId,
		});
		const renderedEmojis = searchUpsell.accessibleItems;

		const allItems = useMemo(() => EmojiStore.search(channel, '').slice(), [channel, emojiDataVersion]);
		const renderEmojiPreviewItem = useCallback(
			(emoji: FlatEmoji) => {
				const key = emoji.id ?? emoji.uniqueName ?? emoji.name ?? `${emoji.guildId ?? 'unicode'}-mobile`;
				let content: React.ReactNode;
				if (emoji.url) {
					content = <img src={emoji.url} alt={emoji.name} loading="lazy" />;
				} else if (shouldUseNativeEmoji && emoji.surrogates) {
					const hasDiversity = emoji.hasDiversity && skinTone;
					const displayEmoji = hasDiversity ? emoji.surrogates + skinTone : emoji.surrogates;
					content = <span className={premiumStyles.previewEmojiText}>{displayEmoji}</span>;
				} else {
					content = <span className={premiumStyles.previewEmojiText}>{emoji.name ?? emoji.uniqueName}</span>;
				}
				return (
					<div className={premiumStyles.previewItem} key={key}>
						{content}
					</div>
				);
			},
			[skinTone],
		);
		const allUpsell = usePremiumUpsellData({
			items: allItems,
			getAvailability: getEmojiAvailability,
			getGuildId: getEmojiGuildId,
			renderPreviewItem: renderEmojiPreviewItem,
			previewLimit: 4,
		});

		useSearchInputAutofocus(searchInputRef);

		const {customEmojisByGuildId, unicodeEmojisByCategory, favoriteEmojis, frequentlyUsedEmojis} = useEmojiCategories(
			allUpsell.accessibleItems,
			renderedEmojis,
		);
		const showFrequentlyUsedButton = frequentlyUsedEmojis.length > 0 && !normalizedSearchTerm;
		const virtualRows = useVirtualRows(
			normalizedSearchTerm,
			renderedEmojis,
			favoriteEmojis,
			frequentlyUsedEmojis,
			customEmojisByGuildId,
			unicodeEmojisByCategory,
			8,
		);

		const lockedEmojiCount = allUpsell.summary.lockedItems.length;
		const communityCount = allUpsell.summary.communityCount;
		const previewContent = allUpsell.previewContent;
		const emojiLabel =
			lockedEmojiCount === 1 ? t`${lockedEmojiCount} custom emoji` : t`${lockedEmojiCount} custom emojis`;
		const communityLabel = communityCount === 1 ? t`${communityCount} community` : t`${communityCount} communities`;
		const emojiUpsellMessage = t`Unlock ${emojiLabel} from ${communityLabel} with Plutonium.`;
		const showPremiumUpsell =
			shouldShowPremiumFeatures() &&
			shouldShowEmojiPremiumUpsell(channel) &&
			!normalizedSearchTerm &&
			lockedEmojiCount > 0;

		const handleCategoryClick = (category: string) => {
			const element = categoryRefs.current.get(category);
			if (element) {
				scrollerRef.current?.scrollIntoViewNode({node: element, shouldScrollToStart: true});
			}
		};

		const handleHover = (emoji: FlatEmoji | null) => {
			setHoveredEmoji(emoji);
		};

		const searchBar = !hideSearchBar ? (
			<EmojiPickerSearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} hoveredEmoji={hoveredEmoji} />
		) : null;

		return (
			<div className={mobileStyles.container}>
				{hasPortal && searchBar ? <ExpressionPickerHeaderPortal>{searchBar}</ExpressionPickerHeaderPortal> : null}
				<div className={mobileStyles.mobileEmojiPicker}>
					{!hasPortal && searchBar}
					<div className={mobileStyles.bodyWrapper}>
						<div className={mobileStyles.emojiPickerListWrapper} role="presentation">
							<Scroller
								ref={scrollerRef}
								className={`${mobileStyles.list} ${mobileStyles.listWrapper}`}
								key="mobile-emoji_picker-scroller"
								data-emoji-picker-scroll-root="true"
							>
								{showPremiumUpsell && (
									<PremiumUpsellBanner
										message={emojiUpsellMessage}
										communityIds={allUpsell.summary.lockedCommunityIds}
										communityCount={communityCount}
										previewContent={previewContent}
									/>
								)}
								{virtualRows.map((row) => (
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
										<VirtualizedRow
											row={row}
											handleHover={handleHover}
											handleSelect={handleSelect}
											skinTone={skinTone}
											spriteSheetSizes={spriteSheetSizes}
											channel={channel}
											allowAnimation={shouldAnimateEmoji}
											gridColumns={8}
											hoveredEmoji={hoveredEmoji}
											selectedRow={-1}
											selectedColumn={-1}
											emojiRowIndex={0}
											emojiRefs={emojiRefs}
										/>
									</div>
								))}
							</Scroller>
						</div>
					</div>
					<div className={mobileStyles.categoryListBottom}>
						<Scroller
							className={mobileStyles.categoryListBottomScroller}
							orientation="horizontal"
							overflow="auto"
							fade={false}
							showTrack={false}
							key="mobile-emoji-picker-category-scroller"
						>
							<div className={mobileStyles.categoryListBottomContent}>
								<EmojiPickerCategoryList
									customEmojisByGuildId={customEmojisByGuildId}
									unicodeEmojisByCategory={unicodeEmojisByCategory}
									handleCategoryClick={handleCategoryClick}
									horizontal={true}
									showFrequentlyUsedButton={showFrequentlyUsedButton}
								/>
							</div>
						</Scroller>
					</div>
				</div>
			</div>
		);
	},
);
