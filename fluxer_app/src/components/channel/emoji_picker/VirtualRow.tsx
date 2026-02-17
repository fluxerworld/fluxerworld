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
import {
	CATEGORY_HEADER_HEIGHT,
	EMOJI_ROW_HEIGHT,
	OVERSCAN_ROWS,
} from '@app/components/channel/emoji_picker/EmojiPickerConstants';
import {EmojiRenderer} from '@app/components/channel/emoji_picker/EmojiRenderer';
import {GuildIcon} from '@app/components/popouts/GuildIcon';
import type {ChannelRecord} from '@app/records/ChannelRecord';
import EmojiPickerStore from '@app/stores/EmojiPickerStore';
import GuildStore from '@app/stores/GuildStore';
import type {FlatEmoji} from '@app/types/EmojiTypes';
import {CaretDownIcon, ClockIcon, StarIcon} from '@phosphor-icons/react';
import {observer} from 'mobx-react-lite';
import React, {useEffect, useRef, useState} from 'react';

export type VirtualRow =
	| {type: 'header'; category: string; name: string; guildId?: string; index: number}
	| {type: 'emoji-row'; emojis: Array<FlatEmoji>; index: number; isCustomEmoji?: boolean; guildId?: string};

interface VirtualRowRendererProps {
	row: VirtualRow;
	handleHover: (emoji: FlatEmoji | null, row?: number, column?: number) => void;
	handleSelect: (emoji: FlatEmoji, shiftKey?: boolean) => void;
	skinTone: string;
	spriteSheetSizes: {nonDiversitySize: string; diversitySize: string};
	channel: ChannelRecord | null;
	shouldAnimate: boolean;
	gridColumns?: number;
	hoveredEmoji: FlatEmoji | null;
	selectedRow: number;
	selectedColumn: number;
	emojiRowIndex: number;
	shouldScrollOnSelection?: boolean;
	emojiRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
}

const VirtualRowRenderer: React.FC<VirtualRowRendererProps> = React.memo(
	({
		row,
		handleHover,
		handleSelect,
		skinTone,
		spriteSheetSizes,
		channel,
		shouldAnimate,
		gridColumns = 9,
		selectedRow,
		selectedColumn,
		emojiRowIndex,
		shouldScrollOnSelection = false,
		emojiRefs,
	}) => {
		if (row.type === 'header') {
			const isCollapsed = EmojiPickerStore.isCategoryCollapsed(row.category);

			const handleToggleCategory = () => {
				EmojiPickerActionCreators.toggleCategory(row.category);
			};

			let leadingIcon: React.ReactNode = null;
			if (row.category === 'favorites') {
				leadingIcon = <StarIcon weight="fill" className={styles.headerIcon} />;
			} else if (row.category === 'frequently-used') {
				leadingIcon = <ClockIcon weight="fill" className={styles.headerIcon} />;
			} else if (row.guildId) {
				leadingIcon = (
					<div className={styles.headerIcon}>
						<GuildIcon
							id={row.guildId}
							name={row.name}
							icon={GuildStore.getGuild(row.guildId)?.icon ?? null}
							sizePx={16}
						/>
					</div>
				);
			}

			return (
				<button
					type="button"
					onClick={handleToggleCategory}
					className={styles.categoryTitle}
					style={{
						height: `${CATEGORY_HEADER_HEIGHT}px`,
						display: 'flex',
						alignItems: 'center',
						paddingLeft: '12px',
						paddingRight: '12px',
						marginBottom: '8px',
						position: 'sticky',
						top: 0,
						zIndex: 1,
						cursor: 'pointer',
						border: 'none',
						width: '100%',
						textAlign: 'left',
						gap: '8px',
						minWidth: 0,
					}}
				>
					{leadingIcon}
					<div style={{display: 'flex', alignItems: 'center', flex: '1 1 auto', minWidth: 0}}>
						<span
							className={styles.categoryTitle}
							style={{
								minWidth: 0,
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
								flex: '0 1 auto',
							}}
						>
							{row.name}
						</span>
						<CaretDownIcon
							weight="bold"
							className={styles.caretIcon}
							style={{transform: `rotate(${isCollapsed ? -90 : 0}deg)`, marginLeft: '8px'}}
						/>
					</div>
				</button>
			);
		}

		return (
			<div
				style={{
					height: `${EMOJI_ROW_HEIGHT}px`,
					position: 'relative',
				}}
			>
				<div
					className={styles.emojiGrid}
					style={{
						gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
					}}
				>
					{row.emojis.map((emoji, colIndex) => {
						const isSelected = emojiRowIndex === selectedRow && colIndex === selectedColumn;
						const shouldHighlight = isSelected;

						return (
							<EmojiRenderer
								key={emoji.name}
								emoji={emoji}
								handleHover={(e) => handleHover(e, emojiRowIndex, colIndex)}
								handleSelect={handleSelect}
								skinTone={skinTone}
								spriteSheetSizes={spriteSheetSizes}
								channel={channel}
								shouldAnimate={shouldAnimate}
								isHighlighted={shouldHighlight}
								shouldScrollIntoView={isSelected && shouldScrollOnSelection}
								ref={(node) => {
									const key = `${emojiRowIndex}-${colIndex}`;
									if (node) {
										emojiRefs.current.set(key, node);
									} else {
										emojiRefs.current.delete(key);
									}
								}}
							/>
						);
					})}
				</div>
			</div>
		);
	},
);

