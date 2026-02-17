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

import * as EmojiPickerActionCreators from '@app/actions/EmojiPickerActionCreators';
import styles from '@app/components/channel/EmojiPicker.module.css';
import {EmojiPickerCategoryList} from '@app/components/channel/emoji_picker/EmojiPickerCategoryList';
import {EMOJI_SPRITE_SIZE} from '@app/components/channel/emoji_picker/EmojiPickerConstants';
import {EmojiPickerInspector} from '@app/components/channel/emoji_picker/EmojiPickerInspector';
import {EmojiPickerSearchBar} from '@app/components/channel/emoji_picker/EmojiPickerSearchBar';
import {useEmojiCategories} from '@app/components/channel/emoji_picker/hooks/useEmojiCategories';
import {useVirtualRows} from '@app/components/channel/emoji_picker/hooks/useVirtualRows';
import {VirtualizedRow} from '@app/components/channel/emoji_picker/VirtualRow';
import {PremiumUpsellBanner} from '@app/components/channel/PremiumUpsellBanner';
import premiumStyles from '@app/components/channel/PremiumUpsellBanner.module.css';
import {
	ExpressionPickerHeaderContext,
	ExpressionPickerHeaderPortal,
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
import {Trans, useLingui} from '@lingui/react/macro';
import {SmileySadIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import type React from 'react';
import {useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';

export const EmojiPicker = observer(
	({channelId, handleSelect}: {channelId?: string; handleSelect: (emoji: FlatEmoji, shiftKey?: boolean) => void}) => {
		const headerContext = useContext(ExpressionPickerHeaderContext);
		if (!headerContext) {
			throw new Error(
				'EmojiPicker must be rendered inside ExpressionPickerPopout so that the header portal is available.',
			);
		}

		const [searchTerm, setSearchTerm] = useState('');
		const [hoveredEmoji, setHoveredEmoji] = useState<FlatEmoji | null>(null);
		const [selectedRow, setSelectedRow] = useState(-1);
		const [selectedColumn, setSelectedColumn] = useState(-1);
		const [shouldScrollOnSelection, setShouldScrollOnSelection] = useState(false);
		const scrollerRef = useRef<ScrollerHandle>(null);
		const searchInputRef = useRef<HTMLInputElement>(null);
		const emojiRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
		const normalizedSearchTerm = useMemo(() => normalizeEmojiSearchQuery(searchTerm), [searchTerm]);

		const {i18n, t} = useLingui();
		const channel = channelId ? (ChannelStore.getChannel(channelId) ?? null) : null;
		const categoryRefs = useRef<Map<string, HTMLDivElement>>(new Map());
		const [emojiDataVersion, setEmojiDataVersion] = useState(0);
		const permissionVersion = useSyncExternalStore(
			PermissionStore.subscribe.bind(PermissionStore),
			() => PermissionStore.version,
		);
		const skinTone = EmojiStore.skinTone;
		const shouldAnimateEmoji = UserSettingsStore.getAnimateEmoji();

		const getEmojiAvailability = useCallback(
			(emoji: FlatEmoji) => checkEmojiAvailability(i18n, emoji, channel),
			[channel, i18n, permissionVersion],
		);

		const getEmojiGuildId = useCallback((emoji: FlatEmoji) => emoji.guildId, []);

		const renderEmojiPreviewItem = useCallback(
			(emoji: FlatEmoji) => {
				const key = emoji.id ?? emoji.uniqueName ?? emoji.name ?? `${emoji.guildId ?? 'unicode'}-preview`;
				const content = emoji.url ? (
					<img src={emoji.url} alt={emoji.name} loading="lazy" />
				) : shouldUseNativeEmoji && emoji.surrogates ? (
					<span className={premiumStyles.previewEmojiText}>
						{emoji.hasDiversity && skinTone ? emoji.surrogates + skinTone : emoji.surrogates}
					</span>
				) : (
					<span className={premiumStyles.previewEmojiText}>{emoji.name ?? emoji.uniqueName}</span>
				);
				return (
					<div className={premiumStyles.previewItem} key={key}>
						{content}
					</div>
				);
			},
			[skinTone],
		);

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

		useEffect(() => {
			const handleEmojiDataUpdated = () => {
				setEmojiDataVersion((version) => version + 1);
			};
			return ComponentDispatch.subscribe('EMOJI_PICKER_RERENDER', handleEmojiDataUpdated);
		}, []);

		useSearchInputAutofocus(searchInputRef);

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
		const allUpsell = usePremiumUpsellData({
			items: allItems,
			getAvailability: getEmojiAvailability,
			getGuildId: getEmojiGuildId,
			renderPreviewItem: renderEmojiPreviewItem,
			previewLimit: 4,
		});

		const {favoriteEmojis, frequentlyUsedEmojis, customEmojisByGuildId, unicodeEmojisByCategory} = useEmojiCategories(
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
		);

		const lockedEmojiCount = allUpsell.summary.lockedItems.length;
		const communityCount = allUpsell.summary.communityCount;
		const previewContent = allUpsell.previewContent;
		const emojiLabel =
			lockedEmojiCount === 1 ? t`${lockedEmojiCount} custom emoji` : t`${lockedEmojiCount} custom emojis`;
		const communityLabel = communityCount === 1 ? t`${communityCount} community` : t`${communityCount} communities`;
		const emojiUpsellMessage = (
			<Trans>
				Unlock {emojiLabel} from {communityLabel} with Plutonium.
			</Trans>
		);

		const showPremiumUpsell =
			shouldShowPremiumFeatures() &&
			shouldShowEmojiPremiumUpsell(channel) &&
			!normalizedSearchTerm &&
			lockedEmojiCount > 0;

		const sections = useMemo(() => {
			const result: Array<number> = [];
			for (const row of virtualRows) {
				if (row.type === 'emoji-row') {
					result.push(row.emojis.length);
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

		const handleHover = (emoji: FlatEmoji | null, row?: number, column?: number) => {
			setHoveredEmoji(emoji);
			if (emoji && row !== undefined && column !== undefined) {
				handleSelectionChange(row, column, false);
			}
		};

		const handleEmojiSelect = useCallback(
			(emoji: FlatEmoji, shiftKey?: boolean) => {
				const availability = checkEmojiAvailability(i18n, emoji, channel);
				if (!availability.canUse) {
					return;
				}

				EmojiPickerActionCreators.trackEmojiUsage(emoji);
				handleSelect(emoji, shiftKey);
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
					if (virtualRow.type === 'emoji-row') {
						if (currentRow === row && column < virtualRow.emojis.length) {
							const emoji = virtualRow.emojis[column];
							setHoveredEmoji(emoji);
							break;
						}
						currentRow++;
					}
				}
			},
			[virtualRows],
		);

		useEffect(() => {
			if (renderedEmojis.length > 0 && selectedRow === 0 && selectedColumn === 0 && !hoveredEmoji) {
				handleSelectionChange(0, 0, false);
			}
		}, [renderedEmojis, selectedRow, selectedColumn, hoveredEmoji, handleSelectionChange]);

		const handleSelectEmoji = useCallback(
			(row: number | null, column: number | null, event?: React.KeyboardEvent) => {
				if (row === null || column === null) {
					return;
				}

				let currentRow = 0;
				for (const virtualRow of virtualRows) {
					if (virtualRow.type === 'emoji-row') {
						if (currentRow === row && column < virtualRow.emojis.length) {
							const emoji = virtualRow.emojis[column];
							handleEmojiSelect(emoji, event?.shiftKey);
							return;
						}
						currentRow++;
					}
				}
			},
			[virtualRows, handleEmojiSelect],
		);

		return (
			<div className={styles.container}>
				<ExpressionPickerHeaderPortal>
					<EmojiPickerSearchBar
						searchTerm={searchTerm}
						setSearchTerm={setSearchTerm}
						hoveredEmoji={hoveredEmoji}
						inputRef={searchInputRef}
						selectedRow={selectedRow}
						selectedColumn={selectedColumn}
						sections={sections}
						onSelect={handleSelectEmoji}
						onSelectionChange={handleSelectionChange}
					/>
				</ExpressionPickerHeaderPortal>
				<div className={styles.emojiPicker}>
					<div className={styles.bodyWrapper}>
						<div className={styles.emojiPickerListWrapper} role="presentation">
							<Scroller
								ref={scrollerRef}
								className={`${styles.list} ${styles.listWrapper}`}
								fade={false}
								key="emoji_picker-scroller"
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
								{virtualRows.map((row, index) => {
									const emojiRowIndex = virtualRows.slice(0, index).filter((r) => r.type === 'emoji-row').length;
									const needsSpacingAfter = row.type === 'emoji-row' && virtualRows[index + 1]?.type === 'header';

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
											style={row.type === 'emoji-row' && needsSpacingAfter ? {marginBottom: '12px'} : undefined}
										>
											<VirtualizedRow
												row={row}
												handleHover={handleHover}
												handleSelect={handleEmojiSelect}
												skinTone={skinTone}
												spriteSheetSizes={spriteSheetSizes}
												channel={channel}
												allowAnimation={shouldAnimateEmoji}
												hoveredEmoji={hoveredEmoji}
												selectedRow={selectedRow}
												selectedColumn={selectedColumn}
												emojiRowIndex={emojiRowIndex}
												shouldScrollOnSelection={shouldScrollOnSelection}
												emojiRefs={emojiRefs}
											/>
										</div>
									);
								})}
							</Scroller>
							{renderedEmojis.length === 0 && (
								<div className={styles.emptyState}>
									<div className={styles.emptyStateInner}>
										<div className={styles.emptyIcon}>
											<SmileySadIcon weight="duotone" />
										</div>
										<div className={styles.emptyLabel}>{t`No emojis match your search`}</div>
									</div>
								</div>
							)}
						</div>
					</div>
					<EmojiPickerInspector hoveredEmoji={hoveredEmoji} />
				</div>
				<EmojiPickerCategoryList
					customEmojisByGuildId={customEmojisByGuildId}
					unicodeEmojisByCategory={unicodeEmojisByCategory}
					handleCategoryClick={handleCategoryClick}
					showFrequentlyUsedButton={showFrequentlyUsedButton}
				/>
			</div>
		);
	},
);