interface VirtualizedRowProps {
	row: VirtualRow;
	handleHover: (emoji: FlatEmoji | null, row?: number, column?: number) => void;
	handleSelect: (emoji: FlatEmoji, shiftKey?: boolean) => void;
	skinTone: string;
	spriteSheetSizes: {nonDiversitySize: string; diversitySize: string};
	channel: ChannelRecord | null;
	allowAnimation: boolean;
	gridColumns?: number;
	hoveredEmoji: FlatEmoji | null;
	selectedRow: number;
	selectedColumn: number;
	emojiRowIndex: number;
	shouldScrollOnSelection?: boolean;
	emojiRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
}

export const VirtualizedRow: React.FC<VirtualizedRowProps> = observer(
	({
		row,
		handleHover,
		handleSelect,
		skinTone,
		spriteSheetSizes,
		channel,
		allowAnimation,
		gridColumns,
		hoveredEmoji,
		selectedRow,
		selectedColumn,
		emojiRowIndex,
		shouldScrollOnSelection = false,
		emojiRefs,
	}) => {
		const [isVisible, setIsVisible] = useState(false);
		const [isInViewport, setIsInViewport] = useState(false);
		const placeholderRef = useRef<HTMLDivElement>(null);

		useEffect(() => {
			const placeholder = placeholderRef.current;
			if (!placeholder) return;
			const root = placeholder.closest('[data-emoji-picker-scroll-root]');
			const overscanDistance = OVERSCAN_ROWS * EMOJI_ROW_HEIGHT;

			const visibilityObserver = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (entry.isIntersecting) {
							setIsVisible(true);
						} else {
							const rect = entry.boundingClientRect;
							const rootTop = entry.rootBounds?.top ?? 0;
							const rootBottom = entry.rootBounds?.bottom ?? window.innerHeight;

							if (rect.bottom < rootTop - overscanDistance || rect.top > rootBottom + overscanDistance) {
								setIsVisible(false);
							}
						}
					});
				},
				{
					root,
					rootMargin: `${OVERSCAN_ROWS * EMOJI_ROW_HEIGHT}px 0px`,
					threshold: 0,
				},
			);
			const animationObserver = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						setIsInViewport(entry.isIntersecting);
					});
				},
				{
					root,
					rootMargin: '0px',
					threshold: 0,
				},
			);

			visibilityObserver.observe(placeholder);
			animationObserver.observe(placeholder);

			return () => {
				visibilityObserver.disconnect();
				animationObserver.disconnect();
			};
		}, []);

		const height = row.type === 'header' ? CATEGORY_HEADER_HEIGHT : EMOJI_ROW_HEIGHT;

		if (!isVisible) {
			return <div ref={placeholderRef} style={{height: `${height}px`}} />;
		}

		return (
			<div ref={placeholderRef}>
				<VirtualRowRenderer
					row={row}
					handleHover={handleHover}
					handleSelect={handleSelect}
					skinTone={skinTone}
					spriteSheetSizes={spriteSheetSizes}
					channel={channel}
					shouldAnimate={allowAnimation && isInViewport}
					gridColumns={gridColumns}
					hoveredEmoji={hoveredEmoji}
					selectedRow={selectedRow}
					selectedColumn={selectedColumn}
					emojiRowIndex={emojiRowIndex}
					shouldScrollOnSelection={shouldScrollOnSelection}
					emojiRefs={emojiRefs}
				/>
			</div>
		);
	},
);
